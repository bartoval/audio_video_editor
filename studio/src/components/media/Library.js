import VirtualScroll from 'core/VirtualScroll';
import Config from 'Config';
import Oscilloscope from 'Audio/Oscilloscope';
import AudioUploader from '../uploader/AudioUploader.js';
import { buildMetaString, formatBytes } from 'utils/format';
import { createElement, createFileInput, show, hide } from 'utils/dom';

export default class Library {
  constructor($parent, config = {}) {
    const { api, onEmpty, onLoad } = config;

    this.$parent = $parent;
    this.$toolbar = null;
    this.$uploadList = null;
    this.$uploadHeader = null;
    this.$uploadTotalBar = null;
    this.$uploadTotalText = null;
    this.$listContainer = null;
    this.$emptyState = null;
    this.$audio = null;
    this.$fileInput = null;
    this.$folderInput = null;

    this.virtualScroll = null;
    this.src = api?.list || '';
    this.onEmpty = onEmpty || null;
    this.onLoad = onLoad || null;
    this.audioItems = [];
    this.selectedIds = new Set();
    this.currentPlayingId = null;
    this._uploadTotalFiles = 0;
    this._uploadCurrentIndex = 0;
    this._uploadCurrentPercent = 0;

    this.oscilloscope = new Oscilloscope({ fftSize: 128, smoothing: 0.7, color: '#64b5f6', lineWidth: 1.5 });
    this.audioSource = null;
    this.audioContext = null;

    this.uploader = new AudioUploader({
      onStart: (files) => this._onUploadStart(files),
      onFileStart: (file, index) => this._onFileStart(file, index),
      onFileProgress: (file, index, percent) => this._onFileProgress(file, index, percent),
      onFileComplete: (file, index) => this._onFileComplete(file, index),
      onFileError: (file, index, error) => this._onFileError(file, index, error),
      onComplete: (success) => this._onUploadComplete(success),
      onError: (msg) => console.error('Upload error:', msg)
    });

    this.render($parent);
  }

  load() {
    if (!this.src) {
      this.onEmpty?.();

      return;
    }

    window.fetch(this.src)
      .then(response => response.json())
      .then(metaInfoList => {
        this.audioItems = Object.entries(metaInfoList).map(([id, data]) => ({ ...data, id }));
        this.selectedIds.clear();
        this._updateToolbar();
        this.virtualScroll.setItems(this.audioItems);

        if (this.audioItems.length === 0) {
          this._showEmptyState();
          this.onEmpty?.();
        } else {
          this._hideEmptyState();
          this.onLoad?.(this.audioItems.length);
        }
      })
      .catch(() => {
        this._showEmptyState();
        this.onEmpty?.();
      });
  }

  reload() {
    this.audioItems = [];
    this.selectedIds.clear();
    this.virtualScroll.setItems([]);
    this.load();
  }

  deleteItem(id) {
    const uuid = Config.getUuid();

    if (!uuid || uuid === '0') {
      return Promise.reject(new Error('No project selected'));
    }

    return fetch(`${Config.getApiUrl()}deleteAudio/${uuid}/${id}`, { method: 'DELETE' })
      .then(response => response.json())
      .then(({ status }) => {
        if (status !== 'deleted') {
          return false;
        }

        this.virtualScroll.removeItem(id);
        this.audioItems = this.audioItems.filter(item => item.id !== id);
        this.selectedIds.delete(id);
        this._updateToolbar();

        if (this.audioItems.length === 0) {
          this._showEmptyState();
          this.onEmpty?.();
        }

        return true;
      });
  }

  async deleteSelected() {
    const count = this.selectedIds.size;

    if (count === 0) {
      return;
    }

    if (!confirm(`Delete ${count} selected track${count > 1 ? 's' : ''}?`)) {
      return;
    }

    const idsToDelete = [...this.selectedIds];

    for (const id of idsToDelete) {
      try {
        await this.deleteItem(id);
      } catch (err) {
        console.error('Error deleting item:', id, err);
      }
    }
  }

  selectAll() {
    this.audioItems.forEach(({ id }) => this.selectedIds.add(id));
    this._updateToolbar();
    this._refreshVisibleSelections();
  }

  deselectAll() {
    this.selectedIds.clear();
    this._updateToolbar();
    this._refreshVisibleSelections();
  }

  // ============================================================================
  // Upload Callbacks
  // ============================================================================

  _onUploadStart(files) {
    this._uploadTotalFiles = files.length;
    this._uploadCurrentIndex = 0;
    this._uploadCurrentPercent = 0;

    this.$uploadList.innerHTML = '';
    this._createUploadHeader();

    files.forEach((file, index) => {
      const $item = this._createUploadItem(file, index);
      this.$uploadList.appendChild($item);
    });

    this._updateTotalProgress();
    show(this.$uploadList, 'hide');
  }

  _onFileStart(file, index) {
    this._uploadCurrentIndex = index;
    this._uploadCurrentPercent = 0;

    const $item = this.$uploadList.querySelector(`[data-index="${index}"]`);

    if ($item) {
      $item.classList.add('uploading');
      $item.querySelector('.upload-item-status').textContent = '0%';
    }

    this._updateTotalProgress();
  }

  _onFileProgress(file, index, percent) {
    this._uploadCurrentPercent = percent;

    const $item = this.$uploadList.querySelector(`[data-index="${index}"]`);

    if ($item) {
      $item.querySelector('.upload-item-bar').style.width = `${percent}%`;
      $item.querySelector('.upload-item-status').textContent = `${Math.round(percent)}%`;
    }

    this._updateTotalProgress();
  }

  _onFileComplete(file, index) {
    const $item = this.$uploadList.querySelector(`[data-index="${index}"]`);

    if ($item) {
      $item.classList.remove('uploading');
      $item.classList.add('complete');
      $item.querySelector('.upload-item-status').textContent = '✓';
    }

    this._uploadCurrentPercent = 100;
    this._updateTotalProgress();
  }

  _onFileError(file, index, error) {
    const $item = this.$uploadList.querySelector(`[data-index="${index}"]`);

    if ($item) {
      $item.classList.remove('uploading');
      $item.classList.add('error');
      $item.querySelector('.upload-item-status').textContent = '✗';
      $item.title = error;
    }

    this._updateTotalProgress();
  }

  _onUploadComplete(successCount) {
    if (this.$uploadTotalText) {
      this.$uploadTotalText.textContent = `Complete: ${successCount}/${this._uploadTotalFiles}`;
    }

    setTimeout(() => {
      hide(this.$uploadList, 'hide');
      this.$uploadList.innerHTML = '';
    }, 2000);

    if (successCount > 0) {
      this.reload();
    }
  }

  _createUploadHeader() {
    this.$uploadHeader = createElement('div', {
      className: 'upload-header',
      html: `
        <div class="upload-header-info">
          <i class="bi bi-cloud-arrow-up"></i>
          <span class="upload-total-text">Uploading 0/${this._uploadTotalFiles}</span>
        </div>
        <div class="upload-total-progress">
          <div class="upload-total-bar" style="width: 0%"></div>
        </div>
      `
    });

    this.$uploadList.appendChild(this.$uploadHeader);
    this.$uploadTotalBar = this.$uploadHeader.querySelector('.upload-total-bar');
    this.$uploadTotalText = this.$uploadHeader.querySelector('.upload-total-text');
  }

  _updateTotalProgress() {
    if (!this.$uploadTotalBar || !this.$uploadTotalText) {
      return;
    }

    const completedFiles = this._uploadCurrentIndex;
    const currentFileProgress = this._uploadCurrentPercent / 100;
    const totalProgress = ((completedFiles + currentFileProgress) / this._uploadTotalFiles) * 100;

    this.$uploadTotalBar.style.width = `${totalProgress}%`;
    this.$uploadTotalText.textContent = `Uploading ${completedFiles + 1}/${this._uploadTotalFiles} (${Math.round(totalProgress)}%)`;
  }

  _createUploadItem(file, index) {
    return createElement('div', {
      className: 'upload-item',
      attributes: { 'data-index': index },
      html: `
        <div class="upload-item-info">
          <span class="upload-item-name">${file.name}</span>
          <span class="upload-item-size">${formatBytes(file.size)}</span>
        </div>
        <div class="upload-item-progress">
          <div class="upload-item-bar" style="width: 0%"></div>
        </div>
        <span class="upload-item-status">Waiting...</span>
      `
    });
  }

  // ============================================================================
  // UI State
  // ============================================================================

  _showEmptyState() {
    this.$emptyState?.classList.remove('hide');
    this.$listContainer?.classList.add('hide');
  }

  _hideEmptyState() {
    this.$emptyState?.classList.add('hide');
    this.$listContainer?.classList.remove('hide');
  }

  _updateToolbar() {
    const count = this.selectedIds.size;
    const $deleteBtn = this.$toolbar.querySelector('.library-delete-selected');
    const $selectAllBtn = this.$toolbar.querySelector('.library-select-all');
    const $countSpan = this.$toolbar.querySelector('.library-count');

    if ($deleteBtn) {
      $deleteBtn.disabled = count === 0;
      $deleteBtn.textContent = count > 0 ? `Delete (${count})` : 'Delete';
    }

    if ($selectAllBtn) {
      const allSelected = count === this.audioItems.length && count > 0;
      $selectAllBtn.querySelector('i').className = allSelected ? 'bi bi-x-square' : 'bi bi-check2-square';
      $selectAllBtn.title = allSelected ? 'Deselect All' : 'Select All';
    }

    if ($countSpan) {
      $countSpan.textContent = `${this.audioItems.length} track${this.audioItems.length !== 1 ? 's' : ''}`;
    }
  }

  _updateItemSelection(id) {
    const $item = this.virtualScroll.getItemsContainer().querySelector(`[data-id="${id}"]`);

    if (!$item) {
      return;
    }

    const $checkbox = $item.querySelector('input.audio-checkbox');
    const isSelected = this.selectedIds.has(id);

    if ($checkbox) {
      $checkbox.checked = isSelected;
    }

    $item.classList.toggle('active', isSelected);
  }

  _refreshVisibleSelections() {
    this.virtualScroll.getItemsContainer().querySelectorAll('.list-group-item').forEach($item => {
      const { id } = $item.dataset;
      const $checkbox = $item.querySelector('input.audio-checkbox');
      const isSelected = this.selectedIds.has(id);

      if ($checkbox) {
        $checkbox.checked = isSelected;
      }

      $item.classList.toggle('active', isSelected);
    });
  }

  // ============================================================================
  // Audio Playback
  // ============================================================================

  _playAudio(id, $playBtn) {
    if (this.currentPlayingId === id) {
      if (this.$audio.paused) {
        this.$audio.play();
        $playBtn.querySelector('i').className = 'bi bi-pause-fill';
        this.oscilloscope.start();
      } else {
        this.$audio.pause();
        $playBtn.querySelector('i').className = 'bi bi-play-fill';
        this.oscilloscope.stop();
      }

      return;
    }

    if (this.currentPlayingId) {
      this.$audio.pause();
      this.oscilloscope.stop();

      const $prevBtn = this.virtualScroll.getItemsContainer().querySelector(`.audio-play[data-id="${this.currentPlayingId}"]`);

      if ($prevBtn) {
        $prevBtn.querySelector('i').className = 'bi bi-play-fill';
      }
    }

    this.currentPlayingId = id;
    this.$audio.src = Config.getLibraryTrack(id);
    this.$audio.load();

    this.$audio.onloadeddata = () => {
      this._initAudioContext();
      this._attachOscilloscope(id);
      this.$audio.play();
      this.oscilloscope.start();

      const $btn = this.virtualScroll.getItemsContainer().querySelector(`.audio-play[data-id="${id}"]`);

      if ($btn) {
        $btn.querySelector('i').className = 'bi bi-pause-fill';
      }
    };

    this.$audio.onended = () => {
      this.oscilloscope.stop();

      const $btn = this.virtualScroll.getItemsContainer().querySelector(`.audio-play[data-id="${this.currentPlayingId}"]`);

      if ($btn) {
        $btn.querySelector('i').className = 'bi bi-play-fill';
      }

      this.currentPlayingId = null;
    };
  }

  _initAudioContext() {
    if (this.analyser) {
      return;
    }

    this.audioContext = new AudioContext();
    this.audioSource = this.audioContext.createMediaElementSource(this.$audio);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 128;

    this.audioSource.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
  }

  _attachOscilloscope(id) {
    const $item = this.virtualScroll.getItemsContainer().querySelector(`[data-id="${id}"]`);

    if (!$item) {
      return;
    }

    const $canvas = $item.querySelector('.oscilloscope-canvas');

    if (!$canvas) {
      return;
    }

    this.oscilloscope.attachAnalyser(this.analyser);
    this.oscilloscope.attach($canvas);
  }

  _onItemRendered(data, $item) {
    const { id } = data;

    if (id !== this.currentPlayingId || !this.oscilloscope.isActive()) {
      return;
    }

    const $canvas = $item.querySelector('.oscilloscope-canvas');

    if ($canvas) {
      this.oscilloscope.attach($canvas);
    }
  }

  // ============================================================================
  // Rendering
  // ============================================================================

  _renderAudioItem(data, index) {
    const { id, name, duration, durationFormatted } = data;
    const metaString = buildMetaString(data);
    const durationSec = duration / 1000 || 0;
    const isSelected = this.selectedIds.has(id);

    const $li = document.createElement('li');
    $li.className = `list-group-item d-flex justify-content-between align-items-center px-3 py-2 draggable${isSelected ? ' active' : ''}`;
    $li.draggable = true;
    $li.dataset.id = id;
    $li.dataset.index = index;

    $li.innerHTML = `
      <i class="bi bi-grip-vertical drag-handle text-warning opacity-50 fs-4 align-self-center" title="Drag to timeline"></i>
      <input class="form-check-input audio-checkbox m-0 align-self-center" type="checkbox" data-id="${id}" ${isSelected ? 'checked' : ''}>
      <button class="btn btn-sm btn-outline-info audio-play align-self-center" data-id="${id}" title="Preview">
        <i class="bi bi-play-fill"></i>
      </button>
      <span class="text-truncate flex-grow-1 align-self-center" title="${name}">${name}</span>
      <canvas class="oscilloscope-canvas mx-2" width="220" height="28"></canvas>
      <small class="text-body-tertiary align-self-center text-nowrap">${metaString}</small>
      <code class="text-body-secondary align-self-center text-nowrap ms-2">${durationFormatted || '00:00'}</code>
      <button class="btn btn-sm btn-outline-danger audio-delete align-self-center ms-2" data-id="${id}" title="Delete">
        <i class="bi bi-trash"></i>
      </button>
    `;

    $li.addEventListener('dragstart', event => {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/plain', JSON.stringify({
        id,
        label: name,
        duration: durationSec
      }));
      $li.classList.add('dragging');
      document.querySelector('.studio')?.classList.add('is-dragging');
    });

    $li.addEventListener('dragend', () => {
      $li.classList.remove('dragging');
      document.querySelector('.studio')?.classList.remove('is-dragging');
    });

    return $li;
  }

  _createToolbar() {
    const $toolbar = createElement('div', {
      className: 'library-toolbar d-flex justify-content-between align-items-center px-2 py-2 border-bottom'
    });

    $toolbar.innerHTML = `
      <div class="btn-group btn-group-sm">
        <button class="btn btn-outline-secondary library-import-files" title="Import Files">
          <i class="bi bi-file-earmark-music"></i>
          <span class="d-none d-lg-inline ms-1">Files</span>
        </button>
        <button class="btn btn-outline-secondary library-import-folder" title="Import Folder">
          <i class="bi bi-folder2-open"></i>
          <span class="d-none d-lg-inline ms-1">Folder</span>
        </button>
        <button class="btn btn-outline-secondary library-select-all" title="Select All">
          <i class="bi bi-check2-square"></i>
        </button>
      </div>
      <div class="d-flex align-items-center gap-2">
        <small class="text-body-tertiary library-count">0 tracks</small>
        <button class="btn btn-sm btn-outline-danger library-delete-selected" disabled>Delete</button>
      </div>
    `;

    $toolbar.querySelector('.library-import-files').addEventListener('click', () => {
      this.$fileInput.click();
    });

    $toolbar.querySelector('.library-import-folder').addEventListener('click', () => {
      this.$folderInput.click();
    });

    $toolbar.querySelector('.library-select-all').addEventListener('click', () => {
      const allSelected = this.selectedIds.size === this.audioItems.length && this.audioItems.length > 0;
      allSelected ? this.deselectAll() : this.selectAll();
    });

    $toolbar.querySelector('.library-delete-selected').addEventListener('click', () => {
      this.deleteSelected();
    });

    return $toolbar;
  }

  _handleFileSelect(files) {
    if (files.length > 0) {
      this.uploader.uploadFiles(files);
    }
  }

  render($parent) {
    $parent.innerHTML = '';

    // Hidden file inputs
    this.$fileInput = createFileInput({
      accept: AudioUploader.acceptedExtensions,
      multiple: true,
      parent: $parent
    });

    this.$folderInput = createElement('input', {
      attributes: {
        type: 'file',
        accept: AudioUploader.acceptedExtensions,
        webkitdirectory: '',
        directory: ''
      },
      styles: { display: 'none' },
      parent: $parent
    });

    this.$fileInput.addEventListener('change', (e) => {
      this._handleFileSelect(e.target.files);
      e.target.value = '';
    });

    this.$folderInput.addEventListener('change', (e) => {
      this._handleFileSelect(e.target.files);
      e.target.value = '';
    });

    this.$audio = document.createElement('audio');
    this.$audio.preload = 'none';
    this.$audio.crossOrigin = 'anonymous';
    $parent.appendChild(this.$audio);

    // Toolbar
    this.$toolbar = this._createToolbar();
    $parent.appendChild(this.$toolbar);

    // Upload progress list (between toolbar and content)
    this.$uploadList = createElement('div', {
      className: 'upload-list hide',
      parent: $parent
    });

    // Empty state
    this.$emptyState = createElement('div', {
      className: 'd-flex flex-column align-items-center justify-content-center flex-grow-1 text-body-tertiary text-center p-4 hide',
      html: `
        <i class="bi bi-music-note-list fs-1 mb-3 opacity-50"></i>
        <p class="mb-1">No audio tracks yet</p>
        <small>Click <strong class="text-info">Files</strong> or <strong class="text-info">Folder</strong> to import audio</small>
      `,
      parent: $parent
    });

    // List container with virtual scroll
    this.$listContainer = createElement('div', {
      className: 'library-list-container',
      parent: $parent
    });

    this.virtualScroll = new VirtualScroll(this.$listContainer, {
      itemHeight: 60,
      bufferSize: 5,
      renderItem: (data, index) => this._renderAudioItem(data, index),
      onRender: (data, $item) => this._onItemRendered(data, $item)
    });

    // Event delegation for list items
    const $itemsContainer = this.virtualScroll.getItemsContainer();

    $itemsContainer.addEventListener('click', event => {
      const $checkbox = event.target.closest('input.audio-checkbox');

      if ($checkbox) {
        event.stopPropagation();
        const { id } = $checkbox.dataset;
        this.selectedIds.has(id) ? this.selectedIds.delete(id) : this.selectedIds.add(id);
        this._updateToolbar();
        this._updateItemSelection(id);

        return;
      }

      const $playBtn = event.target.closest('.audio-play');

      if ($playBtn) {
        event.stopPropagation();
        event.preventDefault();
        const { id } = $playBtn.dataset;
        this._playAudio(id, $playBtn);

        return;
      }

      const $deleteBtn = event.target.closest('.audio-delete');

      if ($deleteBtn) {
        event.stopPropagation();
        event.preventDefault();

        const { id } = $deleteBtn.dataset;
        const item = this.audioItems.find(audio => audio.id === id);

        if (item && confirm(`Delete "${item.name}"?`)) {
          this.deleteItem(id);
        }
      }
    });
  }
}
