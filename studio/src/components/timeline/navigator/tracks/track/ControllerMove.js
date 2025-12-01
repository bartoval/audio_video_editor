import Component from 'Component';
import { show, hide } from 'utils/dom';

export default class ControllerMove {
  constructor(config, $parent) {
    this.$node = null;
    this.render($parent, config.id);
  }

  show() {
    return show(this.$node);
  }

  hide() {
    return hide(this.$node);
  }

  render($parent, id) {
    this.$node = Component.render($parent, 'div', [
      { class: 'controller hook-move draggable hide-animated', 'data-zone-id': id }
    ]);
  }
}
