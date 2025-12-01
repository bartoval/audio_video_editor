import { createElement } from '../../../lib';
import { LABEL } from '../../../config/constants';

export function createToolbar($parent) {
  let handlers = {};

  const $el = createElement('div', {
    className: 'library-toolbar d-flex flex-column gap-3 py-3 border-bottom',
    html: `
      <div class="d-flex justify-content-between align-items-center">
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-secondary library-import-files" title="${LABEL.LIBRARY_IMPORT_FILES}">
            <i class="bi bi-file-earmark-music"></i>
            <span class="d-none d-lg-inline ms-1">Files</span>
          </button>
          <button class="btn btn-outline-secondary library-import-folder" title="${LABEL.LIBRARY_IMPORT_FOLDER}">
            <i class="bi bi-folder2-open"></i>
            <span class="d-none d-lg-inline ms-1">Folder</span>
          </button>
          <button class="btn btn-outline-primary library-ai-music" title="${LABEL.LIBRARY_AI_MUSIC}">
            <i class="bi bi-magic"></i>
            <span class="d-none d-lg-inline ms-1">${LABEL.LIBRARY_AI_MUSIC}</span>
          </button>
        </div>
        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-outline-info library-add-to-timeline" disabled title="${LABEL.LIBRARY_ADD_TO_TIMELINE}">
            <i class="bi bi-plus-circle me-1"></i>${LABEL.LIBRARY_TIMELINE}
          </button>
          <button class="btn btn-outline-danger library-delete-selected" disabled title="${LABEL.LIBRARY_DELETE}">
            <i class="bi bi-trash me-1"></i>${LABEL.LIBRARY_DELETE}
          </button>
        </div>
      </div>
      <div class="d-flex gap-2">
        <div class="input-group flex-grow-1">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input type="text" class="form-control library-search" placeholder="${LABEL.LIBRARY_SEARCH}">
        </div>
        <select class="form-select select-base library-sort-field">
          <option value="name">Name</option>
          <option value="duration">Duration</option>
          <option value="date">Date</option>
        </select>
        <button class="btn btn-outline-secondary library-sort-dir" title="Toggle sort direction">
          <i class="bi bi-sort-alpha-down"></i>
        </button>
      </div>
    `,
    parent: $parent
  });

  const $deleteBtn = $el.querySelector('.library-delete-selected');
  const $addBtn = $el.querySelector('.library-add-to-timeline');
  const $sortDirBtn = $el.querySelector('.library-sort-dir');

  $el
    .querySelector('.library-import-files')
    .addEventListener('click', () => handlers.onImportFiles?.());
  $el
    .querySelector('.library-import-folder')
    .addEventListener('click', () => handlers.onImportFolder?.());
  $el.querySelector('.library-ai-music').addEventListener('click', () => handlers.onAiMusic?.());
  $deleteBtn.addEventListener('click', () => handlers.onDeleteSelected?.());
  $addBtn.addEventListener('click', () => handlers.onAddToTimeline?.());
  $el
    .querySelector('.library-search')
    .addEventListener('input', event => handlers.onSearch?.(event.target.value));
  $el
    .querySelector('.library-sort-field')
    .addEventListener('change', event => handlers.onSortField?.(event.target.value));
  $sortDirBtn.addEventListener('click', () => handlers.onToggleSortDir?.());

  return {
    el: $el,
    bind(newHandlers) {
      handlers = newHandlers;
    },

    updateState({ selectedCount }) {
      $deleteBtn.disabled = selectedCount === 0;
      $addBtn.disabled = selectedCount === 0;

      const deleteLabel =
        selectedCount > 0 ? `${LABEL.LIBRARY_DELETE} (${selectedCount})` : LABEL.LIBRARY_DELETE;
      $deleteBtn.innerHTML = `<i class="bi bi-trash me-1"></i>${deleteLabel}`;

      $addBtn.innerHTML =
        selectedCount > 0
          ? `<i class="bi bi-plus-circle me-1"></i>${LABEL.LIBRARY_ADD} (${selectedCount})`
          : `<i class="bi bi-plus-circle me-1"></i>${LABEL.LIBRARY_ADD_TO_TIMELINE}`;
    },

    updateSortDir(isDesc) {
      const $icon = $sortDirBtn.querySelector('i');
      $icon.className = isDesc ? 'bi bi-sort-down' : 'bi bi-sort-up';
      $sortDirBtn.title = isDesc ? 'Descending' : 'Ascending';
    }
  };
}
