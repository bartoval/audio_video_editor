import { getTimeFormatted } from '../../../lib';

/**
 * TimeTooltip - Centralized tooltip for navigator time display
 * Shows current time position, and track details when hovering over a track
 */
export default class TimeTooltip {
  #$tooltip = null;
  #$tooltipTitle = null;
  #$tooltipCurrent = null;
  #$tooltipStart = null;
  #$tooltipEnd = null;
  #$tooltipDuration = null;
  #isVisible = false;

  constructor() {
    this.#create();
  }

  #create() {
    this.#$tooltip = document.createElement('div');
    this.#$tooltip.className = 'glass-tooltip time-tooltip';
    // Compact chip: the time first; on a clip, a second line with its name and range.
    this.#$tooltip.innerHTML = `
      <div class="tooltip-current-row"><span class="tooltip-current"></span></div>
      <div class="tooltip-details">
        <span class="tooltip-title"></span>
        <span class="tooltip-range"><span class="tooltip-start"></span>–<span class="tooltip-end"></span> · <span class="tooltip-duration"></span></span>
      </div>
    `;
    document.body.appendChild(this.#$tooltip);

    this.#$tooltipTitle = this.#$tooltip.querySelector('.tooltip-title');
    this.#$tooltipCurrent = this.#$tooltip.querySelector('.tooltip-current');
    this.#$tooltipStart = this.#$tooltip.querySelector('.tooltip-start');
    this.#$tooltipEnd = this.#$tooltip.querySelector('.tooltip-end');
    this.#$tooltipDuration = this.#$tooltip.querySelector('.tooltip-duration');
  }

  /**
   * Show tooltip with time only (ruler/markers hover)
   * @param {number} time - Current time in seconds
   * @param {number} clientX - Mouse X position
   * @param {number} clientY - Mouse Y position
   */
  showTime(time, clientX, clientY) {
    this.#$tooltipTitle.textContent = '';
    this.#$tooltipCurrent.textContent = getTimeFormatted(time);
    this.#$tooltip.classList.add('time-only');

    this.#position(clientX, clientY);
    this.#show();
  }

  /**
   * Show tooltip with track details
   * @param {Object} track - Track object with getLabel, getStart, getEnd, getDuration
   * @param {number} time - Current time in seconds
   * @param {number} clientX - Mouse X position
   * @param {number} clientY - Mouse Y position
   */
  showTrack(track, time, clientX, clientY) {
    this.#$tooltipTitle.textContent = track.getLabel() || 'Track';
    this.#$tooltipCurrent.textContent = getTimeFormatted(time);
    this.#$tooltipStart.textContent = getTimeFormatted(track.getStart());
    this.#$tooltipEnd.textContent = getTimeFormatted(track.getEnd());
    this.#$tooltipDuration.textContent = getTimeFormatted(track.getDuration());
    this.#$tooltip.classList.remove('time-only');

    this.#position(clientX, clientY);
    this.#show();
  }

  /**
   * Update position without changing content
   * @param {number} clientX - Mouse X position
   * @param {number} clientY - Mouse Y position
   */
  updatePosition(clientX, clientY) {
    this.#position(clientX, clientY);
  }

  /**
   * Hide tooltip
   */
  hide() {
    this.#$tooltip.classList.remove('visible');
    this.#isVisible = false;
  }

  /**
   * Check if tooltip is visible
   */
  isVisible() {
    return this.#isVisible;
  }

  #position(clientX, clientY) {
    this.#$tooltip.style.left = clientX + 15 + 'px';
    this.#$tooltip.style.top = clientY + 15 + 'px';
  }

  #show() {
    this.#$tooltip.classList.add('visible');
    this.#isVisible = true;
  }

  destroy() {
    this.#$tooltip?.remove();
    this.#$tooltip = null;
    this.#$tooltipTitle = null;
    this.#$tooltipCurrent = null;
    this.#$tooltipStart = null;
    this.#$tooltipEnd = null;
    this.#$tooltipDuration = null;
  }
}
