import Mediator from '../Mediator';
import { View, getPosXFromTime, getTimeFromPosX } from '../../lib';
import { ZONE_TYPE } from '../../constants';
import { RulerController } from './navigator/ruler';
import { ToolbarController } from './navigator/toolbar';
import { SceneListController as Scenes } from './navigator/scenes';
import Tracks from './navigator/tracks/TracksController';
import { createThumbsView } from './navigator/thumbs';
import { Minimap } from './navigator/minimap';

export default class Navigator extends View {
  #duration = 0;

  constructor($parent) {
    super($parent);
    this.time = 0;
    this.mount().ready();
  }

  template() {
    return `
      <div class="timeline">
        <div class="navigator"></div>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);

    const $nav = this.$node.querySelector('.navigator');

    this.menu = new ToolbarController($nav);
    this.thumbs = createThumbsView($nav);

    // Minimap between thumbs and ruler
    const $minimapContainer = document.createElement('div');
    $minimapContainer.className = 'minimap-container';
    $nav.appendChild($minimapContainer);
    this.minimap = new Minimap($minimapContainer);

    this.ruler = new RulerController($nav);
    this.scenes = new Scenes($nav);
    this.tracks = new Tracks($nav);
  }

  /** Setup dependencies between components */
  onMount() {
    this.menu.setScenes(this.scenes);
    Mediator.registerNavigator(this);
  }

  /** Wire up signals - all components are ready */
  onReady() {
    this._addSignals();
  }

  /** Wire up signals between components */
  _addSignals() {
    const { ruler, scenes, tracks, thumbs, menu, minimap } = this;

    ruler.onMove.add(time => {
      const rulerPosX = ruler.getPosX();
      thumbs.moveTo(rulerPosX) && scenes.moveTo(rulerPosX) && tracks.moveTo(rulerPosX);
      this.#updateMinimap();
      Mediator.onMoveFromNavigator(time);
    });

    menu.onZoom.add(zoom => {
      const time = getTimeFromPosX(ruler.getAbsolutePosX());
      ruler.zoom(zoom) &&
        ruler.moveTo(getPosXFromTime(time)) &&
        scenes.zoom() &&
        tracks.zoom() &&
        thumbs.zoom(ruler.getMaxWidth(), ruler.getPosX());
      minimap.zoom();
      this.#updateMinimap();
      this.#updateMinimapScenes();
      Mediator.onStop();
    });

    ruler.onStop.add(() => Mediator.onStop());
    ruler.onStart.add(() => Mediator.onStart());

    scenes.onSetMenu.add((zones, currentZone) => {
      menu.set(zones, ZONE_TYPE.SCENES);
      menu.updateSceneToolbar();
      Mediator.onSetTimeSlice({ start: currentZone.getStart(), end: currentZone.getEnd() });
    });

    scenes.onMove.add(range => {
      let posX = range.startPosX;
      ruler.moveTo(posX);
      posX = ruler.getPosX();
      thumbs.moveTo(posX) && scenes.moveTo(posX) && tracks.moveTo(posX);
      this.#updateMinimap();
      Mediator.onMoveFromNavigator(range.start);
    });

    scenes.onStop.add(isScene => Mediator.onReset(isScene));
    scenes.onStart.add(isScene => Mediator.onStart(isScene));

    // Update minimap when scenes change
    scenes.onAdd.add(() => this.#updateMinimapScenes());
    scenes.onRemove.add(() => this.#updateMinimapScenes());
    scenes.onEdit.add(() => this.#updateMinimapScenes());

    tracks.onMove.add((posX, moveAll = true) => {
      const time = getTimeFromPosX(posX);
      ruler.moveTo(posX, moveAll);
      moveAll &&
        thumbs.moveTo(ruler.getPosX()) &&
        scenes.moveTo(ruler.getPosX()) &&
        tracks.moveTo(ruler.getPosX());
      this.#updateMinimap();
      Mediator.onMoveFromNavigator(time);
    });

    tracks.onSetMenu.add(zones => menu.set(zones, ZONE_TYPE.TRACKS));

    // Minimap navigation
    minimap.onNavigate.add(time => {
      this.moveTo(time);
      Mediator.onMoveFromNavigator(time);
      Mediator.onStop();
    });
  }

  /** Initialize navigator with duration and config */
  async init(duration, config = {}) {
    if (isNaN(duration) || duration <= 0) {
      throw new Error('wrong duration: ' + duration);
    }

    this.#duration = duration;
    const { scaleList, initialZoom } = this.ruler.init(duration);

    this.thumbs.init(duration);
    this.menu.init(scaleList, initialZoom);
    this.minimap.init(duration);

    // moveTo after minimap is initialized so #updateMinimap works correctly
    this.moveTo(0);

    await this.scenes.init(config.scenes, this.ruler);
    await this.tracks.init(config.tracks, this.ruler);

    this.#updateMinimapScenes();
    this.#updateMinimap();

    return true;
  }

  /** Update position from async event */
  moveTo(time) {
    let posX = getPosXFromTime(time);
    this.ruler.moveTo(posX);
    posX = this.ruler.getPosX();

    this.thumbs.moveTo(posX);
    this.scenes.moveTo(posX);
    this.tracks.moveTo(posX);
    this.time = time;

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
    this.scenes.updateFrame(posX);
    this.tracks.updateFrame(posX);
    this.minimap.updatePlayhead(time);
    this.time = time;

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

  /** Export tracks and scenes data */
  getData() {
    return { tracks: this.tracks.export(), scenes: this.scenes.export() };
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
  }

  // ============================================================================
  // Private
  // ============================================================================

  #updateMinimap() {
    const range = this.ruler.getRange();
    const rulerPosX = this.ruler.getPosX();

    // Calculate visible time range using current scale factor
    // getTimeFromPosX uses the global scaleFactorX which is set by ruler.resize()
    const viewportStartTime = getTimeFromPosX(rulerPosX);
    const viewportEndTime = getTimeFromPosX(rulerPosX + range.width);

    this.minimap.updateViewport(viewportStartTime, Math.min(viewportEndTime, this.#duration));
    this.minimap.updatePlayhead(this.time);
  }

  #updateMinimapScenes() {
    const scenesData = this.scenes.export();
    this.minimap.renderScenes(scenesData);
  }
}
