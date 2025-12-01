import Modal from './Modal';
import { LABEL } from '../../config/constants';

/**
 * ProcessingModal - Shows processing state for long-running operations
 * Extends Modal with methods: showProcessing(), showError(), showSuccess()
 *
 * Reuses preview-modal styles (preview-spinner, preview-loader, etc.)
 */
export default class ProcessingModal extends Modal {
  #$loader = null;
  #$content = null;

  constructor() {
    super();
    this.#queryRefs();
  }

  /**
   * Show processing state with spinner
   * @param {Object} options
   * @param {string} options.title - Modal title
   * @param {string} options.message - Main message
   * @param {string} [options.subtext] - Secondary text
   */
  showProcessing({ title, message, subtext }) {
    this.#setTitle(title);
    this.#$content.innerHTML = this.#processingTemplate(message, subtext);
    this.#showModal();
  }

  /**
   * Show error state
   * @param {Object} options
   * @param {string} options.title - Modal title
   * @param {string} options.message - Error message
   * @param {string} [options.subtext] - Secondary text
   */
  showError({ title, message, subtext }) {
    this.#setTitle(title);
    this.#$content.innerHTML = this.#errorTemplate(message, subtext);
  }

  /**
   * Show success state
   * @param {Object} options
   * @param {string} options.title - Modal title
   * @param {string} options.message - Success message
   * @param {string} [options.subtext] - Secondary text
   */
  showSuccess({ title, message, subtext }) {
    this.#setTitle(title);
    this.#$content.innerHTML = this.#successTemplate(message, subtext);
  }

  template() {
    return `
      <div class="preview-modal-content">
        <div class="preview-modal-header">
          <h5 class="preview-modal-title" data-ref="title"></h5>
          <button type="button" class="preview-modal-close" aria-label="${LABEL.CLOSE}" data-action="close">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="preview-modal-body">
          <div class="preview-loader" data-ref="content"></div>
        </div>
      </div>
    `;
  }

  backdropClass() {
    return 'preview-modal-backdrop';
  }

  modalClass() {
    return 'preview-modal processing-modal';
  }

  onHide() {
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
  }

  #queryRefs() {
    this.#$loader = this.$modal.querySelector('[data-ref="title"]');
    this.#$content = this.$modal.querySelector('[data-ref="content"]');
  }

  #setTitle(title) {
    if (this.#$loader) {
      this.#$loader.textContent = title || '';
    }
  }

  #showModal() {
    this.$backdrop.style.display = 'block';
    this.$backdrop.classList.add('show');
    this.$modal.style.display = 'block';
    this.$modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');
  }

  #processingTemplate(message, subtext) {
    return `
      <div class="preview-spinner"></div>
      <div class="preview-loader-text">${message || ''}</div>
      ${subtext ? `<div class="preview-loader-subtext">${subtext}</div>` : ''}
    `;
  }

  #errorTemplate(message, subtext) {
    return `
      <i class="bi bi-exclamation-triangle preview-error-icon"></i>
      <div class="preview-error-text">${message || ''}</div>
      ${subtext ? `<div class="preview-error-subtext">${subtext}</div>` : ''}
    `;
  }

  #successTemplate(message, subtext) {
    return `
      <i class="bi bi-check-circle preview-success-icon"></i>
      <div class="preview-loader-text">${message || ''}</div>
      ${subtext ? `<div class="preview-loader-subtext">${subtext}</div>` : ''}
    `;
  }
}
