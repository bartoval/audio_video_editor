/** Quality badge factory - indicates low quality offline video */
import { createElement, createVisibilityMixin } from '../../../../lib';
import { LABEL } from '../../../../config/constants';
import { CSS_CLASS } from '../../../../config/ui';

export function createQualityBadge($parent) {
  const $el = createElement('div', {
    className: `${CSS_CLASS.VIDEO_QUALITY_BADGE} ${CSS_CLASS.HIDE}`,
    html: `<i class="bi bi-image"></i> ${LABEL.VIDEO_LOW_QUALITY}`,
    parent: $parent
  });

  return {
    el: $el,
    ...createVisibilityMixin($el)
  };
}
