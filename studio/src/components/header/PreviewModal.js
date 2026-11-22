import Modal from '../core/Modal';
import { LABEL } from '../../config/constants';
import { escapeHtml } from '../../lib';

/**
 * PreviewModal - Shows exported video/audio with download option
 * Extends Modal with custom template for media preview
 */
export default class PreviewModal extends Modal {
  #$video = null;
  #$audio = null;
  #$loader = null;
  #$downloadBtn = null;
  #$footer = null;
  #$formatSelector = null;
  #onClose = null;
  #onExport = null;

  constructor() {
    super();
    this.#queryRefs();
    this.#bindFormatSelector();
  }

  setOnClose(callback) {
    this.#onClose = callback;
  }

  setOnExport(callback) {
    this.#onExport = callback;
  }

  showFormatSelector() {
    this.#$loader.style.display = 'none';
    this.#$video.style.display = 'none';
    this.#$audio.style.display = 'none';
    this.#$footer.style.display = 'none';
    this.#$formatSelector.style.display = 'flex';

    this.$backdrop.style.display = 'block';
    this.$backdrop.classList.add('show');
    this.$modal.style.display = 'block';
    this.$modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');
  }

  showLoading() {
    this.#$loader.style.display = 'flex';
    this.#$loader.innerHTML = this.#loaderTemplate();
    this.#$video.style.display = 'none';
    this.#$audio.style.display = 'none';
    this.#$footer.style.display = 'none';
    this.#$formatSelector.style.display = 'none';
    this.#$video.src = '';
    this.#$audio.src = '';

    this.$backdrop.style.display = 'block';
    this.$backdrop.classList.add('show');
    this.$modal.style.display = 'block';
    this.$modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');
  }

  showVideo(url) {
    this.#$loader.style.display = 'none';
    this.#$video.style.display = 'block';
    this.#$audio.style.display = 'none';
    this.#$footer.style.display = 'flex';

    this.#$video.src = url;
    this.#$downloadBtn.href = url;

    const filename = url.split('/').pop() || LABEL.DEFAULT_FILENAME;
    this.#$downloadBtn.download = filename;

    this.#$video.load();
    this.#$video.play().catch(err => {
      console.log('[PreviewModal] Autoplay blocked:', err);
    });
  }

  showAudio(url) {
    this.#$loader.style.display = 'none';
    this.#$video.style.display = 'none';
    this.#$audio.style.display = 'block';
    this.#$footer.style.display = 'flex';

    this.#$audio.src = url;
    this.#$downloadBtn.href = url;

    const filename = url.split('/').pop() || LABEL.DEFAULT_FILENAME;
    this.#$downloadBtn.download = filename;

    this.#$audio.load();
    this.#$audio.play().catch(err => {
      console.log('[PreviewModal] Autoplay blocked:', err);
    });
  }

  /**
   * @param {string} [message] - what failed (defaults to "Export failed")
   * @param {string} [detail] - why, or what to do next (defaults to "Please try again")
   */
  showError(message, detail) {
    this.#$loader.innerHTML = this.#errorTemplate(message, detail);
  }

  template() {
    return `
      <div class="preview-modal-content">
        <div class="preview-modal-header">
          <h5 class="preview-modal-title">${LABEL.PREVIEW}</h5>
          <button type="button" class="preview-modal-close" aria-label="${LABEL.CLOSE}" data-action="close">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="preview-modal-body" data-ref="body">
          <div class="preview-loader" data-ref="loader"></div>
          <div class="preview-format-selector" data-ref="format-selector">
            <div class="preview-format-title">${LABEL.SELECT_FORMAT}</div>
            <div class="preview-format-subtext">${LABEL.SELECT_FORMAT_SUBTEXT}</div>
            <div class="preview-format-options">
              <button class="btn btn-outline-primary preview-format-btn" data-format="mp3">
                <i class="bi bi-file-music me-2"></i>
                <span class="preview-format-name">${LABEL.FORMAT_MP3}</span>
                <span class="preview-format-desc">${LABEL.FORMAT_MP3_DESC}</span>
              </button>
              <button class="btn btn-outline-primary preview-format-btn" data-format="wav">
                <i class="bi bi-file-earmark-music me-2"></i>
                <span class="preview-format-name">${LABEL.FORMAT_WAV}</span>
                <span class="preview-format-desc">${LABEL.FORMAT_WAV_DESC}</span>
              </button>
            </div>
          </div>
          <video class="preview-video" controls playsinline data-ref="video"></video>
          <audio class="preview-audio" controls data-ref="audio"></audio>
        </div>
        <div class="preview-modal-footer" data-ref="footer">
          <a class="btn btn-primary" download="${LABEL.DEFAULT_FILENAME}" data-ref="download">
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
    this.#$audio.pause();
    this.#$audio.src = '';
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    this.#$loader.innerHTML = this.#loaderTemplate();

    if (this.#onClose) {
      this.#onClose();
    }
  }

  #queryRefs() {
    this.#$loader = this.$modal.querySelector('[data-ref="loader"]');
    this.#$loader.innerHTML = this.#loaderTemplate();
    this.#$video = this.$modal.querySelector('[data-ref="video"]');
    this.#$audio = this.$modal.querySelector('[data-ref="audio"]');
    this.#$footer = this.$modal.querySelector('[data-ref="footer"]');
    this.#$downloadBtn = this.$modal.querySelector('[data-ref="download"]');
    this.#$formatSelector = this.$modal.querySelector('[data-ref="format-selector"]');
  }

  #bindFormatSelector() {
    const buttons = this.#$formatSelector.querySelectorAll('[data-format]');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const format = btn.dataset.format;

        if (this.#onExport) {
          this.#onExport(format);
        }
      });
    });
  }

  #loaderTemplate() {
    return `
      <div class="preview-spinner"></div>
      <div class="preview-loader-text">${LABEL.EXPORTING}</div>
      <div class="preview-loader-subtext">${LABEL.EXPORTING_SUBTEXT}</div>
    `;
  }

  #errorTemplate(message, detail) {
    return `
      <i class="bi bi-exclamation-triangle preview-error-icon"></i>
      <div class="preview-error-text">${escapeHtml(message || LABEL.EXPORT_FAILED)}</div>
      <div class="preview-error-subtext">${escapeHtml(detail || LABEL.TRY_AGAIN)}</div>
    `;
  }
}
