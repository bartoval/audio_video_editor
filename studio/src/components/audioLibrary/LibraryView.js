import {
  VirtualScroll,
  buildMetaString,
  formatBytes,
  createElement,
  createFileInput,
  show,
  hide,
  View
} from '../../lib';
import { AudioUploader } from '../../services/upload';
import { LABEL } from '../../constants';

/**
 * LibraryView - handles all DOM rendering for the library
 */
export default class LibraryView extends View {
  #$toolbar = null;
  #$uploadList = null;
  #$uploadHeader = null;
  #$uploadTotalBar = null;
  #$uploadTotalText = null;
  #$listHeader = null;
  #$listContainer = null;
  #$emptyState = null;
  #$fileInput = null;
  #$folderInput = null;
  #$offlineOverlay = null;
  #$miniPlayer = null;
  #virtualScroll = null;

  // Callbacks set by presenter
  onFileSelect = null;
  onFolderSelect = null;
  onFileDrop = null;
  onItemClick = null;
  onSelectAll = null;
  onDeleteSelected = null;
  onAddToTimeline = null;
  onDragStart = null;
  onDragEnd = null;
  onGetSelectedTracks = null;
  onSearch = null;
  onSort = null;
  onToggleSortDir = null;
  onMiniPlayerPause = null;
  onMiniPlayerGoTo = null;

  constructor($parent) {
    super($parent);
  }

  // ============================================================================
  // Render
  // ============================================================================

  render() {
    this.$parent.innerHTML = '';

    // Hidden file inputs
    this.#$fileInput = createFileInput({
      accept: AudioUploader.acceptedExtensions,
      multiple: true,
      parent: this.$parent
    });

    this.#$folderInput = createElement('input', {
      attributes: {
        type: 'file',
        accept: AudioUploader.acceptedExtensions,
        webkitdirectory: '',
        directory: ''
      },
      styles: { display: 'none' },
      parent: this.$parent
    });

    this.#$fileInput.addEventListener('change', e => {
      this.onFileSelect?.(e.target.files);
      e.target.value = '';
    });

    this.#$folderInput.addEventListener('change', e => {
      this.onFolderSelect?.(e.target.files);
      e.target.value = '';
    });

    // Toolbar
    this.#$toolbar = this.#createToolbar();
    this.$parent.appendChild(this.#$toolbar);

    // Upload progress list (appended to body for fixed positioning)
    this.#$uploadList = createElement('div', {
      className: 'upload-list hide',
      parent: document.body
    });

    // Empty state - drop zone
    this.#$emptyState = createElement('div', {
      className: 'library-drop-zone hide',
      html: `
        <div class="drop-zone-content">
          <i class="bi bi-cloud-arrow-up"></i>
          <p>Drop audio files here</p>
          <span>or click to browse</span>
        </div>
      `,
      parent: this.$parent
    });

    this.#$emptyState.addEventListener('click', () => this.openFilePicker());
    this.#$emptyState.addEventListener('dragover', e => {
      e.preventDefault();
      this.#$emptyState.classList.add('drag-over');
    });
    this.#$emptyState.addEventListener('dragleave', () => {
      this.#$emptyState.classList.remove('drag-over');
    });
    this.#$emptyState.addEventListener('drop', e => {
      e.preventDefault();
      this.#$emptyState.classList.remove('drag-over');
      this.onFileDrop?.(e.dataTransfer);
    });

    // List header with track count and select all button
    this.#$listHeader = createElement('div', {
      className:
        'library-list-header d-flex align-items-center justify-content-between px-3 py-2 border-bottom bg-body-tertiary',
      html: `
        <small class="text-body-secondary">
          <span class="library-count">0</span> tracks
          <span class="library-selected-count text-info ms-2"></span>
        </small>
        <button class="btn btn-sm btn-link library-select-all p-0 text-decoration-none">Select All</button>
      `,
      parent: this.$parent
    });

    this.#$listHeader.querySelector('.library-select-all').addEventListener('click', () => {
      this.onSelectAll?.();
    });

    // List container with virtual scroll
    this.#$listContainer = createElement('div', {
      className: 'library-list-container',
      parent: this.$parent
    });

    // Offline overlay
    this.#$offlineOverlay = createElement('div', {
      className: 'library-offline-overlay',
      html: `
        <i class="bi bi-wifi-off offline-icon"></i>
        <span class="offline-label">${LABEL.LIBRARY_OFFLINE}</span>
        <span class="offline-hint">${LABEL.LIBRARY_OFFLINE_HINT}</span>
      `,
      parent: this.$parent
    });

    // Mini-player (fixed at bottom when track is playing)
    this.#$miniPlayer = createElement('div', {
      className: 'library-mini-player',
      html: `
        <div class="mini-player-content">
          <button class="btn btn-sm btn-outline-info mini-player-pause" title="Pause">
            <i class="bi bi-pause-fill"></i>
          </button>
          <span class="mini-player-track text-truncate"></span>
          <div class="mini-player-waveform-container">
            <canvas class="mini-player-waveform"></canvas>
          </div>
          <button class="btn btn-sm btn-outline-secondary mini-player-goto" title="Go to track">
            <i class="bi bi-arrow-up-circle"></i>
          </button>
        </div>
      `,
      parent: this.$parent
    });

    this.#$miniPlayer.querySelector('.mini-player-pause').addEventListener('click', () => {
      this.onMiniPlayerPause?.();
    });

    this.#$miniPlayer.querySelector('.mini-player-goto').addEventListener('click', () => {
      this.onMiniPlayerGoTo?.();
    });
  }

  // ============================================================================
  // Virtual Scroll
  // ============================================================================

  initVirtualScroll(renderItemFn, onRenderFn) {
    this.#virtualScroll = new VirtualScroll(this.#$listContainer, {
      itemHeight: 60,
      bufferSize: 5,
      renderItem: renderItemFn,
      onRender: onRenderFn
    });

    // Event delegation for list items
    const $itemsContainer = this.#virtualScroll.getItemsContainer();

    $itemsContainer.addEventListener('click', event => {
      this.onItemClick?.(event);
    });
  }

  setItems(items) {
    this.#virtualScroll?.setItems(items);
  }

  removeItem(id) {
    this.#virtualScroll?.removeItem(id);
  }

  getItemsContainer() {
    return this.#virtualScroll?.getItemsContainer();
  }

  // ============================================================================
  // Item Rendering
  // ============================================================================

  renderAudioItem(data, index, isSelected) {
    const { id, name, duration, durationFormatted } = data;
    const metaString = buildMetaString(data);
    const durationSec = duration / 1000 || 0;

    const $li = document.createElement('li');
    $li.className = `list-group-item d-flex justify-content-between align-items-center px-3 py-2 draggable${isSelected ? ' selected' : ''}`;
    $li.dataset.id = id;
    $li.dataset.index = index;
    $li.draggable = true;

    $li.innerHTML = `
      <i class="bi bi-grip-vertical drag-handle text-body-tertiary fs-4 align-self-center" title="Drag to timeline"></i>
      <button class="btn btn-sm btn-outline-info audio-play align-self-center" data-id="${id}" title="Preview">
        <i class="bi bi-play-fill"></i>
      </button>
      <span class="text-truncate flex-grow-1 align-self-center library-track-name" title="${name}">${name}</span>
      <canvas class="oscilloscope-canvas mx-2" width="220" height="28"></canvas>
      <small class="text-body-tertiary align-self-center text-nowrap">${metaString}</small>
      <code class="text-body-secondary align-self-center text-nowrap ms-2">${durationFormatted || '00:00'}</code>
      <button class="btn btn-sm btn-outline-info audio-add align-self-center ms-2" data-id="${id}" title="Add to timeline">
        <i class="bi bi-plus-lg"></i>
      </button>
      <button class="btn btn-sm btn-outline-danger audio-delete align-self-center ms-1" data-id="${id}" title="Delete">
        <i class="bi bi-trash"></i>
      </button>
    `;

    // Drag events
    $li.addEventListener('dragstart', event => {
      event.dataTransfer.effectAllowed = 'copy';

      // Get selected tracks data from callback, or use current track
      const selectedTracks = this.onGetSelectedTracks?.() || [];
      const tracksToAdd =
        selectedTracks.length > 0
          ? selectedTracks
          : [{ id, label: name, duration: durationSec }];

      event.dataTransfer.setData('text/plain', JSON.stringify(tracksToAdd));
      $li.classList.add('dragging');
      this.onDragStart?.();
    });

    $li.addEventListener('dragend', () => {
      $li.classList.remove('dragging');
      this.onDragEnd?.();
    });

    return $li;
  }

  // ============================================================================
  // Toolbar
  // ============================================================================

  #createToolbar() {
    const $toolbar = createElement('div', {
      className: 'library-toolbar d-flex flex-column gap-3 px-3 py-3 border-bottom'
    });

    $toolbar.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-secondary library-import-files" title="Import Files">
            <i class="bi bi-file-earmark-music"></i>
            <span class="d-none d-lg-inline ms-1">Files</span>
          </button>
          <button class="btn btn-outline-secondary library-import-folder" title="Import Folder">
            <i class="bi bi-folder2-open"></i>
            <span class="d-none d-lg-inline ms-1">Folder</span>
          </button>
        </div>
        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-sm btn-outline-info library-add-to-timeline" disabled title="Add selected to timeline">
            <i class="bi bi-plus-circle"></i> Timeline
          </button>
          <button class="btn btn-sm btn-outline-danger library-delete-selected" disabled>Delete</button>
        </div>
      </div>
      <div class="d-flex gap-2">
        <div class="input-group flex-grow-1">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input type="text" class="form-control library-search" placeholder="Search...">
        </div>
        <select class="form-select library-sort-field" style="width: auto;">
          <option value="name">Name</option>
          <option value="duration">Duration</option>
          <option value="date">Date</option>
        </select>
        <button class="btn btn-outline-secondary library-sort-dir" title="Toggle sort direction">
          <i class="bi bi-sort-alpha-down"></i>
        </button>
      </div>
    `;

    $toolbar.querySelector('.library-import-files').addEventListener('click', () => {
      this.openFilePicker();
    });

    $toolbar.querySelector('.library-import-folder').addEventListener('click', () => {
      this.openFolderPicker();
    });

    $toolbar.querySelector('.library-delete-selected').addEventListener('click', () => {
      this.onDeleteSelected?.();
    });

    $toolbar.querySelector('.library-add-to-timeline').addEventListener('click', () => {
      this.onAddToTimeline?.();
    });

    $toolbar.querySelector('.library-search').addEventListener('input', e => {
      this.onSearch?.(e.target.value);
    });

    $toolbar.querySelector('.library-sort-field').addEventListener('change', e => {
      this.onSort?.(e.target.value);
    });

    $toolbar.querySelector('.library-sort-dir').addEventListener('click', () => {
      this.onToggleSortDir?.();
    });

    return $toolbar;
  }

  updateToolbar(selectedCount, totalCount, allSelected) {
    const $deleteBtn = this.#$toolbar.querySelector('.library-delete-selected');
    const $addToTimelineBtn = this.#$toolbar.querySelector('.library-add-to-timeline');
    const $selectAllBtn = this.#$listHeader?.querySelector('.library-select-all');
    const $countSpan = this.#$listHeader?.querySelector('.library-count');
    const $selectedCountSpan = this.#$listHeader?.querySelector('.library-selected-count');

    if ($deleteBtn) {
      $deleteBtn.disabled = selectedCount === 0;
      $deleteBtn.textContent = selectedCount > 0 ? `Delete (${selectedCount})` : 'Delete';
    }

    if ($addToTimelineBtn) {
      $addToTimelineBtn.disabled = selectedCount === 0;
      $addToTimelineBtn.innerHTML =
        selectedCount > 0
          ? `<i class="bi bi-plus-circle"></i> Add (${selectedCount})`
          : '<i class="bi bi-plus-circle"></i> Add to Timeline';
    }

    if ($selectAllBtn) {
      $selectAllBtn.textContent = allSelected ? 'Deselect All' : 'Select All';
    }

    if ($countSpan) {
      $countSpan.textContent = totalCount;
    }

    if ($selectedCountSpan) {
      $selectedCountSpan.textContent = selectedCount > 0 ? `(${selectedCount} selected)` : '';
    }
  }

  updateSortDirection(isDesc) {
    const $btn = this.#$toolbar.querySelector('.library-sort-dir');

    if ($btn) {
      const $icon = $btn.querySelector('i');
      $icon.className = isDesc ? 'bi bi-sort-down' : 'bi bi-sort-up';
      $btn.title = isDesc ? 'Descending' : 'Ascending';
    }
  }

  // ============================================================================
  // State
  // ============================================================================

  showEmptyState() {
    this.#$emptyState?.classList.remove('hide');
    this.#$listHeader?.classList.add('hide');
    this.#$listContainer?.classList.add('hide');
  }

  hideEmptyState() {
    this.#$emptyState?.classList.add('hide');
    this.#$listHeader?.classList.remove('hide');
    this.#$listContainer?.classList.remove('hide');
  }

  openFilePicker() {
    this.#$fileInput?.click();
  }

  openFolderPicker() {
    this.#$folderInput?.click();
  }

  // ============================================================================
  // Selection UI
  // ============================================================================

  updateItemSelection(id, isSelected) {
    const $item = this.getItemsContainer()?.querySelector(`[data-id="${id}"]`);

    if (!$item) {
      return;
    }

    $item.classList.toggle('selected', isSelected);
  }

  refreshVisibleSelections(selectedIds) {
    this.getItemsContainer()
      ?.querySelectorAll('.list-group-item')
      .forEach($item => {
        const { id } = $item.dataset;
        const isSelected = selectedIds.includes(id);

        $item.classList.toggle('selected', isSelected);
      });
  }

  // ============================================================================
  // Play Button UI
  // ============================================================================

  setPlayButtonState(id, isPlaying) {
    const $btn = this.getItemsContainer()?.querySelector(`.audio-play[data-id="${id}"]`);

    if ($btn) {
      $btn.querySelector('i').className = isPlaying ? 'bi bi-pause-fill' : 'bi bi-play-fill';
    }
  }

  getOscilloscopeCanvas(id) {
    const $item = this.getItemsContainer()?.querySelector(`[data-id="${id}"]`);

    return $item?.querySelector('.oscilloscope-canvas');
  }

  // ============================================================================
  // Upload UI
  // ============================================================================

  showUploadList() {
    show(this.#$uploadList, 'hide');
  }

  hideUploadList() {
    hide(this.#$uploadList, 'hide');
    this.#$uploadList.innerHTML = '';
  }

  createUploadHeader(totalFiles) {
    this.#$uploadHeader = createElement('div', {
      className: 'rounded p-2 mb-2 border border-info-subtle bg-info bg-opacity-10',
      html: `
        <div class="d-flex align-items-center gap-2 mb-2">
          <i class="bi bi-cloud-arrow-up text-info"></i>
          <span class="small fw-medium text-white" data-ref="totalText">Uploading 0/${totalFiles}</span>
        </div>
        <div class="progress" style="height: 6px;">
          <div class="progress-bar bg-info" data-ref="totalBar" style="width: 0%"></div>
        </div>
      `
    });

    this.#$uploadList.appendChild(this.#$uploadHeader);
    this.#$uploadTotalBar = this.#$uploadHeader.querySelector('[data-ref="totalBar"]');
    this.#$uploadTotalText = this.#$uploadHeader.querySelector('[data-ref="totalText"]');
  }

  createUploadItem(file, index) {
    const $item = createElement('div', {
      className: 'd-flex align-items-center gap-2 rounded upload-item',
      attributes: { 'data-index': index },
      html: `
        <div class="flex-grow-1 d-flex flex-column gap-1 min-width-0">
          <span class="small text-white text-truncate">${file.name}</span>
          <span class="text-body-tertiary" style="font-size: 10px">${formatBytes(file.size)}</span>
        </div>
        <div class="progress" style="width: 100px; height: 4px;">
          <div class="progress-bar bg-info" data-ref="bar" style="width: 0%"></div>
        </div>
        <span class="text-body-secondary small text-end" style="width: 40px" data-ref="status">Waiting...</span>
      `
    });

    this.#$uploadList.appendChild($item);

    return $item;
  }

  updateUploadItemProgress(index, percent) {
    const $item = this.#$uploadList.querySelector(`[data-index="${index}"]`);

    if ($item) {
      $item.querySelector('[data-ref="bar"]').style.width = `${percent}%`;
      $item.querySelector('[data-ref="status"]').textContent = `${Math.round(percent)}%`;
    }
  }

  setUploadItemState(index, state) {
    const $item = this.#$uploadList.querySelector(`[data-index="${index}"]`);

    if (!$item) {
      return;
    }

    const $bar = $item.querySelector('[data-ref="bar"]');
    const $status = $item.querySelector('[data-ref="status"]');

    // Update progress bar color based on state
    if ($bar) {
      $bar.classList.remove('bg-info', 'bg-success', 'bg-danger');
      const barColorMap = { uploading: 'bg-info', complete: 'bg-success', error: 'bg-danger' };
      $bar.classList.add(barColorMap[state] || 'bg-info');
    }

    // Update status text and color
    if ($status) {
      const statusMap = { uploading: '0%', complete: '✓', error: '✗' };
      const statusColorMap = {
        uploading: 'text-body-secondary',
        complete: 'text-success',
        error: 'text-danger'
      };

      $status.textContent = statusMap[state] || '';
      $status.classList.remove('text-body-secondary', 'text-success', 'text-danger');
      $status.classList.add(statusColorMap[state] || 'text-body-secondary');
    }

    // Update item opacity for completed
    if (state === 'complete') {
      $item.style.opacity = '0.6';
    }
  }

  updateTotalProgress(completedFiles, currentPercent, totalFiles) {
    if (!this.#$uploadTotalBar || !this.#$uploadTotalText) {
      return;
    }

    const currentFileProgress = currentPercent / 100;
    const totalProgress = ((completedFiles + currentFileProgress) / totalFiles) * 100;

    this.#$uploadTotalBar.style.width = `${totalProgress}%`;
    this.#$uploadTotalText.textContent = `Uploading ${completedFiles + 1}/${totalFiles} (${Math.round(totalProgress)}%)`;
  }

  setUploadComplete(successCount, totalFiles) {
    if (this.#$uploadTotalText) {
      this.#$uploadTotalText.textContent = `Complete: ${successCount}/${totalFiles}`;
    }
  }

  // ============================================================================
  // Offline Overlay
  // ============================================================================

  showOfflineOverlay() {
    this.#$offlineOverlay?.classList.add('visible');
  }

  hideOfflineOverlay() {
    this.#$offlineOverlay?.classList.remove('visible');
  }

  // ============================================================================
  // Mini Player
  // ============================================================================

  showMiniPlayer(trackName) {
    if (!this.#$miniPlayer) {
      return;
    }

    this.#$miniPlayer.querySelector('.mini-player-track').textContent = trackName;
    this.#$miniPlayer.classList.add('visible');
  }

  hideMiniPlayer() {
    this.#$miniPlayer?.classList.remove('visible');
  }

  updateMiniPlayerState(isPlaying) {
    const $btn = this.#$miniPlayer?.querySelector('.mini-player-pause');

    if ($btn) {
      const $icon = $btn.querySelector('i');
      $icon.className = isPlaying ? 'bi bi-pause-fill' : 'bi bi-play-fill';
      $btn.title = isPlaying ? 'Pause' : 'Play';
    }
  }

  getMiniPlayerCanvas() {
    return this.#$miniPlayer?.querySelector('.mini-player-waveform');
  }

  scrollToItem(id) {
    this.#virtualScroll?.scrollToItem(id);
  }
}
