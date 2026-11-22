// @ts-check

/**
 * ScaleManager - Centralized timeline scale management
 *
 * Single source of truth for renderScale (continuous):
 * - init: set duration, available scales, viewport
 * - setScale: clamp and apply new scale
 * - zoom operations: zoomIn, zoomOut, zoomByDelta
 */

import { setScale, setScaleFactor } from '../lib/utils/scale.js';

class ScaleManager {
  #scale = -1;
  #minScale = 0.001;
  #maxScale = 600;
  #duration = 0;
  #maxWidth = 163835;
  #viewportWidth = 0;
  #availableScales = [];
  #filteredScaleList = [];
  #listeners = new Set();
  #initialized = false;

  init({ duration, availableScales, maxWidth, viewportWidth }) {
    if (!duration || duration <= 0) {
      throw new Error('[ScaleManager] Invalid duration: ' + duration);
    }

    this.#duration = duration;
    this.#viewportWidth = viewportWidth || 0;
    this.#availableScales = availableScales || [];

    if (maxWidth) {
      this.#maxWidth = maxWidth;
    }

    this.#calculateLimits();
    this.#buildFilteredScaleList();

    if (this.#filteredScaleList.length === 0) {
      throw new Error('[ScaleManager] No valid scales available within limits');
    }

    this.#initialized = true;

    return this;
  }

  setInitialScale(scale) {
    return this.setScale(scale);
  }

  #calculateLimits() {
    const svgLimitScale = this.#duration / this.#maxWidth;
    const readabilityScale = 0.01;
    this.#minScale = Math.max(
      svgLimitScale,
      Math.min(
        readabilityScale,
        this.#viewportWidth > 0 ? this.#duration / this.#viewportWidth : readabilityScale
      )
    );

    if (this.#viewportWidth > 0) {
      this.#maxScale = this.#duration / this.#viewportWidth;
    } else {
      this.#maxScale = Math.max(10, this.#duration / 100);
    }
  }

  #buildFilteredScaleList() {
    if (!this.#availableScales.length) {
      this.#filteredScaleList = [];

      return;
    }

    const scaleList = [];
    let reachedMax = false;

    for (const scale of this.#availableScales) {
      if (reachedMax) {
        break;
      }

      const width = Math.floor(this.#duration / scale);

      if (width > this.#maxWidth) {
        continue;
      }

      if (this.#viewportWidth > 0 && width < this.#viewportWidth) {
        reachedMax = true;

        continue;
      }

      scaleList.push(scale);
    }

    // Short local clips can be narrower than the viewport at every preset.
    // Keep a fit-to-view scale instead of failing to initialize the editor.
    if (!scaleList.length && reachedMax) scaleList.push(this.#maxScale);
    this.#filteredScaleList = scaleList;
  }

  getScaleList() {
    return [...this.#filteredScaleList];
  }

  setScale(newScale) {
    const clampedScale = this.#clamp(newScale);

    if (clampedScale === this.#scale) {
      return this.#scale;
    }

    this.#scale = clampedScale;

    const width = this.#duration / clampedScale;
    const scaleFactorX = width / this.#duration;

    setScale(clampedScale);
    setScaleFactor(scaleFactorX);

    this.#notifyListeners();

    return this.#scale;
  }

  getScale() {
    return this.#scale;
  }

  getWidth() {
    return this.#duration / this.#scale;
  }

  isInitialized() {
    return this.#initialized;
  }

  getLimits() {
    return {
      min: this.#minScale,
      max: this.#maxScale
    };
  }

  zoomIn(factor = 0.9) {
    return this.setScale(this.#scale * factor);
  }

  zoomOut(factor = 1.1) {
    return this.setScale(this.#scale * factor);
  }

  /**
   * Zoom by a wheel delta in pixels (positive = zoom out).
   *
   * Exponential, not linear: `1 + delta * k` turned zero or negative for fast scrolls
   * (delta <= -1000) and the clamp then jumped straight to the zoom limit; it was also
   * asymmetric (-500 halved the scale, +500 only multiplied it by 1.5).
   * e^(delta * k) is always positive, and equal deltas in and out cancel out.
   * One mouse notch (100px) still zooms by ~10%.
   *
   * @param {number} delta - wheel delta in pixels
   * @param {number} [sensitivity]
   * @returns {number} the new (clamped) scale
   */
  zoomByDelta(delta, sensitivity = 0.001) {
    const factor = Math.exp(delta * sensitivity);

    return this.setScale(this.#scale * factor);
  }

  /**
   * Update duration and recalculate limits
   * @param {number} duration - New duration in seconds
   */
  setDuration(duration) {
    this.#duration = duration;
    this.#calculateLimits();
    this.#buildFilteredScaleList();

    if (this.#scale < this.#minScale) {
      this.setScale(this.#minScale);
    } else if (this.#scale > this.#maxScale) {
      this.setScale(this.#maxScale);
    } else {
      this.#notifyListeners();
    }
  }

  getDuration() {
    return this.#duration;
  }

  #clamp(value) {
    return Math.max(this.#minScale, Math.min(this.#maxScale, value));
  }

  onChange(callback) {
    this.#listeners.add(callback);

    return () => this.#listeners.delete(callback);
  }

  #notifyListeners() {
    const data = {
      scale: this.#scale,
      width: this.getWidth(),
      duration: this.#duration
    };

    this.#listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('[ScaleManager] Listener error:', error);
      }
    });
  }

  reset() {
    this.#scale = -1;
    this.#duration = 0;
    this.#viewportWidth = 0;
    this.#minScale = 0.001;
    this.#maxScale = 600;
    this.#availableScales = [];
    this.#filteredScaleList = [];
    this.#initialized = false;
    this.#listeners.clear();
  }
}

const scaleManager = new ScaleManager();

export default scaleManager;
