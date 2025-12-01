/** Header presenter - orchestrates header views and handles navigation */
import * as api from '../../services/api';
import * as EventService from '../../services/EventService';
import HeaderActionsService from '../../services/HeaderActionsService';
import Mediator from '../Mediator';
import { getUuid } from '../../services/workspace';
import { NAV } from '../../config/routes';
import { EVENT, NOTIFY_TYPE, LABEL } from '../../config/constants';
import { TOAST_DURATION } from '../../config/ui';
import { escapeHtml } from '../../lib';
import { uiStore, timelineStore } from '../../store';
import Modal from '../core/Modal';
import PreviewModal from './PreviewModal';
import { createProjectSelector, createHeaderActions } from './view';

export default class HeaderPresenter {
  #projectSelector = null;
  #headerActions = null;
  #modal = null;
  #previewModal = null;
  #projects = [];
  #currentUuid = null;

  #isLoading = false;
  #isSaving = false;
  #isExporting = false;
  #isOffline = false;

  #pendingAction = null;
  #pendingDeleteUuid = null;
  #unsubscribeConnection = null;
  #unsubscribeTimeline = null;
  #hasTracks = false;
  #hasBackup = false;

  constructor($parent) {
    this.#currentUuid = getUuid();
    this.#isOffline = !EventService.isOnline();
    this.#initViews($parent);
    this.#initModal();
    this.#subscribeEvents();
    this.#loadProjects();
  }

  #initViews($parent) {
    this.#projectSelector = createProjectSelector($parent);
    this.#projectSelector.bind({
      onSelect: uuid => this.#handleSelectProject(uuid),
      onAdd: () => this.#handleAddProject(),
      onDelete: uuid => this.#handleDeleteProject(uuid)
    });

    this.#headerActions = createHeaderActions($parent);
    this.#headerActions.bind({
      onLoad: () => this.#handleLoad(),
      onSave: () => this.#handleSave(),
      onPreview: () => this.#handlePreview()
    });

    this.#syncUIState();
  }

  #initModal() {
    this.#modal = new Modal({
      onConfirm: () => this.#handleModalConfirm(),
      onCancel: () => {
        this.#pendingAction = null;
        this.#pendingDeleteUuid = null;
      }
    });

    this.#previewModal = new PreviewModal();
    this.#previewModal.setOnClose(() => {
      this.#isExporting = false;
      this.#syncUIState();
    });
    this.#previewModal.setOnExport(format => this.#handleExport(format));
  }

  #subscribeEvents() {
    this.#unsubscribeConnection = EventService.on(EVENT.CONNECTION, () => {
      this.#isOffline = !EventService.isOnline();
      this.#syncUIState();
    });

    this.#unsubscribeTimeline = timelineStore.subscribe(state => {
      const hasTracks = state.tracks.length > 0;

      if (hasTracks !== this.#hasTracks) {
        this.#hasTracks = hasTracks;
        this.#syncUIState();
      }
    });

    // Check initial tracks state
    this.#hasTracks = timelineStore.getState().tracks.length > 0;
  }

  async #loadProjects() {
    try {
      this.#projects = await api.getProjects();
    } catch {
      this.#projects = [];
    }

    // Check if backup exists for current workspace
    await this.#checkBackupExists();
    this.#syncUIState();
  }

  async #checkBackupExists() {
    try {
      const response = await api.load();
      this.#hasBackup = Object.keys(response).length > 0;
    } catch {
      this.#hasBackup = false;
    }
  }

  #handleSelectProject(uuid) {
    if (this.#isOffline) {
      return;
    }

    window.location.href = NAV.workspace(uuid);
  }

  #handleAddProject() {
    if (this.#isOffline) {
      return;
    }

    this.#pendingAction = 'add';
    this.#modal.show({
      title: LABEL.ADD_WORKSPACE,
      body: `<input type="text" class="form-control" placeholder="${LABEL.WORKSPACE_TITLE_PLACEHOLDER}" data-ref="title-input">`,
      confirmText: LABEL.CREATE,
      confirmClass: 'btn-primary'
    });
  }

  #handleDeleteProject(uuid) {
    if (this.#isOffline) {
      return;
    }

    const project = this.#projects.find(proj => proj.uuid === uuid);

    if (!project) {
      return;
    }

    this.#pendingAction = 'delete';
    this.#pendingDeleteUuid = uuid;
    this.#modal.show({
      title: LABEL.DELETE_WORKSPACE,
      body: `
        <p class="mb-2">${LABEL.DELETE_WORKSPACE_PROMPT.replace('{title}', escapeHtml(project.title))}</p>
        <p class="text-danger small mb-0">${LABEL.DELETE_WORKSPACE_WARNING}</p>
      `,
      confirmText: LABEL.DELETE,
      confirmClass: 'btn-danger'
    });
  }

  async #handleModalConfirm() {
    if (this.#pendingAction === 'add') {
      await this.#createProject();
    } else if (this.#pendingAction === 'delete') {
      await this.#deleteProject(this.#pendingDeleteUuid);
    }

    this.#pendingAction = null;
    this.#pendingDeleteUuid = null;
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
        this.#showError(result.error);
      }
    } catch (error) {
      this.#showError(String(error));
    }
  }

  async #deleteProject(targetUuid) {
    if (!targetUuid) {
      return;
    }

    try {
      const result = await api.deleteProject(targetUuid);

      if (result.success) {
        this.#modal.hide();
        const remaining = this.#projects.filter(({ uuid }) => uuid !== targetUuid);

        if (targetUuid === this.#currentUuid) {
          window.location.href = remaining.length > 0 ? NAV.workspace(remaining[0].uuid) : NAV.home;
        } else {
          this.#projects = remaining;
          this.#syncUIState();
        }
      } else {
        this.#showError(result.error);
      }
    } catch (error) {
      this.#showError(String(error));
    }
  }

  async #handleLoad() {
    if (this.#isLoading || this.#isOffline) {
      return;
    }

    this.#isLoading = true;
    this.#syncUIState();

    const result = await HeaderActionsService.load();

    this.#isLoading = false;
    this.#syncUIState();

    if (result.success && result.data) {
      uiStore.actions.pushToast({
        type: NOTIFY_TYPE.SUCCESS,
        msg: LABEL.LOADED,
        timeHide: TOAST_DURATION.short
      });
    } else if (!result.success) {
      this.#showError(result.error);
    }
  }

  async #handleSave() {
    if (this.#isSaving) {
      return;
    }

    this.#isSaving = true;
    this.#syncUIState();

    const result = await HeaderActionsService.save();

    this.#isSaving = false;

    if (result.success) {
      this.#hasBackup = true;
      uiStore.actions.pushToast({
        type: NOTIFY_TYPE.SUCCESS,
        timeHide: TOAST_DURATION.short
      });
    } else {
      this.#showError(result.error);
    }

    this.#syncUIState();
  }

  async #handlePreview() {
    if (this.#isExporting || this.#isOffline) {
      return;
    }

    const isAudioOnly = Mediator.isAudioOnly();

    if (isAudioOnly) {
      this.#previewModal.showFormatSelector();

      return;
    }

    this.#isExporting = true;
    this.#syncUIState();
    this.#previewModal.showLoading();

    const result = await HeaderActionsService.preview();

    this.#isExporting = false;
    this.#syncUIState();

    if (result.success) {
      this.#previewModal.showVideo(result.url);
    } else {
      this.#previewModal.showError(LABEL.EXPORT_FAILED);
    }
  }

  async #handleExport(format) {
    this.#isExporting = true;
    this.#syncUIState();
    this.#previewModal.showLoading();

    const result = await HeaderActionsService.preview({ format });

    this.#isExporting = false;
    this.#syncUIState();

    if (result.success) {
      this.#previewModal.showAudio(result.url);
    } else {
      this.#previewModal.showError(LABEL.EXPORT_FAILED);
    }
  }

  #syncUIState() {
    const isBusy = this.#isLoading || this.#isSaving || this.#isExporting;

    this.#projectSelector.setState({
      currentUuid: this.#currentUuid,
      projects: this.#projects,
      offline: this.#isOffline,
      disabled: isBusy
    });

    this.#headerActions.setState({
      offline: this.#isOffline,
      isLoading: this.#isLoading,
      isSaving: this.#isSaving,
      isExporting: this.#isExporting,
      hasTracks: this.#hasTracks,
      hasBackup: this.#hasBackup
    });
  }

  #showError(message) {
    uiStore.actions.pushToast({
      type: NOTIFY_TYPE.ERROR,
      msg: message,
      timeHide: TOAST_DURATION.long
    });
  }

  destroy() {
    this.#unsubscribeConnection?.();
    this.#unsubscribeTimeline?.();
    this.#projectSelector?.destroy();
    this.#headerActions?.destroy();
    this.#modal?.destroy();
    this.#previewModal?.destroy?.();

    this.#unsubscribeConnection = null;
    this.#unsubscribeTimeline = null;
    this.#projectSelector = null;
    this.#headerActions = null;
    this.#modal = null;
    this.#previewModal = null;
  }
}
