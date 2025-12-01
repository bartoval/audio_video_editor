/**
 * Preview Modal - Shows exported video with download option
 */
export default class PreviewModal {
  constructor() {
    this.$modal = null;
    this.$video = null;
    this.$backdrop = null;
    this.$body = null;
    this.$loader = null;
    this.$downloadBtn = null;
    this.$footer = null;
    this.render();
  }

  render() {
    // Backdrop
    this.$backdrop = document.createElement('div');
    this.$backdrop.className = 'preview-modal-backdrop';
    this.$backdrop.addEventListener('click', () => this.hide());

    // Modal container
    this.$modal = document.createElement('div');
    this.$modal.className = 'preview-modal';

    // Modal content
    const $content = document.createElement('div');
    $content.className = 'preview-modal-content';

    // Header
    const $header = document.createElement('div');
    $header.className = 'preview-modal-header';
    $header.innerHTML = `
      <h5 class="mb-0">Preview</h5>
      <button type="button" class="btn-close btn-close-white" aria-label="Close"></button>
    `;
    $header.querySelector('.btn-close').addEventListener('click', () => this.hide());

    // Body
    this.$body = document.createElement('div');
    this.$body.className = 'preview-modal-body';

    // Loader
    this.$loader = document.createElement('div');
    this.$loader.className = 'preview-modal-loader';
    this.$loader.innerHTML = `
      <div class="preview-spinner"></div>
      <div class="preview-loader-text">Exporting video...</div>
      <div class="preview-loader-subtext">This may take a few minutes</div>
    `;
    this.$body.appendChild(this.$loader);

    // Video
    this.$video = document.createElement('video');
    this.$video.className = 'preview-video';
    this.$video.controls = true;
    this.$video.playsInline = true;
    this.$video.style.display = 'none';
    this.$body.appendChild(this.$video);

    // Footer with actions
    this.$footer = document.createElement('div');
    this.$footer.className = 'preview-modal-footer';
    this.$footer.style.display = 'none';

    this.$downloadBtn = document.createElement('a');
    this.$downloadBtn.className = 'btn btn-info';
    this.$downloadBtn.innerHTML = '<i class="bi bi-download me-2"></i>Download';
    this.$downloadBtn.download = 'export.mp4';

    const $closeBtn = document.createElement('button');
    $closeBtn.className = 'btn btn-outline-secondary';
    $closeBtn.textContent = 'Close';
    $closeBtn.addEventListener('click', () => this.hide());

    this.$footer.appendChild(this.$downloadBtn);
    this.$footer.appendChild($closeBtn);

    // Assemble modal
    $content.appendChild($header);
    $content.appendChild(this.$body);
    $content.appendChild(this.$footer);
    this.$modal.appendChild($content);

    // Add to document
    document.body.appendChild(this.$backdrop);
    document.body.appendChild(this.$modal);
  }

  showLoading() {
    this.$loader.style.display = 'flex';
    this.$video.style.display = 'none';
    this.$footer.style.display = 'none';
    this.$video.src = '';

    this.$backdrop.classList.add('show');
    this.$modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  showVideo(videoUrl) {
    this.$loader.style.display = 'none';
    this.$video.style.display = 'block';
    this.$footer.style.display = 'flex';

    this.$video.src = videoUrl;
    this.$downloadBtn.href = videoUrl;

    // Extract filename from URL
    const filename = videoUrl.split('/').pop() || 'export.mp4';
    this.$downloadBtn.download = filename;

    // Try to play
    this.$video.load();
    this.$video.play().catch(err => {
      console.log('[PreviewModal] Autoplay blocked:', err);
    });
  }

  showError(message) {
    this.$loader.innerHTML = `
      <i class="bi bi-exclamation-triangle text-danger" style="font-size: 48px;"></i>
      <div class="preview-loader-text text-danger">${message || 'Export failed'}</div>
      <div class="preview-loader-subtext">Please try again</div>
    `;
  }

  hide() {
    this.$video.pause();
    this.$video.src = '';
    this.$backdrop.classList.remove('show');
    this.$modal.classList.remove('show');
    document.body.style.overflow = '';

    // Reset loader for next time
    this.$loader.innerHTML = `
      <div class="preview-spinner"></div>
      <div class="preview-loader-text">Exporting video...</div>
      <div class="preview-loader-subtext">This may take a few minutes</div>
    `;
  }
}
