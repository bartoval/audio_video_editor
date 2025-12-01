import Mediator from '../Mediator';
import { formatBytes, createFileInput, show, hide, View } from '../../lib';
import { getVideoUploadUrl, convertVideo, isVideoConverted } from '../../services/api';
import { getUuid, invalidateCache } from '../../services/workspace';
import { ChunkedUploader } from '../../services/upload';
import { UPLOAD } from '../../config/ui';
import { LABEL, TIMING } from '../../constants';

/** Video uploader with progress and conversion states */
export default class Uploader extends View {
  #$fileInput = null;
  #$emptyState = null;
  #$uploadProgress = null;
  #$videoActions = null;
  #$progressBar = null;
  #$progressStatus = null;
  #$progressName = null;
  #$progressSize = null;
  #uploader = null;
  #isUploading = false;
  #isConverting = false;

  constructor($parent) {
    super($parent);
    this.#uploader = new ChunkedUploader(getVideoUploadUrl(), {
      chunkSize: UPLOAD.CHUNK_SIZE,
      parallelUploads: UPLOAD.PARALLEL_UPLOADS
    });
    this.mount();
  }

  template() {
    return `
      <div class="video-uploader">
        <div class="video-empty-state" data-ref="emptyState">
          <i class="bi bi-camera-video fs-1"></i>
          <p>${LABEL.NO_VIDEO}</p>
          <button class="video-import-btn">
            <i class="bi bi-upload"></i>
            <span>${LABEL.IMPORT_VIDEO}</span>
          </button>
        </div>
        <div class="video-upload-progress hide" data-ref="uploadProgress">
          <div class="video-upload-info">
            <span data-ref="progressName" class="video-upload-name"></span>
            <span data-ref="progressSize" class="video-upload-size"></span>
          </div>
          <div class="video-upload-bar-container">
            <div data-ref="progressBar" class="video-upload-bar"></div>
          </div>
          <span data-ref="progressStatus" class="video-upload-status">0%</span>
        </div>
        <div class="video-actions hide" data-ref="videoActions">
          <button class="video-action-btn video-change-btn" title="${LABEL.CHANGE_VIDEO}">
            <i class="bi bi-upload"></i>
          </button>
        </div>
      </div>
    `;
  }

  render() {
    // Hidden file input
    this.#$fileInput = createFileInput({
      accept: UPLOAD.VIDEO_EXTENSIONS,
      parent: this.$parent
    });

    // Create DOM from template
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);

    // Query refs
    this.#$emptyState = this.$node.querySelector('[data-ref="emptyState"]');
    this.#$uploadProgress = this.$node.querySelector('[data-ref="uploadProgress"]');
    this.#$videoActions = this.$node.querySelector('[data-ref="videoActions"]');
    this.#$progressBar = this.$node.querySelector('[data-ref="progressBar"]');
    this.#$progressStatus = this.$node.querySelector('[data-ref="progressStatus"]');
    this.#$progressName = this.$node.querySelector('[data-ref="progressName"]');
    this.#$progressSize = this.$node.querySelector('[data-ref="progressSize"]');
  }

  onMount() {
    this.#$fileInput.addEventListener('change', this.#handleFileChange);
    this.$node.addEventListener('click', this.#handleClick);
    Mediator.registerUploader(this);
  }

  showEmptyState() {
    show(this.#$emptyState, 'hide');
    hide(this.#$videoActions, 'hide');
  }

  showVideoActions() {
    hide([this.#$emptyState, this.#$uploadProgress], 'hide');
    show(this.#$videoActions, 'hide');
  }

  openFilePicker() {
    this.#$fileInput.click();
  }

  isActive() {
    return this.#isUploading || this.#isConverting;
  }

  // ============================================================================
  // Private - Event Handlers
  // ============================================================================

  #handleFileChange = e => {
    const { files } = e.target;

    if (files.length > 0) {
      this.#handleFile(files[0]);
    }

    e.target.value = '';
  };

  #handleClick = e => {
    const $target = e.target.closest('button');

    if (!$target) {
      return;
    }

    if (
      $target.classList.contains('video-import-btn') ||
      $target.classList.contains('video-change-btn')
    ) {
      this.openFilePicker();
    }
  };

  // ============================================================================
  // Private - Progress UI
  // ============================================================================

  #showProgress(fileName, fileSize) {
    hide([this.#$emptyState, this.#$videoActions], 'hide');
    show(this.#$uploadProgress, 'hide');
    this.#$progressName.textContent = fileName;
    this.#$progressSize.textContent = formatBytes(fileSize);
  }

  #updateProgress(percent, fileName) {
    this.#$progressBar.classList.remove('indeterminate');
    this.#$progressBar.style.width = `${percent}%`;
    this.#$progressStatus.textContent = `${Math.round(percent)}%`;

    if (fileName) {
      this.#$progressName.textContent = fileName;
    }
  }

  #hideProgress() {
    hide(this.#$uploadProgress, 'hide');
    this.#$progressBar.style.width = '0%';
    this.#$progressBar.classList.remove('indeterminate');
  }

  #showConversionProgress() {
    this.#isConverting = true;
    hide(this.#$emptyState, 'hide');
    show(this.#$uploadProgress, 'hide');

    this.#$progressName.textContent = LABEL.CONVERTING;
    this.#$progressSize.textContent = LABEL.PLEASE_WAIT;
    this.#$progressBar.style.width = '100%';
    this.#$progressBar.classList.add('indeterminate');
    this.#$progressStatus.textContent = LABEL.PROCESSING;
  }

  #hideConversionProgress() {
    this.#isConverting = false;
    hide(this.#$uploadProgress, 'hide');
    this.#$progressBar.style.width = '0%';
    this.#$progressBar.classList.remove('indeterminate');
  }

  // ============================================================================
  // Private - Upload & Conversion
  // ============================================================================

  async #handleFile(file) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('video/')) {
      console.error('Please select a video file');

      return;
    }

    const uuid = getUuid();

    if (!uuid) {
      console.error('No project selected');

      return;
    }

    // Notify that video will change
    Mediator.onVideoDeleted();

    this.#isUploading = true;
    this.#showProgress(file.name, file.size);

    try {
      await this.#uploader.upload(file, uuid, {
        onProgress: percent => this.#updateProgress(percent, file.name),
        onComplete: () => {
          this.#isUploading = false;
          invalidateCache();
          this.#startConversion();
        },
        onError: err => {
          this.#isUploading = false;
          this.#hideProgress();
          this.showEmptyState();
          console.error('Upload error:', err.message);
        }
      });
    } catch (err) {
      this.#isUploading = false;
      this.#hideProgress();
      this.showEmptyState();
      console.error('Upload error:', err.message);
    }
  }

  async #startConversion() {
    this.#showConversionProgress();
    await convertVideo();
    this.#pollConversionStatus();
  }

  #pollConversionStatus() {
    const checkStatus = async () => {
      try {
        const data = await isVideoConverted();

        if (data.status === 'ready') {
          this.#hideConversionProgress();
          invalidateCache();
          Mediator.onLoadVideo();
        } else if (data.status === 'error') {
          this.#hideConversionProgress();
          this.showEmptyState();
          console.error('Video conversion failed');
        } else {
          setTimeout(checkStatus, TIMING.RETRY_DELAY);
        }
      } catch (err) {
        console.error('Error checking conversion status:', err);
        setTimeout(checkStatus, TIMING.POLL_INTERVAL);
      }
    };

    checkStatus();
  }
}
