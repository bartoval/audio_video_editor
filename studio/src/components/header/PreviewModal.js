import Modal from '../core/Modal';
import { LABEL } from '../../constants';

/**
 * PreviewModal - Shows exported video with download option
 * Extends Modal with custom template for video preview
 */
export default class PreviewModal extends Modal {
  #$video = null;
  #$loader = null;
  #$downloadBtn = null;
  #$footer = null;
  #onClose = null;

  constructor() {
    super();
    this.#queryRefs();
  }

  setOnClose(callback) {
    this.#onClose = callback;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  showLoading() {
    this.#$loader.style.display = 'flex';
    this.#$loader.innerHTML = this.#loaderTemplate();
    this.#$video.style.display = 'none';
    this.#$footer.style.display = 'none';
    this.#$video.src = '';

    this.$backdrop.style.display = 'block';
    this.$backdrop.classList.add('show');
    this.$modal.style.display = 'block';
    this.$modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');
  }

  showVideo(videoUrl) {
    this.#$loader.style.display = 'none';
    this.#$video.style.display = 'block';
    this.#$footer.style.display = 'flex';

    this.#$video.src = videoUrl;
    this.#$downloadBtn.href = videoUrl;

    const filename = videoUrl.split('/').pop() || LABEL.DEFAULT_FILENAME;
    this.#$downloadBtn.download = filename;

    this.#$video.load();
    this.#$video.play().catch(err => {
      console.log('[PreviewModal] Autoplay blocked:', err);
    });
  }

  showError(message) {
    this.#$loader.innerHTML = this.#errorTemplate(message);
  }

  // ============================================================================
  // Override Modal methods
  // ============================================================================

  template() {
    return `
      <div class="preview-modal-content">
        <div class="preview-modal-header">
          <h5 class="mb-0">${LABEL.PREVIEW}</h5>
          <button type="button" class="btn-close btn-close-white" aria-label="${LABEL.CLOSE}" data-action="close"></button>
        </div>
        <div class="preview-modal-body" data-ref="body">
          <div class="preview-modal-loader" data-ref="loader"></div>
          <video class="preview-video" controls playsinline style="display: none" data-ref="video"></video>
        </div>
        <div class="preview-modal-footer" style="display: none" data-ref="footer">
          <a class="btn btn-info" download="${LABEL.DEFAULT_FILENAME}" data-ref="download">
            <i class="bi bi-download me-2"></i>${LABEL.DOWNLOAD}
          </a>
          <button class="btn btn-outline-secondary" data-action="close">${LABEL.CLOSE}</button>
        </div>
      </div>
    `;
  }

  backdropClass() {
    return 'preview-modal-backdrop';
  }

  modalClass() {
    return 'preview-modal';
  }

  onHide() {
    this.#$video.pause();
    this.#$video.src = '';
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    this.#$loader.innerHTML = this.#loaderTemplate();

    if (this.#onClose) {
      this.#onClose();
    }
  }

  // ============================================================================
  // Private
  // ============================================================================

  #queryRefs() {
    this.#$loader = this.$modal.querySelector('[data-ref="loader"]');
    this.#$loader.innerHTML = this.#loaderTemplate();
    this.#$video = this.$modal.querySelector('[data-ref="video"]');
    this.#$footer = this.$modal.querySelector('[data-ref="footer"]');
    this.#$downloadBtn = this.$modal.querySelector('[data-ref="download"]');
  }

  #loaderTemplate() {
    return `
      <div class="preview-spinner"></div>
      <div class="preview-loader-text">${LABEL.EXPORTING}</div>
      <div class="preview-loader-subtext">${LABEL.EXPORTING_SUBTEXT}</div>
    `;
  }

  #errorTemplate(message) {
    return `
      <i class="bi bi-exclamation-triangle text-danger" style="font-size: 48px;"></i>
      <div class="preview-loader-text text-danger">${message || LABEL.EXPORT_FAILED}</div>
      <div class="preview-loader-subtext">${LABEL.TRY_AGAIN}</div>
    `;
  }
}
