/** Video actions factory - action buttons displayed when video is loaded */
import { createElement, createVisibilityMixin } from '../../../../lib';
import { LABEL } from '../../../../config/constants';
import { CSS_CLASS } from '../../../../config/ui';

export function createVideoActions($parent) {
  let handlers = {};

  const $el = createElement('div', {
    className: `${CSS_CLASS.VIDEO_ACTIONS} ${CSS_CLASS.HIDE}`,
    html: `
      <button class="video-action-btn video-change-btn" title="${LABEL.CHANGE_VIDEO}">
        <i class="bi bi-upload"></i>
      </button>
      <button class="video-action-btn video-scene-detect-btn" title="${LABEL.SCENE_DETECTION}">
        <i class="bi bi-scissors"></i>
      </button>
      <button class="video-action-btn video-delete-btn" title="${LABEL.DELETE_VIDEO}">
        <i class="bi bi-trash"></i>
      </button>
    `,
    parent: $parent
  });

  $el.addEventListener('click', event => {
    const $btn = event.target.closest('button');
    if (!$btn) return;

    if ($btn.classList.contains('video-delete-btn')) {
      handlers.onDelete?.();
    } else if ($btn.classList.contains('video-scene-detect-btn')) {
      handlers.onSceneDetect?.();
    } else {
      handlers.onChange?.();
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
