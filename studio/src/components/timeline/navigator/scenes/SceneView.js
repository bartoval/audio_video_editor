import { ZoneView } from '../../../core/zones';
import Scale from '../../../../lib/utils/scale';

export default class SceneView extends ZoneView {
  constructor($parent, config = {}) {
    super($parent, config);
    this.$label = null;
  }

  template() {
    const { id, groupId } = this._config;

    return `
      <div class="zone" data-zone-group="${groupId}" data-zone-id="${id}">
        <div data-ref="label" class="label" data-zone-id="${id}"></div>
        <div class="hook resizable" style="right: 0" data-zone-id="${id}"></div>
      </div>
    `;
  }

  /** Create DOM structure */
  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$root = wrapper.firstElementChild;
    this.$parent.appendChild(this.$root);

    this.$label = this.$root.querySelector('[data-ref="label"]');
  }

  /** Update with state */
  update(state) {
    const { label, color, description, startTime, durationTime } = state;

    this._updateContent(label, color, description);
    this._updateStyle({ startTime, durationTime });
  }

  /** Partial update on state change */
  patch(changes, state) {
    const contentKeys = ['label', 'color', 'description'];
    const styleKeys = ['startTime', 'durationTime'];

    if (Object.keys(changes).some(key => contentKeys.includes(key))) {
      this._updateContent(state.label, state.color, state.description);
    }

    if (Object.keys(changes).some(key => styleKeys.includes(key))) {
      this._updateStyle(state);
    }
  }

  select() {
    this.$root?.classList.add('selected');
  }
  deselect() {
    this.$root?.classList.remove('selected');
  }

  _updateContent(label, color, description) {
    if (this.$label) {
      this.$label.textContent = label;
    }
    if (this.$root) {
      this.$root.title = description;
      this.$root.style.backgroundColor = color;
    }
  }

  /** Override: position only, color handled by _updateContent */
  _updateStyle({ startTime, durationTime }) {
    if (!this.$root) {
      return;
    }
    this.$root.style.left = `${Scale.getPosXFromTime(startTime)}px`;
    this.$root.style.width = `${Scale.getPosXFromTime(durationTime)}px`;
  }
}
