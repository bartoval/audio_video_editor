/**
 * SuperZoomController - Manages SuperZoom popup for a track
 * Uses waveform data for SuperZoom popup
 */

import { getScale } from '../../../../../lib';
import * as SuperZoomService from '../../../../../services/SuperZoomService';
import SuperZoomPopup from '../views/SuperZoomPopup';

const DEBOUNCE_MS = 50;

export default class SuperZoomController {
  #$target = null;
  #blob = null;
  #getTrackInfo = null;
  #getTimeFromClientX = null;
  #waveformData = null;
  #waveformWindow = null;
  #currentMagnification = null;
  #isHovering = false;
  #isLoading = false;
  #unsubscribe = null;
  #rafId = null;
  #pendingEvent = null;
  #lastEvent = null;
  #debounceTimer = null;

  /**
   * @param {HTMLElement} $target - Element to attach mouse listeners (zone-content)
   * @param {import('@types').AudioInstance} blob - Audio blob with waveform data
   * @param {Function} getTrackInfo - Returns { startTime, duration }
   */
  constructor($target, blob, getTrackInfo) {
    this.#$target = $target;
    this.#blob = blob;
    this.#getTrackInfo = getTrackInfo;

    this.#bindEvents();
    this.#unsubscribe = SuperZoomService.onChange(this.#handleServiceChange);
  }

  #bindEvents() {
    this.#$target.addEventListener('mouseenter', this.#handleMouseEnter);
    this.#$target.addEventListener('mouseleave', this.#handleMouseLeave);
    this.#$target.addEventListener('mousemove', this.#handleMouseMove);
  }

  #handleServiceChange = state => {
    if (!state.isEnabled && this.#isHovering) {
      this.#hidePopup();
    }

    if (state.isEnabled && this.#currentMagnification !== state.magnification) {
      this.invalidateWaveform();
    }
  };

  #handleMouseEnter = event => {
    this.#isHovering = true;

    if (SuperZoomService.isActive()) {
      this.#triggerImmediateLoad(event);
    }
  };

  #triggerImmediateLoad(event) {
    this.#lastEvent = event;
    this.#pendingEvent = event;

    const centerTime = this.#getTimeFromEvent(event);

    if (centerTime !== null) {
      this.#loadWaveformTiles(centerTime);
    }
  }

  #handleMouseLeave = () => {
    this.#isHovering = false;
    this.#hidePopup();
    this.#clearDebounce();
  };

  #handleMouseMove = event => {
    if (!SuperZoomService.isActive() || !this.#isHovering) {
      return;
    }

    this.#pendingEvent = event;
    this.#lastEvent = event;

    if (!this.#rafId) {
      this.#rafId = requestAnimationFrame(this.#flushMouseMove);
    }

    this.#scheduleWaveformLoad(event);
  };

  #scheduleWaveformLoad(event) {
    this.#clearDebounce();

    this.#debounceTimer = setTimeout(() => {
      if (!this.#isHovering || !SuperZoomService.isActive()) {
        return;
      }

      const centerTime = this.#getTimeFromEvent(event);

      if (centerTime !== null) {
        this.#loadWaveformTiles(centerTime);
      }
    }, DEBOUNCE_MS);
  }

  #clearDebounce() {
    if (this.#debounceTimer) {
      clearTimeout(this.#debounceTimer);
      this.#debounceTimer = null;
    }
  }

  #flushMouseMove = () => {
    this.#rafId = null;

    if (!this.#pendingEvent) {
      return;
    }

    const event = this.#pendingEvent;
    this.#pendingEvent = null;

    const trackInfo = this.#getTrackInfo();

    if (!trackInfo) {
      return;
    }

    const centerTime = this.#getTimeFromEvent(event);

    if (centerTime === null) {
      return;
    }

    const popup = SuperZoomService.getOrCreatePopup(SuperZoomPopup);
    SuperZoomService.setActiveController(this);

    popup.show(
      event.clientX,
      event.clientY,
      centerTime,
      this.#waveformData,
      trackInfo.duration,
      trackInfo.startTime,
      this.#waveformWindow
    );
  };

  /** @param {Function} fn */
  setTimeCalculator(fn) {
    this.#getTimeFromClientX = fn;
  }

  /** @param {MouseEvent} event */
  #getTimeFromEvent(event) {
    if (!this.#getTimeFromClientX) {
      return null;
    }

    return this.#getTimeFromClientX(event.clientX);
  }

  /**
   * Load waveform tiles for the visible window around centerTime
   * @param {number} centerTime - Center time in absolute timeline seconds
   */
  async #loadWaveformTiles(centerTime) {
    if (this.#isLoading) {
      return;
    }

    const trackInfo = this.#getTrackInfo();

    if (!trackInfo) {
      return;
    }

    const config = SuperZoomService.getConfig();
    const { windowSize, magnification } = config;
    const halfWindow = windowSize / 2;

    const localCenterTime = centerTime - trackInfo.startTime;
    const windowStart = Math.max(0, localCenterTime - halfWindow);
    const windowEnd = Math.min(trackInfo.duration, localCenterTime + halfWindow);

    if (this.#isWindowCached(windowStart, windowEnd, magnification)) {
      return;
    }

    this.#isLoading = true;

    try {
      // Increase resolution for SuperZoom by using a smaller scale (more samples)
      const baseScale = getScale();
      // Increase resolution for SuperZoom while keeping alignment reasonable
      const scale = Math.max(0.0001, baseScale / (magnification * 4));
      const data = await this.#blob.getWaveForm(scale);
      this.#waveformData = data.path;
      // Use actual buffer duration from waveform data, not logical track duration
      // This ensures waveform data aligns correctly with visual display
      const actualDuration = data.duration || trackInfo.duration;
      this.#waveformWindow = { start: 0, end: actualDuration };
      this.#currentMagnification = magnification;

      this.#refreshPopupIfVisible();
    } catch (err) {
      console.error('[SuperZoomController] Failed to load waveform:', err);
    } finally {
      this.#isLoading = false;
    }
  }

  #refreshPopupIfVisible() {
    if (!this.#isHovering || !SuperZoomService.isActive() || !this.#lastEvent) {
      return;
    }

    this.#pendingEvent = this.#lastEvent;

    if (!this.#rafId) {
      this.#rafId = requestAnimationFrame(this.#flushMouseMove);
    }
  }

  /**
   * Check if current window is already cached
   * #waveformWindow now contains the actual bounds of loaded tiles (including buffer)
   * @param {number} windowStart
   * @param {number} windowEnd
   * @param {number} magnification
   * @returns {boolean}
   */
  #isWindowCached(windowStart, windowEnd, magnification) {
    if (!this.#waveformWindow || !this.#waveformData) {
      return false;
    }

    if (this.#currentMagnification !== magnification) {
      return false;
    }

    return windowStart >= this.#waveformWindow.start && windowEnd <= this.#waveformWindow.end;
  }

  #hidePopup() {
    SuperZoomService.hidePopupFor(this);

    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }

    this.#pendingEvent = null;
    this.#clearDebounce();
  }

  /** Force reload waveform data on scale/magnification change */
  invalidateWaveform() {
    this.#waveformData = null;
    this.#waveformWindow = null;
    this.#currentMagnification = null;
  }

  destroy() {
    this.#hidePopup();
    this.#clearDebounce();

    if (this.#unsubscribe) {
      this.#unsubscribe();
      this.#unsubscribe = null;
    }

    this.#$target.removeEventListener('mouseenter', this.#handleMouseEnter);
    this.#$target.removeEventListener('mouseleave', this.#handleMouseLeave);
    this.#$target.removeEventListener('mousemove', this.#handleMouseMove);

    this.#$target = null;
    this.#blob = null;
    this.#getTrackInfo = null;
    this.#waveformData = null;
    this.#waveformWindow = null;
    this.#lastEvent = null;
  }
}
