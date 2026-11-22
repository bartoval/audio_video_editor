// @ts-check

import Mediator from '../Mediator';
import {
  View,
  getPosXFromTime,
  getTimeFromPosX,
  getNavigatorX,
  scaleChanged,
  scalesEqual
} from '../../lib';
import { EVENT, TRACKS } from '../../config/constants';
import { RulerController } from './navigator/ruler';
import { Inspector } from './navigator/inspector';
import { MarkerController } from './navigator/markers';
import Tracks from './navigator/tracks/TracksController';
import { createThumbsView } from './navigator/thumbs';
import { Minimap } from './navigator/minimap';
import TimeTooltip from './navigator/TimeTooltip';
import * as EventService from '../../services/EventService';
import { playbackStore, timelineStore } from '../../store';
import { registerNavigatorShortcuts } from './navigator/registerNavigatorShortcuts';
import scaleManager from '../../services/ScaleManager';

const { TOOLTIP_THROTTLE_MS } = TRACKS;

// A Firefox notch is 3 lines: ~33px per line makes it zoom like a Chrome notch (100px)
const LINE_HEIGHT_PX = 33;
const ZOOM_STEP_PX = 200;
const PAGE_HEIGHT_PX = 800;

/**
 * Wheel delta in pixels whatever the device reports: Firefox sends mouse wheels in
 * lines (deltaY 3 per notch), so summing raw values made zoom ~30x slower there.
 * @param {WheelEvent} event
 * @returns {number}
 */
export function wheelDeltaInPixels(event) {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return event.deltaY * LINE_HEIGHT_PX;
  }

  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * PAGE_HEIGHT_PX;
  }

  return event.deltaY;
}

export default class Navigator extends View {
  #duration = 0;
  #inspector = null;
  #timeTooltip = null;
  #$nav = null;
  #lastTooltipTime = 0;
  #unsubscribeAddTracks = null;
  #unsubscribeRemoveTrack = null;
  #unsubscribeMarkerPrevious = null;
  #unsubscribeMarkerNext = null;
  #unsubscribeLoopToggle = null;
  #cleanupShortcuts = null;
  #accumulatedDelta = 0;
  #rafId = null;

  constructor($parent) {
    super($parent);
    this.mount().ready();
  }

  template() {
    return `
      <div class="timeline">
        <div class="navigator glass-container" data-testid="navigator-root"></div>
      </div>
    `;
  }

  /**
   * Fixed tool bar at the top of the timeline. The selected track's toolbar docks here
   * (see FloatingTrackToolbar), so selection never moves or covers the tracks.
   * @returns {HTMLElement}
   */
  #createDock() {
    const $dock = document.createElement('div');
    $dock.className = 'timeline-dock';
    $dock.setAttribute('role', 'toolbar');
    $dock.setAttribute('aria-label', 'Clip tools');
    $dock.dataset.testid = 'timeline-dock';
    $dock.innerHTML = `
      <span class="timeline-dock__empty">
        <i class="bi bi-cursor" aria-hidden="true"></i>
        Select a clip on the timeline to edit it
      </span>
      <div class="timeline-zoom" role="group" aria-label="Zoom">
        <button type="button" class="timeline-zoom__btn" data-zoom="out" title="Zoom out (Ctrl −)" aria-label="Zoom out">
          <i class="bi bi-dash-lg"></i>
        </button>
        <button type="button" class="timeline-zoom__btn timeline-zoom__fit" data-zoom="fit" title="Fit timeline (Ctrl 0)">Fit</button>
        <button type="button" class="timeline-zoom__btn" data-zoom="in" title="Zoom in (Ctrl +)" aria-label="Zoom in">
          <i class="bi bi-plus-lg"></i>
        </button>
      </div>
    `;

    $dock.querySelector('.timeline-zoom').addEventListener('click', event => {
      const $btn = /** @type {HTMLElement} */ (event.target).closest('[data-zoom]');
      const action = $btn?.getAttribute('data-zoom');

      if (action === 'in') this.zoomIn();
      else if (action === 'out') this.zoomOut();
      else if (action === 'fit') this.zoomToFit();
    });

    return $dock;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);

    this.#$nav = this.$node.querySelector('.navigator');
    // Outside .navigator: its children (playhead, cursor line) position from its top edge.
    this.$node.insertBefore(this.#createDock(), this.#$nav);
    const $inspectorParent =
      document.querySelector('.side-panel__pane--inspector') ||
      document.querySelector('.studio') ||
      document.body;

    this.#inspector = new Inspector($inspectorParent);
    this.#timeTooltip = new TimeTooltip();
    this.thumbs = createThumbsView(this.#$nav);

    this.ruler = new RulerController(this.#$nav, {
      onMove: time => {
        const rulerPosX = this.ruler.getPosX();
        this.thumbs.moveTo(rulerPosX) && this.tracks.moveTo(rulerPosX);
        this.#updateMinimap();
        EventService.emitLocal(EVENT.PLAYBACK_MOVE_FROM_NAVIGATOR, { time });
      },
      onStart: () => EventService.emitLocal(EVENT.PLAYBACK_PLAY),
      onStop: () => EventService.emitLocal(EVENT.PLAYBACK_PAUSE)
    });

    this.markers = new MarkerController(this.#$nav, {
      onMove: ({ time }) => {
        let posX = getPosXFromTime(time);
        this.ruler.moveTo(posX);
        posX = this.ruler.getPosX();

        this.thumbs.moveTo(posX);
        this.tracks.moveTo(posX);
        this.markers.moveTo(posX);
        this.#updateMinimap();

        EventService.emitLocal(EVENT.PLAYBACK_MOVE_FROM_NAVIGATOR, { time });
      },
      onScrubberMove: ({ time }) => {
        const posX = getPosXFromTime(time);
        this.ruler.moveTo(posX, false);
        EventService.emitLocal(EVENT.PLAYBACK_MOVE_FROM_NAVIGATOR, { time });
      },
      onAdd: () => {
        this.#updateLoopIfActive();
        EventService.emitLocal(EVENT.MARKERS_CHANGED, { count: this.markers.count() });
      },
      onRemove: () => {
        this.#updateLoopIfActive();
        EventService.emitLocal(EVENT.MARKERS_CHANGED, { count: this.markers.count() });
      },
      onEdit: () => {
        this.#updateLoopIfActive();
      },
      onSelect: marker => {
        EventService.emitLocal(EVENT.PLAYBACK_MOVE_FROM_NAVIGATOR, { time: marker.time });
      }
    });

    this.tracks = new Tracks(this.#$nav, {
      onMove: (posX, moveAll = true) => {
        const time = getTimeFromPosX(posX);
        this.ruler.moveTo(posX, moveAll);
        moveAll &&
          this.thumbs.moveTo(this.ruler.getPosX()) &&
          this.tracks.moveTo(this.ruler.getPosX());
        this.#updateMinimap();
        EventService.emitLocal(EVENT.PLAYBACK_MOVE_FROM_NAVIGATOR, { time });
      },
      onSetMenu: zones => this.#inspector.set(zones),
      onRevealSelection: () => {
        if (!this.#inspector.isOpen()) {
          this.#inspector.open();
        }
      },
      onTracksChange: () => this.#syncTracksToStore()
    });

    const $minimapContainer = document.createElement('div');
    $minimapContainer.classList.add('minimap-container');
    this.#$nav.appendChild($minimapContainer);
    this.minimap = new Minimap($minimapContainer, {
      onNavigate: time => {
        this.moveTo(time);
        EventService.emitLocal(EVENT.PLAYBACK_MOVE_FROM_NAVIGATOR, { time });
        EventService.emitLocal(EVENT.PLAYBACK_PAUSE);
      },
      onZoom: ({ startTime, endTime, visibleDuration, resizeEdge }) => {
        this.#handleMinimapZoom(startTime, endTime, visibleDuration, resizeEdge);
      }
    });
  }

  onMount() {
    Mediator.registerNavigator(this);

    this.#$nav.addEventListener('wheel', this.#handleWheel, { passive: false });
    this.#$nav.addEventListener('mousemove', this.#handleTooltipMove);
    this.#$nav.addEventListener('mouseleave', this.#handleTooltipLeave);

    this.#cleanupShortcuts = registerNavigatorShortcuts({
      inspector: this.#inspector,
      markers: this.markers,
      tracks: this.tracks,
      onLoopToggle: () => this.#handleLoopToggle(),
      zoom: { in: () => this.zoomIn(), out: () => this.zoomOut(), fit: () => this.zoomToFit() }
    });
    this.#unsubscribeAddTracks = EventService.on(EVENT.TIMELINE_ADD_TRACKS, tracks =>
      this.addTracksToTimeline(tracks)
    );
    this.#unsubscribeRemoveTrack = EventService.on(EVENT.LIBRARY_REMOVED, payload => {
      const id = payload?.id;
      if (!id) return;
      this.removeTracksByLibraryId(id);
    });
    this.#unsubscribeMarkerPrevious = EventService.on(EVENT.MARKER_PREVIOUS, () => {
      this.markers.goToPrevious(playbackStore.getState().time);
    });
    this.#unsubscribeMarkerNext = EventService.on(EVENT.MARKER_NEXT, () => {
      this.markers.goToNext(playbackStore.getState().time);
    });
    this.#unsubscribeLoopToggle = EventService.on(EVENT.LOOP_TOGGLE, () => {
      this.#handleLoopToggle();
    });
  }

  /** Initialize navigator with duration and config */
  async init(duration, config = {}) {
    if (isNaN(duration) || duration <= 0) {
      throw new Error('wrong duration: ' + duration);
    }

    this.#duration = duration;
    this.ruler.init(duration);
    this.thumbs.init(duration);
    this.minimap.init(duration);

    // moveTo after minimap is initialized so #updateMinimap works correctly
    this.moveTo(0);

    this.markers.init(config.markers || [], this.ruler);
    EventService.emitLocal(EVENT.MARKERS_CHANGED, { count: this.markers.count() });

    await this.tracks.init(config.tracks, this.ruler);

    this.#updateMinimap();
    this.#syncTracksToStore();

    return true;
  }

  /** Update position from async event */
  moveTo(time) {
    let posX = getPosXFromTime(time);

    this.ruler.moveTo(posX);
    posX = this.ruler.getPosX();

    this.thumbs.moveTo(posX);
    this.markers.moveTo(posX);
    this.tracks.moveTo(posX);

    if (this.minimap && this.#duration > 0) {
      this.#updateMinimap();
    }

    return true;
  }

  /** Update position during playback */
  updateFrame(time) {
    let posX = getPosXFromTime(time);
    this.ruler.updateFrame(posX);
    posX = this.ruler.getPosX();

    this.thumbs.updateFrame(posX);
    this.markers.updateFrame(posX);
    this.tracks.updateFrame(posX);
    this.minimap.updatePlayhead(time);

    return true;
  }

  /** Reset position to start */
  reset() {
    this.moveTo(0);

    return true;
  }

  /** Clear all tracks */
  clear() {
    this.moveTo(0);

    const $tracksContainer = this.$node.querySelector('.tracks ul');
    if ($tracksContainer) {
      $tracksContainer.innerHTML = '';
    }

    if (this.tracks) {
      this.tracks.zones = [];
    }

    return true;
  }

  /** Handle window resize */
  resize() {
    this.ruler.resize();
  }

  updateDuration(newDuration) {
    if (newDuration === this.#duration) {
      return;
    }

    this.#duration = newDuration;
    scaleManager.setDuration(newDuration);
    this.ruler.setDuration(newDuration);
    this.minimap.setDuration(newDuration);
    this.markers.clampToDuration(newDuration);
    this.#updateMinimap();
  }

  getDuration() {
    return this.#duration;
  }

  /** Export tracks and markers data */
  getData() {
    return {
      tracks: this.tracks.export(),
      markers: this.markers.export()
    };
  }

  /** Add tracks from audio library to timeline */
  addTracksToTimeline(audioTracks) {
    if (!audioTracks || audioTracks.length === 0) {
      return;
    }

    audioTracks.forEach(track => {
      const { id, label, duration } = track;
      const $parent = this.tracks.addComposite();
      const config = {
        id: this.tracks.getNewId(),
        idTrack: id,
        label,
        startTimeBuffer: 0,
        endTimeBuffer: duration,
        startTime: 0,
        durationTime: duration
      };

      this.tracks.addTrack(config, $parent);
    });

    this.#syncTracksToStore();
  }

  /** Sync internal tracks state to timelineStore */
  #syncTracksToStore() {
    const tracksData = this.tracks.export();
    timelineStore.actions.setTracks(tracksData);
  }

  /** Reload thumbnails (called when thumbnails are ready via SSE) */
  reloadThumbs() {
    if (this.#duration > 0) {
      this.thumbs.reload();
    }
  }

  /** Set thumbnails loading state */
  setThumbsLoading(isLoading) {
    this.thumbs.setLoading(isLoading);
  }

  /** Remove tracks that reference a missing library audio */
  async removeTracksByLibraryId(idTrack) {
    if (!this.tracks) return 0;

    const removed = await this.tracks.removeByTrackId(idTrack);

    if (removed > 0) {
      this.#updateMinimap();
      this.#inspector.set(null);
      this.#syncTracksToStore();
    }

    return removed;
  }

  /** Handle SSE thumbnail progress update */
  onThumbnailProgress(data) {
    this.thumbs.onProgress(data);
  }

  onDestroy() {
    this.#$nav?.removeEventListener('wheel', this.#handleWheel);
    this.#$nav?.removeEventListener('mousemove', this.#handleTooltipMove);
    this.#$nav?.removeEventListener('mouseleave', this.#handleTooltipLeave);

    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }

    this.#cleanupShortcuts?.();
    this.#unsubscribeAddTracks?.();
    this.#unsubscribeRemoveTrack?.();
    this.#unsubscribeMarkerPrevious?.();
    this.#unsubscribeMarkerNext?.();
    this.#unsubscribeLoopToggle?.();

    this.tracks?.destroy();
    this.markers?.destroy();
    this.minimap?.destroy();
    this.ruler?.destroy();
    this.#inspector?.destroy();
    this.#timeTooltip?.destroy();

    super.onDestroy();
  }

  #handleWheel = event => {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }

    if (!scaleManager.isInitialized()) {
      return;
    }

    event.preventDefault();
    this.#accumulatedDelta += wheelDeltaInPixels(event);

    if (this.#rafId === null) {
      this.#rafId = requestAnimationFrame(this.#applyZoom);
    }
  };

  #applyZoom = () => {
    this.#rafId = null;

    if (this.#accumulatedDelta === 0) {
      return;
    }

    const delta = this.#accumulatedDelta;
    this.#accumulatedDelta = 0;

    this.#applyScale(() => scaleManager.zoomByDelta(delta));
  };

  /** One button press or key press: about two wheel notches (~22%) */
  zoomIn() {
    this.#applyScale(() => scaleManager.zoomByDelta(-ZOOM_STEP_PX));
  }

  zoomOut() {
    this.#applyScale(() => scaleManager.zoomByDelta(ZOOM_STEP_PX));
  }

  /** Whole timeline in view */
  zoomToFit() {
    this.#applyScale(() => scaleManager.setScale(scaleManager.getLimits().max));
  }

  /**
   * The single zoom path for wheel, buttons and shortcuts: change the scale, keep the
   * playhead's time in place, then redraw every lane.
   * @param {() => number} changeScale - applies the new scale and returns it
   */
  #applyScale(changeScale) {
    if (!scaleManager.isInitialized()) {
      return;
    }

    const time = getTimeFromPosX(this.ruler.getAbsolutePosX());
    const previousScale = scaleManager.getScale();
    const newScale = changeScale();

    if (scalesEqual(newScale, previousScale)) {
      return;
    }

    this.ruler.zoomContinuous(newScale);
    this.ruler.moveTo(getPosXFromTime(time));
    this.markers.zoom();
    this.tracks.zoom();
    this.thumbs.zoom(this.ruler.getMaxWidth(), this.ruler.getPosX());
    this.minimap.zoom();
    this.#updateMinimap();

    EventService.emitLocal(EVENT.PLAYBACK_PAUSE);
  }

  #handleMinimapZoom(startTime, endTime, visibleDuration, resizeEdge) {
    const navigatorViewportWidth = this.ruler.getRange().width;
    const newScale = visibleDuration / navigatorViewportWidth;
    const previousScale = scaleManager.getScale();
    const clampedScale = scaleManager.setScale(newScale);

    // Only update ruler zoom if scale actually changed
    if (scaleChanged(clampedScale, previousScale)) {
      this.ruler.zoomContinuous(clampedScale);
    } else {
      // Scale at limit - still update minimap to give visual feedback
      this.#updateMinimap();

      return;
    }

    // Position view based on which handle is being dragged
    const halfViewport = navigatorViewportWidth / 2;

    if (resizeEdge === 'left') {
      // Left handle: keep right edge (endTime) fixed
      const endPosX = getPosXFromTime(endTime);
      this.ruler.moveTo(endPosX - halfViewport);
    } else {
      // Right handle or wheel: keep left edge (startTime) fixed
      const startPosX = getPosXFromTime(startTime);
      this.ruler.moveTo(startPosX + halfViewport);
    }
    this.markers.zoom();
    this.tracks.zoom();
    this.thumbs.zoom(this.ruler.getMaxWidth(), this.ruler.getPosX());

    this.#updateMinimap();
    EventService.emitLocal(EVENT.PLAYBACK_PAUSE);
  }

  #handleLoopToggle() {
    const state = playbackStore.getState();
    const isLoopEnabled = !state.isLoopEnabled;

    playbackStore.actions.toggleLoop();

    if (isLoopEnabled) {
      const bounds = this.markers.getLoopBounds();

      if (bounds) {
        playbackStore.actions.setTimeSlice(bounds);
        this.ruler.showLoopRegion(bounds.start, bounds.end);
      } else {
        playbackStore.actions.setLoopEnabled(false);
        console.warn('[Navigator] Loop requires at least 2 markers');
      }
    } else {
      playbackStore.actions.resetTimeSlice();
      this.ruler.hideLoopRegion();
    }
  }

  #updateLoopIfActive() {
    const state = playbackStore.getState();

    if (state.isLoopEnabled) {
      const bounds = this.markers.getLoopBounds();

      if (bounds) {
        playbackStore.actions.setTimeSlice(bounds);
        this.ruler.showLoopRegion(bounds.start, bounds.end);
      } else {
        playbackStore.actions.setLoopEnabled(false);
        playbackStore.actions.resetTimeSlice();
        this.ruler.hideLoopRegion();
      }
    }
  }

  #updateMinimap() {
    const range = this.ruler.getRange();
    const rulerPosX = this.ruler.getPosX();
    const viewportStartTime = getTimeFromPosX(rulerPosX);
    const viewportEndTime = getTimeFromPosX(rulerPosX + range.width);

    this.minimap.updateViewport(viewportStartTime, Math.min(viewportEndTime, this.#duration));
    this.minimap.updatePlayhead(playbackStore.getState().time);
  }

  #handleTooltipMove = event => {
    const now = performance.now();

    if (now - this.#lastTooltipTime < TOOLTIP_THROTTLE_MS) {
      return;
    }

    this.#lastTooltipTime = now;

    const target = event.target;

    if (target.closest('.minimap-container')) {
      this.#timeTooltip.hide();

      return;
    }

    const posX = getNavigatorX(event, this.#$nav) + this.ruler.getPosX();
    const currentTime = getTimeFromPosX(posX);

    const $zoneNode = target.closest('[data-zone-id]');

    if ($zoneNode) {
      const zoneId = $zoneNode.getAttribute('data-zone-id');
      const track = this.tracks.getChild(zoneId);

      if (track) {
        this.#timeTooltip.showTrack(track, currentTime, event.clientX, event.clientY);

        return;
      }
    }

    this.#timeTooltip.showTime(currentTime, event.clientX, event.clientY);
  };

  #handleTooltipLeave = () => {
    this.#timeTooltip.hide();
  };
}
