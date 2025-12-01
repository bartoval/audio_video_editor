import Mediator from '../Mediator';
import * as Api from '../../services/api';
import { NOTIFY_TYPE, LABEL } from '../../constants';
import { TOAST_DURATION } from '../../config/ui';
import { View } from '../../lib';
import PreviewModal from './PreviewModal';

/**
 * Header action buttons
 */
export default class HeaderActions extends View {
  #isExporting = false;
  #previewModal = null;

  constructor($parent) {
    super($parent);
    this.#previewModal = new PreviewModal();
    this.#previewModal.setOnClose(() => {
      this.#isExporting = false;
    });
    this.mount();
  }

  template() {
    return `
      <ul class="navbar-nav ms-auto flex-row align-items-center gap-3">
        <li class="nav-item">
          <button class="btn btn-sm btn-outline-info d-flex align-items-center gap-1" data-action="load" title="${LABEL.LOAD}">
            <i class="bi bi-download"></i><span class="d-none d-md-inline">${LABEL.LOAD}</span>
          </button>
        </li>
        <li class="nav-item">
          <button class="btn btn-sm btn-outline-info d-flex align-items-center gap-1" data-action="save" title="${LABEL.SAVE}">
            <i class="bi bi-save"></i><span class="d-none d-md-inline">${LABEL.SAVE}</span>
          </button>
        </li>
        <li class="nav-item">
          <button class="btn btn-sm btn-outline-info d-flex align-items-center gap-1" data-action="preview" title="${LABEL.PREVIEW}">
            <i class="bi bi-play-circle"></i><span class="d-none d-md-inline">${LABEL.PREVIEW}</span>
          </button>
        </li>
      </ul>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);
  }

  onMount() {
    this.$node.querySelector('[data-action="load"]').addEventListener('click', this.#handleLoad);
    this.$node.querySelector('[data-action="save"]').addEventListener('click', this.#handleSave);
    this.$node
      .querySelector('[data-action="preview"]')
      .addEventListener('click', this.#handlePreview);
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  #handleLoad = async e => {
    e.preventDefault();

    const response = await Api.load();
    const isEmpty = Object.keys(response).length === 0;

    if (!isEmpty) {
      Mediator.onLoadVideo(response.video, response);
      Mediator.showToast({
        type: NOTIFY_TYPE.SUCCESS,
        msg: LABEL.LOADED,
        timeHide: TOAST_DURATION.short
      });
    }
  };

  #handleSave = async e => {
    e.preventDefault();

    const data = Mediator.getData();

    await Api.backup(data);
    Mediator.showToast({ type: NOTIFY_TYPE.SUCCESS, timeHide: TOAST_DURATION.short });
  };

  #handlePreview = async e => {
    e.preventDefault();

    if (this.#isExporting) {
      return;
    }

    this.#isExporting = true;
    this.#previewModal.showLoading();

    const data = Mediator.getData();

    try {
      const response = await Api.publish(data);
      this.#isExporting = false;
      this.#previewModal.showVideo(response.res);
    } catch (err) {
      console.error('[HeaderActions] Export error:', err);
      this.#isExporting = false;
      this.#previewModal.showError(LABEL.EXPORT_FAILED);
    }
  };

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy() {
    this.#previewModal?.destroy?.();

    if (this.$node) {
      this.$node.remove();
      this.$node = null;
    }
  }
}
