import { View } from '../../../lib/ui/mvp';
import Scale from '../../../lib/utils/scale';

/** Zone view with position rendering */
export default class ZoneView extends View {
  constructor($parent, config = {}) {
    super($parent);
    this._config = config;
  }

  template() {
    const { id, groupId } = this._config;

    return `<div class="zone" data-zone-group="${groupId}" data-zone-id="${id}"></div>`;
  }

  /** Create zone DOM element */
  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$root = wrapper.firstElementChild;
    this.$parent.appendChild(this.$root);
  }

  /** Update zone with state */
  update(state) {
    this._updateStyle(state);
  }

  /** Partial update on state change */
  patch(changes, state) {
    const styleKeys = ['startTime', 'durationTime', 'color'];
    const needsStyleUpdate = Object.keys(changes).some(key => styleKeys.includes(key));

    if (needsStyleUpdate) {
      this._updateStyle(state);
    }

    if (changes.isDragging) {
      this.$root.style.willChange = state.isDragging ? 'transform' : '';
    }
  }

  /** Apply position and color styles */
  _updateStyle({ startTime, durationTime, color }) {
    const left = Scale.getPosXFromTime(startTime);
    const width = Scale.getPosXFromTime(durationTime);

    this.$root.style.cssText = `left:${left}px;width:${width}px;background-color:${color}`;
  }
}
