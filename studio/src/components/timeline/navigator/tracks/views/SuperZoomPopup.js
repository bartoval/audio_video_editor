/**
 * SuperZoomPopup - Magnified waveform preview popup
 */

import { View, drawWaveformWindow } from '../../../../../lib';
import { formatDuration } from '../../../../../lib/utils/format';
import * as SuperZoomService from '../../../../../services/SuperZoomService';

export default class SuperZoomPopup extends View {
  #$canvas = null;
  #$cursor = null;
  #$timeLabel = null;
  #$windowLabel = null;
  #ctx = null;
  #isVisible = false;
  #rafId = null;
  #pendingUpdate = null;
  #dpr = 1;
  #cssWidth = 0;
  #cssHeight = 0;

  constructor() {
    super(document.body);
  }

  render() {
    const config = SuperZoomService.getConfig();

    this.#dpr = window.devicePixelRatio || 1;
    this.#cssWidth = config.popupWidth;
    this.#cssHeight = config.popupHeight;

    const canvasWidth = this.#cssWidth * this.#dpr;
    const canvasHeight = this.#cssHeight * this.#dpr;

    this.$node = document.createElement('div');
    this.$node.className = 'superzoom-popup hide';
    this.$node.innerHTML = `
      <div class="superzoom-header">
        <span class="superzoom-time">00:00.000</span>
        <span class="superzoom-window">±${(config.windowSize / 2).toFixed(2)}s</span>
      </div>
      <div class="superzoom-canvas-container">
        <canvas class="superzoom-canvas" width="${canvasWidth}" height="${canvasHeight}" style="width: ${this.#cssWidth}px; height: ${this.#cssHeight}px;"></canvas>
        <div class="superzoom-cursor"></div>
      </div>
    `;

    this.#$canvas = this.$node.querySelector('.superzoom-canvas');
    this.#$cursor = this.$node.querySelector('.superzoom-cursor');
    this.#$timeLabel = this.$node.querySelector('.superzoom-time');
    this.#$windowLabel = this.$node.querySelector('.superzoom-window');
    this.#ctx = this.#$canvas.getContext('2d');

    this.#ctx.scale(this.#dpr, this.#dpr);

    this.$parent.appendChild(this.$node);
  }

  /**
   * Show popup at cursor position with waveform data
   * @param {number} clientX - Mouse X position
   * @param {number} clientY - Mouse Y position
   * @param {number} centerTime - Time in seconds at cursor
   * @param {Array} waveformData - Waveform points { x, y }
   * @param {number} duration - Total track duration
   * @param {number} trackStartTime - Track start time offset
   * @param {{start: number, end: number}|null} dataWindow - Time bounds of waveformData
   */
  show(
    clientX,
    clientY,
    centerTime,
    waveformData,
    duration,
    trackStartTime = 0,
    dataWindow = null
  ) {
    if (!SuperZoomService.isActive()) {
      return;
    }

    this.#pendingUpdate = {
      clientX,
      clientY,
      centerTime,
      waveformData,
      duration,
      trackStartTime,
      dataWindow
    };

    if (!this.#rafId) {
      this.#rafId = requestAnimationFrame(this.#flush);
    }
  }

  #flush = () => {
    this.#rafId = null;

    if (!this.#pendingUpdate) {
      return;
    }

    const { clientX, clientY, centerTime, waveformData, duration, trackStartTime, dataWindow } =
      this.#pendingUpdate;
    this.#pendingUpdate = null;

    const config = SuperZoomService.getConfig();
    const halfWindow = config.windowSize / 2;

    const localTime = centerTime - trackStartTime;
    const windowStart = Math.max(0, localTime - halfWindow);
    const windowEnd = Math.min(duration, localTime + halfWindow);
    const windowDuration = windowEnd - windowStart;

    const cursorRatio = windowDuration > 0 ? (localTime - windowStart) / windowDuration : 0.5;
    this.#$cursor.style.left = `${cursorRatio * 100}%`;

    this.#$timeLabel.textContent = formatDuration(centerTime);
    this.#$windowLabel.textContent = `±${halfWindow.toFixed(2)}s`;

    this.#drawWaveform(waveformData, windowStart, windowEnd, duration, dataWindow);
    this.#position(clientX, clientY);

    if (!this.#isVisible) {
      this.$node.classList.remove('hide');
      this.#isVisible = true;
    }
  };

  #drawWaveform(waveformData, windowStart, windowEnd, duration, dataWindow = null) {
    drawWaveformWindow(this.#ctx, waveformData, {
      width: this.#cssWidth,
      height: this.#cssHeight,
      windowStart,
      windowEnd,
      dataStart: dataWindow?.start,
      dataEnd: dataWindow?.end,
      duration
    });
  }

  #position(clientX, clientY) {
    const config = SuperZoomService.getConfig();
    const rect = this.$node.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = clientX + config.offsetX;
    let top = clientY + config.offsetY;

    if (left + rect.width > viewportWidth - 10) {
      left = clientX - rect.width - config.offsetX;
    }

    if (left < 10) {
      left = 10;
    }

    if (top + rect.height > viewportHeight - 10) {
      top = viewportHeight - rect.height - 10;
    }

    if (top < 10) {
      top = 10;
    }

    this.$node.style.left = `${left}px`;
    this.$node.style.top = `${top}px`;
  }

  hide() {
    if (!this.#isVisible) {
      return;
    }

    this.$node.classList.add('hide');
    this.#isVisible = false;
    this.#pendingUpdate = null;

    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
  }

  getIsVisible() {
    return this.#isVisible;
  }

  onDestroy() {
    this.hide();
    this.#$canvas = null;
    this.#$cursor = null;
    this.#ctx = null;

    super.onDestroy();
  }
}
