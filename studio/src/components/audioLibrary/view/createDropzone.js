import { createElement } from '../../../lib';
import { LABEL } from '../../../config/constants';
import { CSS_CLASS } from '../../../config/ui';

export function createDropzone($parent) {
  let handlers = {};

  const $el = createElement('div', {
    className: 'library-drop-zone hide',
    html: `
      <div class="drop-zone-content">
        <i class="bi bi-cloud-arrow-up"></i>
        <p>${LABEL.LIBRARY_DROP_TITLE}</p>
        <span>${LABEL.LIBRARY_DROP_HINT}</span>
      </div>
    `,
    parent: $parent
  });

  $el.addEventListener('click', () => handlers.onClick?.());

  $el.addEventListener('dragover', event => {
    event.preventDefault();
    $el.classList.add(CSS_CLASS.DRAGGING);
  });

  $el.addEventListener('dragleave', () => {
    $el.classList.remove(CSS_CLASS.DRAGGING);
  });

  $el.addEventListener('drop', event => {
    event.preventDefault();
    $el.classList.remove(CSS_CLASS.DRAGGING);
    handlers.onDrop?.(event.dataTransfer);
  });

  return {
    el: $el,
    bind(newHandlers) {
      handlers = newHandlers;
    },
    show() {
      $el.classList.remove(CSS_CLASS.HIDE);
    },
    hide() {
      $el.classList.add(CSS_CLASS.HIDE);
    }
  };
}
