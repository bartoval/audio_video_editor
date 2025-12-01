import { Signals, View } from '../../../../lib';
import { ZONE_TYPE } from '../../../../constants';
import TracksToolbar from './TracksToolbar';
import ScenesToolbar from './ScenesToolbar';
import ZoomToolbar from './ZoomToolbar';

/** Toolbar - composes track, scene, and zoom toolbars */
export default class ToolbarController extends View {
  #tracksToolbar = null;
  #scenesToolbar = null;
  #zoomToolbar = null;

  onZoom = new Signals.Signal();

  constructor($parent) {
    super($parent);
    this.mount();
  }

  template() {
    return `
      <div class="navigator-toolbar d-flex align-items-center gap-2 p-3 border-bottom"></div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);

    this.#tracksToolbar = new TracksToolbar(this.$node, {
      onAction: () => this.#scenesToolbar.update()
    });

    this.#scenesToolbar = new ScenesToolbar(this.$node);

    this.#zoomToolbar = new ZoomToolbar(this.$node);
    this.#zoomToolbar.onZoom.add(zoom => this.onZoom.dispatch(zoom));
  }

  init(scaleList, initialZoom = 0) {
    this.#scenesToolbar.update();

    return this.#zoomToolbar.init(scaleList, initialZoom);
  }

  set(zones, type) {
    if (type === ZONE_TYPE.TRACKS) {
      this.#tracksToolbar.set(zones);
    }

    this.#scenesToolbar.update();

    return true;
  }

  setScenes(scenes) {
    this.#scenesToolbar.setScenes(scenes);
  }

  updateSceneToolbar() {
    this.#scenesToolbar.update();
  }
}
