import { getTimeFromPosX } from '../../../../lib';

/**
 * CutService - Handles track cutting state machine
 *
 * Manages the two-click cut workflow:
 * 1. First click sets start position
 * 2. Mouse move shows preview
 * 3. Second click executes cut
 *
 * The actual cut execution is delegated to the container.
 */
export default class CutService {
  #currentZone = null;

  constructor() {
    this.isCutMode = false;
    this.cutStartTime = null;
  }

  /**
   * Start cut mode for a zone
   * @param {Object} zone - The zone to cut
   * @returns {boolean}
   */
  start(zone) {
    if (!zone) {
      return false;
    }

    this.isCutMode = true;
    this.cutStartTime = null;
    this.#currentZone = zone;
    zone.getRoot().classList.add('cut-mode');

    return true;
  }

  /**
   * Cancel cut mode
   * @returns {boolean}
   */
  cancel() {
    if (this.#currentZone) {
      this.#currentZone.getRoot().classList.remove('cut-mode');
      this.#currentZone.hideCutZone();
    }

    this.isCutMode = false;
    this.cutStartTime = null;
    this.#currentZone = null;

    return true;
  }

  /**
   * Handle click during cut mode
   * @param {number} posX - Click position in pixels
   * @returns {{ action: 'setStart' | 'execute', cutStart?: number, cutEnd?: number } | false}
   */
  handleClick(posX) {
    if (!this.#currentZone || !this.isCutMode) {
      return false;
    }

    const clickTime = getTimeFromPosX(posX);
    const trackStart = this.#currentZone.getStart();
    const trackEnd = this.#currentZone.getEnd();

    // Check if click is within track bounds
    if (clickTime < trackStart || clickTime > trackEnd) {
      return false;
    }

    const relativeTime = clickTime - trackStart;

    if (this.cutStartTime === null) {
      // First click - set start position
      this.cutStartTime = relativeTime;
      this.#currentZone.showCutZone(relativeTime, 0);

      return { action: 'setStart', time: relativeTime };
    }

    // Second click - return cut boundaries
    const cutEndTime = relativeTime;
    const cutStart = Math.min(this.cutStartTime, cutEndTime);
    const cutEnd = Math.max(this.cutStartTime, cutEndTime);

    return { action: 'execute', cutStart, cutEnd, zone: this.#currentZone };
  }

  /**
   * Update cut zone preview during mouse move
   * @param {number} posX - Mouse position in pixels
   * @returns {boolean}
   */
  updatePreview(posX) {
    if (!this.#currentZone || !this.isCutMode || this.cutStartTime === null) {
      return false;
    }

    const moveTime = getTimeFromPosX(posX);
    const trackStart = this.#currentZone.getStart();
    const relativeTime = Math.max(0, moveTime - trackStart);
    const duration = relativeTime - this.cutStartTime;

    this.#currentZone.updateCutZone(this.cutStartTime, duration);

    return true;
  }

  /**
   * Check if currently in cut mode
   * @returns {boolean}
   */
  isActive() {
    return this.isCutMode;
  }

  /**
   * Check if first cut point is set
   * @returns {boolean}
   */
  hasStartPoint() {
    return this.cutStartTime !== null;
  }

  /**
   * Get the zone being cut
   * @returns {Object|null}
   */
  getZone() {
    return this.#currentZone;
  }
}
