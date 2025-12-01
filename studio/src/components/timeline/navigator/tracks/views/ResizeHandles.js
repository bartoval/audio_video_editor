import { TRACKS } from '../../../../../constants';
import { show, hide, View } from '../../../../../lib';

const { MIN_STRETCH_FACTOR, MAX_STRETCH_FACTOR, DEFAULT_STRETCH_FACTOR } = TRACKS;

/**
 * ResizeHandles - Left and right resize handles for tracks
 * Manages stretch factor calculations and handle visibility
 */
export default class ResizeHandles extends View {
  constructor(config, $parent) {
    super($parent);
    this.id = config.id;
    this.$node0 = null;
    this.$node1 = null;
    this.stretchFactor = config.stretchFactor || DEFAULT_STRETCH_FACTOR;
    this.ratio = this.stretchFactor;
    this.maxStretchFactor =
      this.stretchFactor - 1 <= 0 ? MAX_STRETCH_FACTOR : MAX_STRETCH_FACTOR - this.stretchFactor;
    this.minStretchFactor =
      this.stretchFactor - 1 < 0 && this.stretchFactor > MIN_STRETCH_FACTOR
        ? this.stretchFactor
        : MIN_STRETCH_FACTOR;
    this.validThreshold = true;
    this.mount();
  }

  render() {
    this.$node0 = document.createElement('div');
    this.$node0.className = 'controller hook-resize hook-resize-right resizable hide-animated';
    this.$node0.setAttribute('data-zone-id', this.id);
    this.$parent.appendChild(this.$node0);

    this.$node1 = document.createElement('div');
    this.$node1.className = 'controller hook-resize hook-resize-left resizable hide-animated';
    this.$node1.setAttribute('data-zone-id', this.id);
    this.$parent.appendChild(this.$node1);
  }

  setStretchFactor(stretchFactor) {
    this.ratio = this.stretchFactor + (stretchFactor - 1);
    const isValidStretch = this.ratio >= MIN_STRETCH_FACTOR && this.ratio <= MAX_STRETCH_FACTOR;
    this.ratio = this.ratio < MIN_STRETCH_FACTOR ? MIN_STRETCH_FACTOR : this.ratio;
    this.ratio = this.ratio > MAX_STRETCH_FACTOR ? MAX_STRETCH_FACTOR : this.ratio;

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
}
