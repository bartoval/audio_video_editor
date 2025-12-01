/** Empty state factory - placeholder UI when no video is loaded */
import { createElement, createVisibilityMixin } from '../../../../lib';
import { LABEL } from '../../../../config/constants';
import { CSS_CLASS } from '../../../../config/ui';

export function createEmptyState($parent) {
  let handlers = {};

  const $el = createElement('div', {
    className: CSS_CLASS.VIDEO_EMPTY_STATE,
    html: `
      <i class="bi bi-camera-video fs-1"></i>
      <p>${LABEL.NO_VIDEO}</p>
      <button class="video-import-btn">
        <i class="bi bi-upload"></i>
        <span>${LABEL.IMPORT_VIDEO}</span>
      </button>
    `,
    parent: $parent
  });

  $el.addEventListener('click', event => {
    const $btn = event.target.closest('button');
    if ($btn) {
      handlers.onImport?.();
    }
  });

  return {
    el: $el,
    bind(newHandlers) {
      handlers = newHandlers;
    },
    ...createVisibilityMixin($el)
  };
}
