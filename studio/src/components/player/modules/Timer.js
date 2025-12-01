/**
 * Created by valerio bartolini.
 */

// ============================================================================
// Private methods
// ============================================================================

/**
 * Retrieve a timestamp formatted (min:sec:ms)
 * @param time (sec)
 * @returns {string}
 */
let _getTimeFormatted = time => {
  let sec = ~~time % 60,
    min = ~~(time / 60) % 60,
    ms = ~~(time * 100) % 100;

  sec = sec < 10 ? '0' + sec.toFixed(0) : sec.toFixed(0);
  min = min < 10 ? '0' + min.toFixed(0) : min.toFixed(0);
  ms = ms < 10 ? '0' + ms.toFixed(0) : ms.toFixed(0);

  return min + ':' + sec + '.' + ms;
};

// ============================================================================
// Class
// ============================================================================

export default class Timer {
  constructor($parent) {
    this.$node = null;
    this.$time = null;
    this.$duration = null;
    this.$displayRatio = null;
    this.duration = 0;
    this.displayRatio = '';
    this.render($parent);
  }

  /**
   * @param duration
   * @param metaInfo
   * @returns {boolean}
   */
  init(duration, metaInfo) {
    this.duration = duration;
    this.displayRatio = metaInfo.displayAspectRatio;
    this.$displayRatio.textContent = this.displayRatio;
    this.$time.textContent = _getTimeFormatted(0);
    this.$duration.textContent = '/ ' + _getTimeFormatted(duration);

    return true;
  }

  /**
   * @param time
   */
  update(time) {
    this.$time.textContent = _getTimeFormatted(time);

    return true;
  }

  render($parent) {
    // Display ratio badge
    this.$displayRatio = document.createElement('span');
    this.$displayRatio.className = 'badge text-bg-secondary me-3';
    $parent.appendChild(this.$displayRatio);

    // Timer container
    this.$node = document.createElement('div');
    this.$node.className = 'd-flex align-items-center font-monospace';
    $parent.appendChild(this.$node);

    // Current time
    this.$time = document.createElement('span');
    this.$time.className = 'text-body';
    this.$time.textContent = '00:00.00';
    this.$node.appendChild(this.$time);

    // Duration
    this.$duration = document.createElement('span');
    this.$duration.className = 'text-body-tertiary ms-1';
    this.$duration.textContent = '/ 00:00.00';
    this.$node.appendChild(this.$duration);
  }
}
