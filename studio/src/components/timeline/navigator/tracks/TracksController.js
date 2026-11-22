// @ts-check

import { TRACK_ACTION, TRACKS } from '../../../../config/constants';
import { getTimeFromPosX, getTimelinePosXFromClientX } from '../../../../lib';
import { ZoneListController } from '../../../core/zones';
import Track from './TrackPresenter';
import TracksEventHandler from './TracksEventHandler';
import { CutZoneOverlay } from './views';
import * as ToolMode from '../../../../services/ToolMode';
import * as CutService from '../../../../services/CutService';
import * as SplitModeService from '../../../../services/SplitModeService';
import SnappingService from '../../../../services/SnappingService';

/**
 * TracksController - Manages audio tracks in the timeline
 *
 * Tool-first pattern: methods accept zone as parameter for tool actions,
 * allowing operations on any track without requiring prior selection.
 */
export default class TracksController {
  #controller = null;
  #$tracks = null;
  #$placeholder = null;
  #ruler = null;
  #unsubscribeToolMode = null;
  #previousMode = null;
  #cutZoneOverlay = null;
  #eventHandler = null;

  onMove = null;
  onSetMenu = null;
  onRevealSelection = null;
  onDragEnd = null;
  onTracksChange = null;

  constructor($parent, callbacks = {}) {
    this.onMove = callbacks.onMove || (() => {});
    this.onSetMenu = callbacks.onSetMenu || (() => {});
    this.onRevealSelection = callbacks.onRevealSelection || (() => {});
    this.onDragEnd = callbacks.onDragEnd || (() => {});
    this.onTracksChange = callbacks.onTracksChange || (() => {});

    this.#$tracks = this.#createTracksElement($parent);
    this.#$placeholder = this.#createPlaceholder();
    this.#controller = new ZoneListController(this.#$tracks);
    this.#eventHandler = new TracksEventHandler(this, this.#controller, this.#$tracks);
    this.#cutZoneOverlay = new CutZoneOverlay(this.#$tracks, this.#handleCutConfirm);
    this.#unsubscribeToolMode = ToolMode.onModeChange(this.#handleToolModeChange);
  }

  async init(config, ruler) {
    this.#ruler = ruler;
    await this.#controller.init(ruler);

    if (config) {
      config.forEach(elem => {
        elem.volumeValues.forEach(volumeValue => {
          const volumeValues = new Float32Array(volumeValue.data.times.length);
          volumeValue.data.times.forEach((_, index) => {
            volumeValues[index] = volumeValue.data.values[index];
          });
          volumeValue.data.values = volumeValues;
        });
        const $parent =
          this.#controller.getComposite(elem.groupId) ||
          this.#controller.addComposite(elem.groupId);
        const track = new Track(elem, $parent);
        this.#setupTrackCallbacks(track);
        this.#controller.add(track, null);
      });
    }

    this.onSetMenu(this);
    this.#updatePlaceholder();
    this.updateSnapPoints();

    return true;
  }

  /**
   * @param {string | number} id
   * @param {{ reveal?: boolean }} [options] - reveal: the user picked this clip, so show
   *   its details (opens the Inspector). Selections made by code (new track, split,
   *   duplicate) leave the side panel alone.
   */
  select(id, { reveal = false } = {}) {
    const previousZone = this.#controller.getSelected();
    const previousId = previousZone?.getId();

    if (previousZone !== null) {
      previousZone.deselect();
    }

    const currentZone =
      this.#controller.setSelected(this.#controller.getChild(id)) && this.#controller.getSelected();

    if (currentZone !== null) {
      currentZone.select();
    }

    if (
      previousId !== undefined &&
      String(previousId) !== String(id) &&
      ToolMode.isMode(TRACK_ACTION.CUT)
    ) {
      ToolMode.deactivate();
    }

    this.onSetMenu(this);

    if (reveal && currentZone) {
      this.onRevealSelection();
    }

    return currentZone;
  }

  getSelected() {
    return this.#controller.getSelected();
  }

  /** The user clicked the clip that is already selected: show its details anyway */
  revealSelection() {
    if (this.#controller.getSelected()) {
      this.onRevealSelection();
    }
  }

  addTrack(config, $parent) {
    const track = new Track(config, $parent);
    this.#setupTrackCallbacks(track);
    this.#controller.add(track, null);
    this.select(config.id);
    this.#updatePlaceholder();
    this.updateSnapPoints();
  }

  #setupTrackCallbacks(track) {
    track.setContainerCallbacks({
      onSplitRequest: zone => this.enterSplitMode(zone),
      onCopyRequest: zone => this.clone(zone),
      onDeleteRequest: zone => this.remove(zone),
      getTimeFromClientX: clientX => this.getTimeFromClientX(clientX)
    });
  }

  /**
   * Remove a track - accepts zone directly for tool-first pattern
   * @param {Object|string|null} zoneOrId - Zone object, zone ID, or null for selected
   */
  remove(zoneOrId = null) {
    let zone;

    if (zoneOrId === null) {
      zone = this.#controller.getSelected();
    } else if (typeof zoneOrId === 'object') {
      zone = zoneOrId;
    } else {
      zone = this.#controller.getChild(zoneOrId);
    }

    if (!zone) {
      return Promise.resolve(false);
    }

    const $root = zone.getRoot();
    $root.classList.add('removing');

    return new Promise(resolve => {
      setTimeout(() => {
        zone.clean().then(() => {
          this.#controller.remove(zone.getId());
          this.#updatePlaceholder();
          this.updateSnapPoints();
          this.onSetMenu(this);
          this.onTracksChange();
          resolve(true);
        });
      }, 150);
    });
  }

  /**
   * Remove all tracks that reference a given library idTrack
   * @param {string|number} idTrack
   * @returns {Promise<number>} removed count
   */
  async removeByTrackId(idTrack) {
    const toRemove = this.#controller
      .getAllChildren()
      .filter(zone => zone.get('idTrack') === idTrack);
    let removed = 0;

    for (const zone of toRemove) {
      const success = await this.remove(zone);
      if (success) {
        removed += 1;
      }
    }

    return removed;
  }

  /**
   * Clone a track - accepts zone directly for tool-first pattern
   * @param {Object|null} zone - Zone to clone, or null for selected
   */
  clone(zone = null) {
    const targetZone = zone || this.#controller.getSelected();

    if (!targetZone) {
      return false;
    }

    let $parent = targetZone.getGroupElement()?.nextSibling;

    if ($parent === null) {
      $parent = this.#controller.addComposite(null);
    }

    const clonedTrack = new Track(targetZone.clone(this.#controller.getNewId()), $parent);
    this.#setupTrackCallbacks(clonedTrack);
    this.#controller.add(clonedTrack, null);
    this.#updatePlaceholder();
    this.updateSnapPoints();
    this.onSetMenu(this);

    return true;
  }

  getCount() {
    return this.#controller.getNumChildren();
  }

  getMaxEndTime() {
    const numChildren = this.#controller.getNumChildren();

    if (numChildren === 0) {
      return 0;
    }

    let maxEnd = 0;

    for (let i = 0; i < numChildren; i++) {
      const track = this.#controller.getChildByIndex(i);
      const endTime = track.getStart() + track.getDuration();
      maxEnd = Math.max(maxEnd, endTime);
    }

    return maxEnd;
  }

  isSplitMode() {
    return SplitModeService.isEnabled();
  }

  /**
   * Get the zone being split
   */
  getSplitZone() {
    return SplitModeService.getZone();
  }

  /**
   * Enter split mode for a zone - next click on waveform will split
   * @param {Object} zone - Zone to split (defaults to selected)
   */
  enterSplitMode(zone = null) {
    const targetZone = zone || this.#controller.getSelected();

    return SplitModeService.enter(targetZone);
  }

  /**
   * Exit split mode
   */
  exitSplitMode() {
    SplitModeService.exit();
  }

  /**
   * Handle split click - splits track at click position
   * @param {Object} zone - The zone being split
   * @param {number} posX - Click position in pixels
   */
  handleSplitClick(zone, posX) {
    const splitInfo = SplitModeService.getSplitInfo(zone, posX);

    if (!splitInfo) {
      this.exitSplitMode();

      return false;
    }

    this.#executeSplit(splitInfo.zone, splitInfo.splitTime);
    this.exitSplitMode();

    return true;
  }

  /**
   * Execute split at a specific time point
   */
  #executeSplit(zone, splitTime) {
    const { MIN_CUT_DURATION } = TRACKS;
    const $parent = zone.getGroupElement();
    const duration = zone.getDuration();

    const beforeDuration = splitTime;
    const afterDuration = duration - splitTime;

    if (beforeDuration < MIN_CUT_DURATION || afterDuration < MIN_CUT_DURATION) {
      return false;
    }

    zone.cut(0, beforeDuration);
    const beforeTrack = new Track(zone.clone(this.#controller.getNewId()), $parent);
    this.#setupTrackCallbacks(beforeTrack);
    this.#controller.add(beforeTrack, null);

    zone.cut(splitTime, afterDuration);
    const afterTrack = new Track(zone.clone(this.#controller.getNewId()), $parent);
    this.#setupTrackCallbacks(afterTrack);
    this.#controller.add(afterTrack, null);

    this.remove(zone).then(() => {
      this.select(afterTrack.getId());
    });

    return true;
  }

  /**
   * Cut region - removes the selected time range from a track
   * Creates two new tracks: before and after the cut region
   * @param {Object} zone - The zone to cut
   * @param {number} startTime - Cut region start time (absolute)
   * @param {number} endTime - Cut region end time (absolute)
   */
  cutRegion(zone, startTime, endTime) {
    const validation = CutService.validateCutRegion(zone, startTime, endTime);

    if (!validation.valid) {
      console.warn('[TracksController]', validation.error);

      return false;
    }

    const $parent = zone.getGroupElement();
    const { beforeDuration, afterDuration, relativeEnd } = validation;
    const { MIN_CUT_DURATION } = TRACKS;
    const createdTracks = [];

    if (beforeDuration >= MIN_CUT_DURATION) {
      zone.cut(0, beforeDuration);
      const beforeTrack = new Track(zone.clone(this.#controller.getNewId()), $parent);
      this.#setupTrackCallbacks(beforeTrack);
      this.#controller.add(beforeTrack, null);
      createdTracks.push(beforeTrack);
    }

    if (afterDuration >= MIN_CUT_DURATION) {
      zone.cut(relativeEnd, afterDuration);
      const afterTrack = new Track(zone.clone(this.#controller.getNewId()), $parent);
      this.#setupTrackCallbacks(afterTrack);
      this.#controller.add(afterTrack, null);
      createdTracks.push(afterTrack);
    }

    this.remove(zone).then(() => {
      if (createdTracks.length > 0) {
        this.select(createdTracks[0].getId());
      }
    });

    return true;
  }

  /**
   * Toggle volume envelope on a zone
   * @param {Object} zone - The zone to toggle volume on
   */
  toggleVolume(zone) {
    if (!zone) {
      return false;
    }

    if (zone.model?.isVolumeVisible()) {
      zone.volumeHide();
    } else {
      zone.volumeShow();
    }

    return true;
  }

  /**
   * Toggle mute on a zone
   * @param {Object} zone - The zone to toggle mute on
   */
  toggleMute(zone) {
    if (!zone) {
      return false;
    }

    if (zone.isMuted()) {
      zone.unmute();
    } else {
      zone.mute();
    }

    return true;
  }

  back() {
    const currentZone = this.#controller.getSelected();
    const posX = this.#controller.getPosX();
    const range = this.#ruler.getRange();
    const nextPosX = posX - range.width / 2 - range.left;
    const startPosX = currentZone.getStartPosX();
    const finalPosX = nextPosX < startPosX ? startPosX : nextPosX;

    this.onMove(finalPosX);

    return true;
  }

  forward() {
    const currentZone = this.#controller.getSelected();
    const posX = this.#controller.getPosX();
    const range = this.#ruler.getRange();
    const nextPosX = posX + range.width / 2 + range.left;
    const startPosX = currentZone.getStartPosX();
    const maxWidth = this.#ruler.getMaxWidth();
    const endPosX =
      maxWidth > startPosX + currentZone.getWidth() ? startPosX + currentZone.getWidth() : maxWidth;
    const finalPosX = nextPosX > endPosX ? endPosX : nextPosX;

    this.onMove(finalPosX);

    return true;
  }

  zoom() {
    const result = this.#controller.zoom();
    this.updateSnapPoints();

    return result;
  }

  moveTo(posX) {
    if (posX < 0) {
      return false;
    }

    return this.#controller.moveTo(posX);
  }

  updateFrame(posX) {
    if (posX <= 0) {
      return false;
    }

    return this.#controller.updateFrame(posX);
  }

  export() {
    const tracks = [];

    for (let i = 0; i < this.#controller.getNumChildren(); i++) {
      const child = this.#controller.getChildByIndex(i);
      tracks.push(child.export());
    }

    return tracks;
  }

  /**
   * Updates snap points for all tracks (start/end boundaries)
   * Should be called after tracks are added, removed, moved, or zoomed
   *
   * NOTE: Snap points are stored as time values only. SnappingService
   * calculates posX at snap time using the current scale.
   */
  updateSnapPoints() {
    const snapPoints = [];
    const numChildren = this.#controller.getNumChildren();

    for (let i = 0; i < numChildren; i++) {
      const track = this.#controller.getChildByIndex(i);
      const trackId = track.getId();
      const startTime = track.getStart();
      const endTime = startTime + track.getDuration();

      snapPoints.push({
        time: startTime,
        type: 'track-start',
        trackId,
        label: `Track ${i + 1} Start`
      });

      snapPoints.push({
        time: endTime,
        type: 'track-end',
        trackId,
        label: `Track ${i + 1} End`
      });
    }

    SnappingService.registerSnapPoints('tracks', snapPoints);
  }

  getChild(id) {
    return this.#controller.getChild(id);
  }

  /** @returns {number} number of tracks */
  getNumTracks() {
    return this.#controller.getNumChildren();
  }

  /**
   * @param {number} index
   * @returns {Track|null}
   */
  getChildByIndex(index) {
    return this.#controller.getChildByIndex(index);
  }

  getNewId() {
    return this.#controller.getNewId();
  }

  addComposite(id = null) {
    return this.#controller.addComposite(id);
  }

  getRulerPosX() {
    return this.#ruler?.getPosX() ?? 0;
  }

  /** @param {number} clientX */
  getPosXFromClientX(clientX) {
    return getTimelinePosXFromClientX(clientX, this.#$tracks, this.getRulerPosX());
  }

  /** @param {number} clientX */
  getTimeFromClientX(clientX) {
    return getTimeFromPosX(this.getPosXFromClientX(clientX));
  }

  #handleToolModeChange = newMode => {
    if (this.#previousMode === TRACK_ACTION.VOLUME && newMode !== TRACK_ACTION.VOLUME) {
      this.#hideAllVolume();
    }

    this.#previousMode = newMode;
  };

  #handleCutConfirm = () => {
    const cutInfo = CutService.confirm();

    if (cutInfo) {
      const { zone, startTime, endTime } = cutInfo;

      if (zone && zone.model) {
        this.cutRegion(zone, startTime, endTime);
      }
    }

    CutService.deactivate();
  };

  #hideAllVolume() {
    for (let i = 0; i < this.#controller.getNumChildren(); i++) {
      const zone = this.#controller.getChildByIndex(i);

      if (zone?.model?.isVolumeVisible()) {
        zone.volumeHide();
      }
    }
  }

  #createTracksElement($parent) {
    const $tracks = document.createElement('div');
    $tracks.className = 'tracks';
    $tracks.dataset.testid = 'tracks-container';
    $parent.appendChild($tracks);

    return $tracks;
  }

  #createPlaceholder() {
    const $placeholder = document.createElement('div');
    $placeholder.className = 'tracks-placeholder';
    $placeholder.innerHTML = `
      <div class="tracks-placeholder-content">
        <i class="bi bi-music-note-list"></i>
        <p>Select or drag audio tracks from the library</p>
      </div>
    `;
    this.#$tracks.appendChild($placeholder);

    return $placeholder;
  }

  #updatePlaceholder() {
    const hasChildren = this.#controller.getNumChildren() > 0;
    this.#$placeholder.style.display = hasChildren ? 'none' : 'flex';
  }

  destroy() {
    if (this.#unsubscribeToolMode) {
      this.#unsubscribeToolMode();
      this.#unsubscribeToolMode = null;
    }

    SnappingService.clearSnapPoints('tracks');

    this.#eventHandler?.destroy();
    this.#eventHandler = null;

    this.#cutZoneOverlay?.destroy();
    this.#cutZoneOverlay = null;

    if (SplitModeService.isEnabled()) {
      SplitModeService.exit();
    }

    this.#$placeholder?.remove();
    this.#$placeholder = null;

    this.#$tracks?.remove();
    this.#$tracks = null;

    this.#controller = null;
    this.#ruler = null;

    this.onMove = null;
    this.onSetMenu = null;
    this.onRevealSelection = null;
    this.onDragEnd = null;
    this.onTracksChange = null;
  }
}
