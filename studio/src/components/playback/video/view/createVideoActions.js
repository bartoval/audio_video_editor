/** Video actions factory - one "more" button over the video that opens a menu */
import { createElement, createVisibilityMixin } from '../../../../lib';
import { LABEL } from '../../../../config/constants';
import { CSS_CLASS } from '../../../../config/ui';
import { ContextMenu } from '../../../common/ContextMenu';

const MENU_ITEMS = [
  { id: 'change', label: LABEL.CHANGE_VIDEO, icon: 'bi-upload' },
  { id: 'sceneDetect', label: LABEL.SCENE_DETECTION, icon: 'bi-stars' },
  { type: 'divider' },
  { id: 'delete', label: LABEL.DELETE_VIDEO, icon: 'bi-trash', danger: true }
];

export function createVideoActions($parent) {
  let handlers = {};

  // A single solid button keeps the frame readable; destructive actions live in the menu
  const $el = createElement('div', {
    className: `${CSS_CLASS.VIDEO_ACTIONS} ${CSS_CLASS.HIDE}`,
    html: `
      <button class="video-menu-btn" title="${LABEL.VIDEO_OPTIONS}" aria-label="${LABEL.VIDEO_OPTIONS}" aria-haspopup="menu">
        <i class="bi bi-three-dots"></i>
      </button>
    `,
    parent: $parent
  });

  const $btn = $el.querySelector('.video-menu-btn');
  const menu = new ContextMenu(MENU_ITEMS);

  const actions = {
    change: () => handlers.onChange?.(),
    sceneDetect: () => handlers.onSceneDetect?.(),
    delete: () => handlers.onDelete?.()
  };

  $btn.addEventListener('click', event => {
    event.stopPropagation();
    menu.show($btn, id => actions[id]?.());
  });

  return {
    el: $el,
    bind(newHandlers) {
      handlers = newHandlers;
    },
    ...createVisibilityMixin($el)
  };
}
