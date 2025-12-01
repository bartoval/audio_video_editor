import * as api from '../../services/api';
import { getUuid } from '../../services/workspace';
import { NAV } from '../../config/routes';
import { LABEL } from '../../constants';
import { View, isOnline } from '../../lib';
import Modal from '../core/Modal';

export default class ProjectSelector extends View {
  #$select = null;
  #$addBtn = null;
  #$deleteBtn = null;
  #modal = null;
  #currentUuid = null;
  #projects = [];
  #isDeleteMode = false;

  constructor($parent) {
    super($parent);
    this.mount();
  }

  template() {
    return `
      <div class="d-flex align-items-center gap-2">
        <select class="form-select form-select-sm" style="width: 200px" data-ref="select"></select>
        <button class="btn btn-sm btn-outline-info" title="${LABEL.ADD_WORKSPACE}" data-action="add">
          <i class="bi bi-plus me-1"></i>${LABEL.ADD_WORKSPACE}
        </button>
        <button class="btn btn-sm btn-outline-danger" title="${LABEL.DELETE_WORKSPACE}" data-action="delete">
          <i class="bi bi-trash me-1"></i>${LABEL.DELETE}
        </button>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.insertBefore(this.$node, this.$parent.firstChild);
  }

  onMount() {
    this.#currentUuid = getUuid();
    this.#$select = this.$node.querySelector('[data-ref="select"]');
    this.#$select.addEventListener('change', this.#handleSelectChange);

    this.#$addBtn = this.$node.querySelector('[data-action="add"]');
    this.#$addBtn.addEventListener('click', this.#handleAddClick);

    this.#$deleteBtn = this.$node.querySelector('[data-action="delete"]');
    this.#$deleteBtn.addEventListener('click', this.#handleDeleteClick);

    this.#modal = new Modal({
      onConfirm: () => this.#handleConfirm(),
      onCancel: () => (this.#isDeleteMode = false)
    });

    window.addEventListener('online', this.#updateButtonStates);
    window.addEventListener('offline', this.#updateButtonStates);

    this.#loadProjects();
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  #handleSelectChange = e => {
    const uuid = e.target.value;

    if (uuid && uuid !== this.#currentUuid) {
      window.location.href = NAV.workspace(uuid);
    }
  };

  #handleAddClick = () => {
    this.#isDeleteMode = false;
    this.#modal.show({
      title: LABEL.ADD_WORKSPACE,
      body: `<input type="text" class="form-control" placeholder="${LABEL.WORKSPACE_TITLE_PLACEHOLDER}" data-ref="title-input">`,
      confirmText: LABEL.CREATE,
      confirmClass: 'btn-primary'
    });
  };

  #handleDeleteClick = () => {
    if (this.#currentUuid === '0') {
      return;
    }

    const project = this.#projects.find(({ uuid }) => uuid === this.#currentUuid);

    if (!project) {
      return;
    }

    this.#isDeleteMode = true;
    this.#modal.show({
      title: LABEL.DELETE_WORKSPACE,
      body: `
        <p class="mb-2">Delete "<strong>${project.title}</strong>"?</p>
        <p class="text-danger small mb-0">This action cannot be undone.</p>
      `,
      confirmText: LABEL.DELETE,
      confirmClass: 'btn-danger'
    });
  };

  #handleConfirm = async () => {
    if (this.#isDeleteMode) {
      await this.#deleteProject();
    } else {
      await this.#createProject();
    }
  };

  // ============================================================================
  // API Operations
  // ============================================================================

  async #loadProjects() {
    try {
      this.#projects = await api.getProjects();
    } catch (error) {
      this.#projects = [];
    }

    this.#updateDropdown();
  }

  async #createProject() {
    const $input = this.#modal.getBody().querySelector('[data-ref="title-input"]');
    const title = $input?.value.trim();

    if (!title) {
      $input?.focus();

      return;
    }

    try {
      const result = await api.createProject(title);

      if (result.success) {
        this.#modal.hide();
        window.location.href = NAV.workspace(result.uuid);
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      alert('Error: ' + error);
    }
  }

  async #deleteProject() {
    if (!this.#currentUuid) {
      return;
    }

    try {
      const result = await api.deleteProject(this.#currentUuid);

      if (result.success) {
        this.#modal.hide();
        const remaining = this.#projects.filter(({ uuid }) => uuid !== this.#currentUuid);
        window.location.href = remaining.length > 0 ? NAV.workspace(remaining[0].uuid) : NAV.home;
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      alert('Error: ' + error);
    }
  }

  // ============================================================================
  // UI Updates
  // ============================================================================

  #updateButtonStates = () => {
    const offline = !isOnline();

    // Add button - disabled when offline
    this.#$addBtn.disabled = offline;
    this.#$addBtn.title = offline ? LABEL.ADD_WORKSPACE_OFFLINE : LABEL.ADD_WORKSPACE;

    // Delete button - disabled when offline or default project
    const isDefault = this.#currentUuid === '0';
    this.#$deleteBtn.disabled = offline || isDefault;

    if (offline) {
      this.#$deleteBtn.title = LABEL.DELETE_WORKSPACE_OFFLINE;
    } else if (isDefault) {
      this.#$deleteBtn.title = LABEL.DELETE_WORKSPACE_DEFAULT;
    } else {
      this.#$deleteBtn.title = LABEL.DELETE_WORKSPACE;
    }
  };

  #updateDropdown() {
    if (!this.#$select) {
      return;
    }

    this.#$select.innerHTML = '';
    this.#projects.forEach(({ uuid, title }) => {
      const $option = document.createElement('option');
      $option.value = uuid;
      $option.textContent = title;
      $option.selected = uuid === this.#currentUuid;
      this.#$select.appendChild($option);
    });

    this.#updateButtonStates();
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy() {
    window.removeEventListener('online', this.#updateButtonStates);
    window.removeEventListener('offline', this.#updateButtonStates);
    this.#modal?.destroy();

    if (this.$node) {
      this.$node.remove();
      this.$node = null;
    }
  }
}
