import Config from 'Config';
import ChunkedUploader from './ChunkedUploader.js';
import { formatBytes } from 'utils/format';
import { createElement, createFileInput, show, hide } from 'utils/dom';

const ACCEPTED_VIDEO_EXTENSIONS = '.mp4,.mov,.avi,.mkv,.webm,.m4v';

export default class Uploader {
  constructor($parent, callbacks = {}) {
    this.$parent = $parent;
    this.$fileInput = null;
    this.$emptyState = null;
    this.$uploadProgress = null;
    this.$videoActions = null;
    this.$progressBar = null;
    this.$progressStatus = null;
    this.$progressName = null;
    this.$progressSize = null;

    this.callbacks = callbacks;
    this.uploader = new ChunkedUploader(`${Config.getApiUrl()}upload`, {
      chunkSize: 1024 * 1024,
      parallelUploads: 3
    });
    this.isUploading = false;
    this.isConverting = false;

    this.render($parent);
    this._bindEvents();
  }

  show() {
    show(this.$emptyState, 'hide');
    hide(this.$videoActions, 'hide');
  }

  hide() {
    hide([this.$emptyState, this.$uploadProgress], 'hide');
    show(this.$videoActions, 'hide');
  }

  openFilePicker() {
    this.$fileInput.click();
  }

  isActive() {
    return this.isUploading || this.isConverting;
  }

  showConversionProgress() {
    this.isConverting = true;
    hide(this.$emptyState, 'hide');
    show(this.$uploadProgress, 'hide');

    this.$progressName.textContent = 'Converting video...';
    this.$progressSize.textContent = 'Please wait';
    this.$progressBar.style.width = '100%';
    this.$progressBar.classList.add('indeterminate');
    this.$progressStatus.textContent = 'Processing';
  }

  hideConversionProgress() {
    this.isConverting = false;
    hide(this.$uploadProgress, 'hide');
    this.$progressBar.style.width = '0%';
    this.$progressBar.classList.remove('indeterminate');
  }

  _updateProgress(percent, fileName) {
    this.$progressBar.classList.remove('indeterminate');
    this.$progressBar.style.width = `${percent}%`;
    this.$progressStatus.textContent = `${Math.round(percent)}%`;

    if (fileName) {
      this.$progressName.textContent = fileName;
    }
  }

  _showProgress(fileName, fileSize) {
    hide([this.$emptyState, this.$videoActions], 'hide');
    show(this.$uploadProgress, 'hide');
    this.$progressName.textContent = fileName;
    this.$progressSize.textContent = formatBytes(fileSize);
  }

  _hideProgress() {
    hide(this.$uploadProgress, 'hide');
    this.$progressBar.style.width = '0%';
    this.$progressBar.classList.remove('indeterminate');
  }

  async _handleFile(file) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('video/')) {
      this.callbacks.onError?.('Please select a video file');

      return;
    }

    const uuid = Config.getUuid();

    if (!uuid || uuid === '0') {
      this.callbacks.onError?.('No project selected');

      return;
    }

    this.isUploading = true;
    this._showProgress(file.name, file.size);

    try {
      await this.uploader.upload(file, uuid, {
        onProgress: (percent) => this._updateProgress(percent, file.name),
        onComplete: () => {
          this.isUploading = false;
          this.showConversionProgress();
          Config.invalidateCache();
          this.callbacks.onChange?.();
          this.callbacks.onComplete?.();
        },
        onError: (err) => {
          this.isUploading = false;
          this._hideProgress();
          this.show();
          this.callbacks.onError?.(err.message);
        }
      });
    } catch (err) {
      this.isUploading = false;
      this._hideProgress();
      this.show();
      this.callbacks.onError?.(err.message);
    }
  }

  async _deleteVideo() {
    const uuid = Config.getUuid();

    if (!uuid || uuid === '0') {
      return;
    }

    if (!confirm('Delete this video and its associated audio track?')) {
      return;
    }

    try {
      const response = await fetch(`${Config.getApiUrl()}api/studio/deleteVideo/${uuid}`, {
        method: 'DELETE'
      });

      const { status } = await response.json();

      if (status === 'deleted') {
        this.show();
        this.callbacks.onDelete?.();
      } else {
        this.callbacks.onError?.('Failed to delete video');
      }
    } catch (err) {
      this.callbacks.onError?.(err.message);
    }
  }

  _bindEvents() {
    this.$fileInput.addEventListener('change', (event) => {
      const { files } = event.target;

      if (files.length > 0) {
        this._handleFile(files[0]);
      }

      event.target.value = '';
    });

    this.$emptyState?.querySelector('.video-import-btn')?.addEventListener('click', () => {
      this.openFilePicker();
    });

    this.$videoActions?.querySelector('.video-delete-btn')?.addEventListener('click', () => {
      this._deleteVideo();
    });

    this.$videoActions?.querySelector('.video-change-btn')?.addEventListener('click', () => {
      this.openFilePicker();
    });
  }

  render($parent) {
    this.$fileInput = createFileInput({
      accept: ACCEPTED_VIDEO_EXTENSIONS,
      parent: $parent
    });

    this.$emptyState = createElement('div', {
      className: 'video-empty-state hide',
      html: `
        <i class="bi bi-camera-video fs-1"></i>
        <p>No video loaded</p>
        <button class="video-import-btn">
          <i class="bi bi-upload"></i>
          <span>Import Video</span>
        </button>
      `,
      parent: $parent
    });

    this.$uploadProgress = createElement('div', {
      className: 'video-upload-progress hide',
      html: `
        <div class="video-upload-info">
          <span class="video-upload-name"></span>
          <span class="video-upload-size"></span>
        </div>
        <div class="video-upload-bar-container">
          <div class="video-upload-bar"></div>
        </div>
        <span class="video-upload-status">0%</span>
      `,
      parent: $parent
    });

    this.$progressBar = this.$uploadProgress.querySelector('.video-upload-bar');
    this.$progressStatus = this.$uploadProgress.querySelector('.video-upload-status');
    this.$progressName = this.$uploadProgress.querySelector('.video-upload-name');
    this.$progressSize = this.$uploadProgress.querySelector('.video-upload-size');

    this.$videoActions = createElement('div', {
      className: 'video-actions hide',
      html: `
        <button class="video-action-btn video-change-btn" title="Change Video">
          <i class="bi bi-arrow-left-right"></i>
        </button>
        <button class="video-action-btn video-delete-btn" title="Delete Video">
          <i class="bi bi-trash"></i>
        </button>
      `,
      parent: $parent
    });
  }
}
