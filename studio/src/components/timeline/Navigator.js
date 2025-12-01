import Component from 'Component';
import Mediator from 'Mediator';
import Ruler from './navigator/ruler/Ruler';
import RulerWithIndicator from './navigator/ruler/Indicator';
import Menu from './navigator/menu/Menu';
import Scenes from './navigator/scenes/Container';
import Tracks from './navigator/tracks/Container';
import Thumbs from './navigator/thumbs/Container';

/** Wire up signals between ruler, scenes, tracks, thumbs and menu */
const _addSignals = (ruler, scenes, tracks, thumbs, menu) => {
  ruler.onMove.add(time => {
    const rulerPosX = ruler.getPosX();
    thumbs.moveTo(rulerPosX) &&
    scenes.moveTo(rulerPosX) &&
    tracks.moveTo(rulerPosX);
    Mediator.onMoveFromNavigator(time);
  });

  menu.onZoom.add(zoom => {
    const time = Component.getTimeFromPosX(ruler.getAbsolutePosX());
    ruler.zoom(zoom, true) && ruler.moveTo(Component.getPosXFromTime(time)) &&
    scenes.zoom() &&
    tracks.zoom() &&
    thumbs.zoom(ruler.getMaxWidth(), ruler.getPosX());
    Mediator.onStop();
  });

  ruler.onStop.add(() => {
    Mediator.onStop();
  });

  ruler.onStart.add(() => {
    Mediator.onStart();
  });

  scenes.onSetMenu.add((zones, currentZone) => {
    menu.set(zones, 'scenes');
    menu.toolbar.updateSceneToolbar();
    Mediator.onSetTimeSlice({ start: currentZone.getStart(), end: currentZone.getEnd() });
  });

  scenes.onMove.add(range => {
    let posX = range.startPosX;
    ruler.moveTo(posX);
    posX = ruler.getPosX();
    thumbs.moveTo(posX) &&
    scenes.moveTo(posX) &&
    tracks.moveTo(posX);
    Mediator.onMoveFromNavigator(range.start);
  });

  scenes.onStop.add(isScene => {
    Mediator.onReset(isScene);
  });

  scenes.onStart.add(isScene => {
    Mediator.onStart(isScene);
  });

  tracks.onMove.add((posX, moveAll = true) => {
    const time = Component.getTimeFromPosX(posX);
    ruler.moveTo(posX, moveAll);
    moveAll && thumbs.moveTo(ruler.getPosX()) &&
    scenes.moveTo(ruler.getPosX()) &&
    tracks.moveTo(ruler.getPosX());
    Mediator.onMoveFromNavigator(time);
  });

  tracks.onSetMenu.add(zones => {
    menu.set(zones, 'tracks');
  });
};

export default class Navigator {
  constructor($parent) {
    this.$node = null;
    this.time = 0;
    this.render($parent);

    this.menu = new Menu(this.$node.querySelector('.navigator'));
    this.thumbs = new Thumbs(this.$node.querySelector('.navigator'));
    this.ruler = new RulerWithIndicator(new Ruler());
    this.ruler.render(this.$node.querySelector('.navigator'));
    this.scenes = new Scenes(this.$node.querySelector('.navigator'));
    this.tracks = new Tracks(this.$node.querySelector('.navigator'));

    this.menu.setScenes(this.scenes);

    Mediator.registerNavigator(this);
    _addSignals(this.ruler, this.scenes, this.tracks, this.thumbs, this.menu);
  }

  /** Initialize navigator with duration and config */
  async init(duration, config = {}) {
    if (isNaN(duration) || duration <= 0) {
      throw new Error('wrong duration: ' + duration);
    }

    const scaleList = this.ruler.init(duration);
    this.moveTo(0);

    this.thumbs.init(duration);
    this.menu.init(scaleList);

    await this.scenes.init(config.scenes, this.ruler);
    await this.tracks.init(config.tracks, this.ruler);

    return true;
  }

  /** Update position from async event */
  moveTo(time) {
    let posX = Component.getPosXFromTime(time);
    this.ruler.moveTo(posX);
    posX = this.ruler.getPosX();

    this.thumbs.moveTo(posX);
    this.scenes.moveTo(posX);
    this.tracks.moveTo(posX);
    this.time = time;

    return true;
  }

  /** Update position during playback */
  updateFrame(time) {
    let posX = Component.getPosXFromTime(time);
    this.ruler.updateFrame(posX);
    posX = this.ruler.getPosX();

    this.thumbs.updateFrame(posX);
    this.scenes.updateFrame(posX);
    this.tracks.updateFrame(posX);
    this.time = time;

    return true;
  }

  /** Reset position to start */
  reset() {
    this.moveTo(0);

    return true;
  }

  /** Clear all tracks and thumbs */
  clear() {
    this.moveTo(0);

    const $tracksContainer = this.$node.querySelector('.tracks ul');

    if ($tracksContainer) {
      $tracksContainer.innerHTML = '';
    }

    const $thumbsContainer = this.$node.querySelector('.thumbs ul');

    if ($thumbsContainer) {
      $thumbsContainer.innerHTML = '';
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

  /** Render timeline DOM */
  render($parent) {
    this.$node = Component.render($parent, 'div', [{ class: 'timeline' }], {}, '');
    Component.render(this.$node, 'div', [{ class: 'navigator' }]);
  }
}
