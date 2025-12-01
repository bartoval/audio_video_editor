import { createElement } from '../../../lib';
import { LABEL } from '../../../config/constants';
import { CSS_CLASS } from '../../../config/ui';

export function createOfflineOverlay($parent) {
  const $el = createElement('div', {
    className: 'library-offline-overlay',
    html: `
      <i class="bi bi-wifi-off offline-icon"></i>
      <span class="offline-label">${LABEL.LIBRARY_OFFLINE}</span>
      <span class="offline-hint">${LABEL.LIBRARY_OFFLINE_HINT}</span>
    `,
    parent: $parent
  });

  return {
    el: $el,
    show() {
      $el.classList.add(CSS_CLASS.VISIBLE);
    },
    hide() {
      $el.classList.remove(CSS_CLASS.VISIBLE);
    }
  };
}
