import View from '../../mvp/View.js';
import Component from 'Component';

export default class ZoneView extends View {
  constructor($parent) {
    super($parent);
  }

  /** Create or update zone DOM element */
  render(state) {
    const { id, groupId } = state;

    if (!this.$root) {
      this.$root = Component.render(this.$parent, 'div', [{
        class: 'zone',
        'data-zone-group': groupId,
        'data-zone-id': id
      }]);
    }

    this._updateStyle(state);

    return this.$root;
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
  _updateStyle(state) {
    const { startTime, durationTime, color } = state;
    const left = Component.getPosXFromTime(startTime);
    const width = Component.getPosXFromTime(durationTime);

    this.$root.style.cssText = `left:${left}px;width:${width}px;background-color:${color}`;
  }
}
