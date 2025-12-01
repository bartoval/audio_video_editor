/** Offline overlay factory - displayed when video unavailable offline */
import { createElement, createVisibilityMixin } from '../../../../lib';
import { LABEL } from '../../../../config/constants';
import { CSS_CLASS } from '../../../../config/ui';

export function createOfflineOverlay($parent) {
  const $el = createElement('div', {
    className: `${CSS_CLASS.VIDEO_OFFLINE_OVERLAY} ${CSS_CLASS.HIDE}`,
    html: `
      <div class="video-offline-content">
        <i class="bi bi-cloud-slash"></i>
        <span>${LABEL.VIDEO_OFFLINE}</span>
      </div>
    `,
    parent: $parent
  });

  return {
    el: $el,
    ...createVisibilityMixin($el)
  };
}
