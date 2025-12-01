/** Resize handle factory - drag handle for video container resizing */
import { createElement } from '../../../../lib';
import { LABEL } from '../../../../config/constants';
import { RESIZE_BOUNDS, CSS_CLASS } from '../../../../config/ui';
import * as EventService from '../../../../services/EventService';

export function createResizer($parent, getContainerRect) {
  let rafId = null;
  let initialOffset = 0;

  const $el = createElement('div', {
    className: CSS_CLASS.VIDEO_RESIZER,
    attributes: { title: LABEL.RESIZE_VIDEO },
    html: '<i class="bi bi-arrows-angle-expand"></i>',
    parent: $parent
  });

  const handleMouseMove = event => {
    event.stopPropagation();
    event.preventDefault();

    if (rafId) {
      cancelAnimationFrame(rafId);
    }

    rafId = requestAnimationFrame(() => {
      const rect = getContainerRect();
      const newHeight = event.clientY - rect.top - initialOffset;
      const minHeight = window.innerHeight * RESIZE_BOUNDS.minHeightPercent;

      if (newHeight >= minHeight) {
        EventService.emitLocal('layout:resize', { height: newHeight });
      }

      rafId = null;
    });
  };

  const handleMouseUp = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('mouseup', handleMouseUp, true);
  };

  $el.addEventListener('mousedown', event => {
    event.preventDefault();
    const rect = getContainerRect();
    initialOffset = event.clientY - rect.bottom;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'nwse-resize';
    document.addEventListener('mouseup', handleMouseUp, true);
    document.addEventListener('mousemove', handleMouseMove, true);
  });

  return { el: $el };
}
