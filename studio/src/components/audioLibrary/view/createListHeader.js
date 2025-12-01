import { createElement } from '../../../lib';
import { LABEL } from '../../../config/constants';
import { CSS_CLASS } from '../../../config/ui';

export function createListHeader($parent) {
  let handlers = {};

  const $el = createElement('div', {
    className:
      'library-list-header d-flex align-items-center justify-content-between py-3 border-bottom',
    html: `
      <small class="text-body-secondary">
        <span class="library-count">0</span> ${LABEL.LIBRARY_TRACKS}
        <span class="library-selected-count text-info ms-2"></span>
      </small>
      <button class="btn btn-sm btn-outline-info library-select-all text-nowrap">${LABEL.LIBRARY_SELECT_ALL}</button>
    `,
    parent: $parent
  });

  const $count = $el.querySelector('.library-count');
  const $selectedCount = $el.querySelector('.library-selected-count');
  const $selectAll = $el.querySelector('.library-select-all');

  $selectAll.addEventListener('click', () => handlers.onSelectAll?.());

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
    },
    updateState({ count, selectedCount, allSelected }) {
      $count.textContent = count;
      $selectedCount.textContent =
        selectedCount > 0 ? `(${selectedCount} ${LABEL.LIBRARY_SELECTED})` : '';
      $selectAll.textContent = allSelected ? LABEL.LIBRARY_DESELECT_ALL : LABEL.LIBRARY_SELECT_ALL;
    }
  };
}
