/** Timer factory - displays current time, duration, and aspect ratio */
import { createElement } from '../../../lib';
import { formatAspectRatio } from '../../../lib/utils/format';

const formatTime = time => {
  if (time === null || time === undefined || isNaN(time)) {
    return '--:--.--';
  }

  const sec = Math.floor(time) % 60;
  const min = Math.floor(time / 60) % 60;
  const ms = Math.floor((time * 100) % 100);

  const secStr = sec < 10 ? '0' + sec : String(sec);
  const minStr = min < 10 ? '0' + min : String(min);
  const msStr = ms < 10 ? '0' + ms : String(ms);

  return `${minStr}:${secStr}.${msStr}`;
};

export function createTimer($parent) {
  let lastTimeFormatted = '';

  const $el = createElement('div', {
    className: 'd-flex align-items-center gap-3',
    attrs: { role: 'timer', 'aria-live': 'polite', 'aria-atomic': 'true' },
    html: `
      <span data-ref="ratio" class="ratio-badge" aria-label="Aspect ratio"></span>
      <div class="d-flex align-items-baseline timer-display">
        <span data-ref="time" class="timer-current fw-medium" aria-label="Current time">--:--.--</span>
        <span data-ref="duration" class="timer-duration text-secondary ms-2" aria-label="Total duration">/ --:--.--</span>
      </div>
    `,
    parent: $parent
  });

  const $ratio = $el.querySelector('[data-ref="ratio"]');
  const $time = $el.querySelector('[data-ref="time"]');
  const $duration = $el.querySelector('[data-ref="duration"]');

  return {
    el: $el,

    setState(state) {
      if (state.currentTime !== undefined) {
        const formatted = formatTime(state.currentTime);

        if (formatted !== lastTimeFormatted) {
          lastTimeFormatted = formatted;
          $time.textContent = formatted;
        }
      }

      if (state.duration !== undefined) {
        $duration.textContent = '/ ' + formatTime(state.duration);
      }

      if (state.aspectRatio !== undefined) {
        $ratio.textContent = formatAspectRatio(state.aspectRatio);
      }
    },

    destroy() {
      $el.remove();
    }
  };
}
