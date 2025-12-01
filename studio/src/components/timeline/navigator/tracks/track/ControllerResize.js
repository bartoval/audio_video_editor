import Component from 'Component';
import { show, hide } from 'utils/dom';

export default class ControllerResize {
  constructor(config, $parent) {
    this.$node0 = null;
    this.$node1 = null;
    this.stretchFactor = config.stretchFactor || 1.0;
    this.ratio = this.stretchFactor;
    this.maxStretchFactor = this.stretchFactor - 1 <= 0 ? 2.0 : 2.0 - this.stretchFactor;
    this.minStretchFactor = this.stretchFactor - 1 < 0 && this.stretchFactor > 0.5 ? this.stretchFactor : 0.5;
    this.validThreshold = true;
    this.render($parent, config.id);
  }

  setStretchFactor(stretchFactor) {
    this.ratio = this.stretchFactor + (stretchFactor - 1);
    const isValidStretch = this.ratio >= 0.5 && this.ratio <= 2.0;
    this.ratio = this.ratio < 0.5 ? 0.5 : this.ratio;
    this.ratio = this.ratio > 2.0 ? 2.0 : this.ratio;

    return isValidStretch;
  }

  getStretchFactor() {
    return parseFloat(this.ratio);
  }

  isValidStretchFactor() {
    return this.validThreshold;
  }

  show() {
    return show([this.$node0, this.$node1]);
  }

  hide() {
    return hide([this.$node0, this.$node1]);
  }

  render($parent, id) {
    this.$node0 = Component.render($parent, 'div', [
      { class: 'controller hook-resize hook-resize-right resizable hide-animated', 'data-zone-id': id }
    ]);
    this.$node1 = Component.render($parent, 'div', [
      { class: 'controller hook-resize hook-resize-left resizable hide-animated', 'data-zone-id': id }
    ]);
  }
}
