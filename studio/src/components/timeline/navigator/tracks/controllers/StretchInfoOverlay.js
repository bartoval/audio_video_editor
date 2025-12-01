/**
 * StretchInfoOverlay - Shows stretch factor and duration during resize
 * Similar to CutZoneController pattern
 */

import View from '../../../../../lib/ui/mvp/View.js';
import { formatDuration } from '../../../../../lib/utils/format.js';

export default class StretchInfoOverlay extends View {
  #originalDuration = 0;

  constructor(config, $parent) {
    super($parent);
    this.#originalDuration = config.originalDuration || 0;
    this.render();
  }

  template() {
    return `
			<div class="stretch-info-overlay">
				<div class="stretch-factor"></div>
				<div class="stretch-duration-comparison">
					<div class="original-duration"></div>
					<div class="arrow">→</div>
					<div class="new-duration"></div>
				</div>
				<div class="stretch-progress-bar">
					<div class="stretch-progress-fill"></div>
				</div>
			</div>
		`;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);
  }

  /**
   * Update stretch info during drag
   * @param {number} stretchFactor - Current stretch factor (0.5 - 2.0)
   * @param {number} newDuration - New duration in seconds
   */
  update(stretchFactor, newDuration) {
    const $factor = this.$node.querySelector('.stretch-factor');
    const $original = this.$node.querySelector('.original-duration');
    const $new = this.$node.querySelector('.new-duration');
    const $fill = this.$node.querySelector('.stretch-progress-fill');

    const factorText = `${stretchFactor.toFixed(2)}x`;
    $factor.textContent = factorText;

    if (stretchFactor < 1) {
      $factor.className = 'stretch-factor compress';
    } else if (stretchFactor > 1) {
      $factor.className = 'stretch-factor stretch';
    } else {
      $factor.className = 'stretch-factor';
    }

    $original.textContent = formatDuration(this.#originalDuration);
    $new.textContent = formatDuration(newDuration);

    const progressPercent = ((stretchFactor - 0.5) / 1.5) * 100;
    $fill.style.width = `${Math.max(0, Math.min(100, progressPercent))}%`;
  }

  /**
   * Show overlay
   */
  show() {
    this.$node.classList.add('visible');
  }

  /**
   * Hide overlay
   */
  hide() {
    this.$node.classList.remove('visible');
  }

  /**
   * Set original duration (for recalculations)
   * @param {number} duration - Duration in seconds
   */
  setOriginalDuration(duration) {
    this.#originalDuration = duration;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.$node?.remove();
  }
}
