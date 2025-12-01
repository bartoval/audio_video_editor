/** Scrubber factory - timeline slider */
import { createElement, applyTransform3d, clamp } from '../../../lib';

export function createScrubber($parent) {
  let handlers = {};

  const state = {
    duration: 0,
    currentTime: 0,
    isScrubbing: false,
    disabled: false
  };

  const layout = {
    width: 0,
    handleSize: 0,
    offsetLeft: 0,
    scaleFactor: 0,
    lastPosX: 0
  };

  const $el = createElement('div', {
    className: 'scrubber-track flex-grow-1',
    html: `
      <div data-ref="bar" class="scrubber-bar"></div>
      <div data-ref="handle" class="scrubber-handle"></div>
    `,
    parent: $parent
  });

  const $bar = $el.querySelector('[data-ref="bar"]');
  const $handle = $el.querySelector('[data-ref="handle"]');

  const recalculateLayout = () => {
    layout.width = $bar.offsetWidth;
    layout.handleSize = $handle.offsetWidth;
    layout.scaleFactor = state.duration > 0 ? layout.width / state.duration : 0;
    layout.offsetLeft = $bar.getBoundingClientRect().left;
  };

  const updateHandlePosition = () => {
    const posX = clamp(state.currentTime * layout.scaleFactor, 0, layout.width);

    const halfHandle = layout.handleSize / 2;
    const handlePos = clamp(posX - halfHandle, 0, layout.width - layout.handleSize);

    applyTransform3d($handle, handlePos, 0, 0);
  };

  const posXToTime = posX => {
    if (!isFinite(layout.scaleFactor) || layout.scaleFactor === 0) {
      return 0;
    }

    const clampedPos = clamp(posX, 0, layout.width);

    return clampedPos / layout.scaleFactor;
  };

  const handleMouseDown = event => {
    if (state.disabled) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();

    state.isScrubbing = true;
    $el.classList.add('is-scrubbing');

    recalculateLayout();
    handleDragMove(event);

    document.addEventListener('mousemove', handleDragMove, false);
    document.addEventListener('mouseup', handleDragEnd, false);
  };

  const handleDragMove = event => {
    layout.lastPosX = clamp(event.clientX - layout.offsetLeft, 0, layout.width);
    const time = posXToTime(layout.lastPosX);

    const halfHandle = layout.handleSize / 2;
    const handlePos = clamp(layout.lastPosX - halfHandle, 0, layout.width - layout.handleSize);

    applyTransform3d($handle, handlePos, 0, 0);
    handlers.onScrubbing?.(time);
  };

  const handleDragEnd = () => {
    const time = posXToTime(clamp(layout.lastPosX, 0, layout.width));

    state.isScrubbing = false;
    state.currentTime = time;

    $el.classList.remove('is-scrubbing');

    document.removeEventListener('mousemove', handleDragMove, false);
    document.removeEventListener('mouseup', handleDragEnd, false);

    handlers.onScrub?.(time);
  };

  $el.addEventListener('mousedown', handleMouseDown);

  return {
    el: $el,

    bind(newHandlers) {
      handlers = newHandlers;
    },

    setState(newState) {
      if (newState.duration !== undefined) {
        const dur = isFinite(newState.duration) && newState.duration > 0 ? newState.duration : 0;

        state.duration = dur;
        recalculateLayout();
      }

      if (newState.currentTime !== undefined && !state.isScrubbing) {
        const time = isFinite(newState.currentTime) ? newState.currentTime : 0;

        state.currentTime = clamp(time, 0, state.duration);
        updateHandlePosition();
      }

      if (newState.disabled !== undefined) {
        state.disabled = newState.disabled;

        $el.classList.toggle('is-disabled', state.disabled);

        if (state.disabled && state.isScrubbing) {
          state.isScrubbing = false;
          $el.classList.remove('is-scrubbing');

          document.removeEventListener('mousemove', handleDragMove, false);
          document.removeEventListener('mouseup', handleDragEnd, false);
        }
      }
    },

    resize() {
      recalculateLayout();
      updateHandlePosition();

      return true;
    },

    destroy() {
      $el.removeEventListener('mousedown', handleMouseDown);

      document.removeEventListener('mousemove', handleDragMove, false);
      document.removeEventListener('mouseup', handleDragEnd, false);

      $el.remove();
    }
  };
}
