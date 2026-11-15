/** Project selector factory - dropdown and add/delete buttons */
import { createElement } from '../../../lib';
import { LABEL } from '../../../config/constants';
import { WORKSPACE } from '../../../config/ui';

export function createProjectSelector($parent) {
  let handlers = {};
  let currentUuid = null;
  let projects = [];

  const $el = createElement('div', {
    className: 'd-flex align-items-center gap-2',
    html: `
      <select class="form-select select-base project-select" data-ref="select"></select>
      <button class="btn btn-outline-info" title="${LABEL.ADD_WORKSPACE}" data-action="add">
        <i class="bi bi-plus me-1"></i>${LABEL.ADD_WORKSPACE}
      </button>
      <button class="btn btn-outline-danger" title="${LABEL.DELETE_WORKSPACE}" data-action="delete">
        <i class="bi bi-trash me-1"></i>${LABEL.DELETE}
      </button>
    `
  });

  $parent.insertBefore($el, $parent.firstChild);

  const $select = $el.querySelector('[data-ref="select"]');
  const $addBtn = $el.querySelector('[data-action="add"]');
  const $deleteBtn = $el.querySelector('[data-action="delete"]');

  const handleSelectChange = event => {
    const uuid = event.target.value;

    if (uuid && uuid !== currentUuid) {
      handlers.onSelect?.(uuid);
    }
  };

  const handleAddClick = event => {
    event.preventDefault();
    handlers.onAdd?.();
  };

  const handleDeleteClick = event => {
    event.preventDefault();

    if (currentUuid === WORKSPACE.DEFAULT_UUID) {
      return;
    }

    handlers.onDelete?.(currentUuid);
  };

  $select.addEventListener('change', handleSelectChange);
  $addBtn.addEventListener('click', handleAddClick);
  $deleteBtn.addEventListener('click', handleDeleteClick);

  return {
    el: $el,

    bind(newHandlers) {
      handlers = newHandlers;
    },

    setState(state) {
      if (state.currentUuid !== undefined) {
        currentUuid = state.currentUuid;
      }

      if (state.projects !== undefined) {
        projects = state.projects;
        $select.innerHTML = '';
        state.projects.forEach(({ uuid, title }) => {
          const $option = document.createElement('option');
          $option.value = uuid;
          $option.textContent = title;
          $option.selected = uuid === currentUuid;
          $select.appendChild($option);
        });
      }

      const offline = state.offline ?? false;
      const disabled = state.disabled ?? false;
      const isDefault = currentUuid === WORKSPACE.DEFAULT_UUID;
      const isDisabled = disabled;

      $select.disabled = disabled;
      $select.title = offline ? LABEL.SELECT_WORKSPACE_OFFLINE : '';
      for (const option of $select.options) {
        option.disabled = !projects.find(project => project.uuid === option.value)?.hasLocalState;
      }

      $addBtn.disabled = isDisabled;
      $addBtn.title = LABEL.ADD_WORKSPACE;

      $deleteBtn.disabled = isDisabled || isDefault;

      if (isDefault) {
        $deleteBtn.title = LABEL.DELETE_WORKSPACE_DEFAULT;
      } else {
        $deleteBtn.title = LABEL.DELETE_WORKSPACE;
      }
    },

    destroy() {
      $select.removeEventListener('change', handleSelectChange);
      $addBtn.removeEventListener('click', handleAddClick);
      $deleteBtn.removeEventListener('click', handleDeleteClick);
      $el.remove();
    }
  };
}
