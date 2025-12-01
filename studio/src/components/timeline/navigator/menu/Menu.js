import Signals from 'signals';
import Toolbar from './Toolbar';
import Zoom from './Zoom';

export default class Menu {
  constructor($parent) {
    this.$node = null;
    this.onZoom = new Signals.Signal();

    this.render($parent);

    this.toolbar = new Toolbar(this.$node);
    this.zoom = new Zoom(this.$node);

    this.zoom.onZoom.add(zoom => {
      this.onZoom.dispatch(zoom);
    });
  }

  init(scaleList) {
    this.toolbar.updateSceneToolbar();

    return this.zoom.init(scaleList);
  }

  set(currentZone, type) {
    return this.toolbar.set(currentZone, type);
  }

  setScenes(scenes) {
    this.toolbar.setScenes(scenes);
  }

  render($parent) {
    this.$node = document.createElement('div');
    this.$node.className = 'd-flex align-items-center gap-2 p-3 border-bottom bg-body-tertiary';
    $parent.appendChild(this.$node);
  }
}
