import { show, hide, View } from '../../../../../lib';

/**
 * MoveHandle - Draggable handle for moving tracks
 * Pure view component
 */
export default class MoveHandle extends View {
  constructor(config, $parent) {
    super($parent);
    this.id = config.id;
    this.mount();
  }

  template() {
    return `<div class="controller hook-move draggable hide-animated" data-zone-id="${this.id}"></div>`;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);
  }

  show() {
    return show(this.$node);
  }

  hide() {
    return hide(this.$node);
  }
}
