import { VirtualScroll, createElement, createFileInput, View } from '../../lib';
import { AudioUploader } from '../../services/upload';
import { CSS_CLASS } from '../../config/ui';
import {
  createToolbar,
  createDropzone,
  createListHeader,
  createUploadPanel,
  createMiniPlayer,
  createOfflineOverlay
} from './view';

export default class LibraryView extends View {
  #toolbar = null;
  #dropzone = null;
  #listHeader = null;
  #uploadPanel = null;
  #miniPlayer = null;
  #offlineOverlay = null;
  #$listContainer = null;
  #$fileInput = null;
  #$folderInput = null;
  #virtualScroll = null;

  handlers = {};

  constructor($parent) {
    super($parent);
  }

  render() {
    this.$parent.innerHTML = '';

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

    this.#$fileInput.addEventListener('change', event => {
      this.handlers.onFileSelect?.(event.target.files);
      event.target.value = '';
    });

    this.#$folderInput.addEventListener('change', event => {
      this.handlers.onFolderSelect?.(event.target.files);
      event.target.value = '';
    });

    this.#toolbar = createToolbar(this.$parent);
    this.#toolbar.bind({
      onImportFiles: () => this.openFilePicker(),
      onImportFolder: () => this.openFolderPicker(),
      onDeleteSelected: () => this.handlers.onDeleteSelected?.(),
      onAddToTimeline: () => this.handlers.onAddToTimeline?.(),
      onAiMusic: () => this.handlers.onAiMusic?.(),
      onSearch: query => this.handlers.onSearch?.(query),
      onSortField: field => this.handlers.onSort?.(field),
      onToggleSortDir: () => this.handlers.onToggleSortDir?.()
    });

    this.#dropzone = createDropzone(this.$parent);
    this.#dropzone.bind({
      onDrop: dataTransfer => this.handlers.onFileDrop?.(dataTransfer),
      onClick: () => this.openFilePicker()
    });

    this.#listHeader = createListHeader(this.$parent);
    this.#listHeader.bind({
      onSelectAll: () => this.handlers.onSelectAll?.()
    });

    this.#$listContainer = createElement('div', {
      className: 'library-list-container',
      parent: this.$parent
    });

    this.#offlineOverlay = createOfflineOverlay(this.$parent);

    this.#miniPlayer = createMiniPlayer(this.$parent);
    this.#miniPlayer.bind({
      onPause: () => this.handlers.onMiniPlayerPause?.(),
      onGoTo: () => this.handlers.onMiniPlayerGoTo?.(),
      onSeek: time => this.handlers.onMiniPlayerSeek?.(time)
    });

    this.#uploadPanel = createUploadPanel();
  }

  initVirtualScroll(renderItemFn, onRenderFn) {
    this.#virtualScroll = new VirtualScroll(this.#$listContainer, {
      itemHeight: 68,
      bufferSize: 5,
      renderItem: renderItemFn,
      onRender: onRenderFn
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

  scrollToItem(id) {
    this.#virtualScroll?.scrollToItem(id);
  }

  openFilePicker() {
    this.#$fileInput?.click();
  }

  openFolderPicker() {
    this.#$folderInput?.click();
  }

  updateToolbar(selectedCount, totalCount, allSelected) {
    this.#toolbar.updateState({ selectedCount });
    this.#listHeader.updateState({ count: totalCount, selectedCount, allSelected });
  }

  updateSortDirection(isDesc) {
    this.#toolbar.updateSortDir(isDesc);
  }

  showEmptyState() {
    this.#dropzone.show();
    this.#listHeader.hide();
    this.#$listContainer?.classList.add(CSS_CLASS.HIDE);
  }

  hideEmptyState() {
    this.#dropzone.hide();
    this.#listHeader.show();
    this.#$listContainer?.classList.remove(CSS_CLASS.HIDE);
  }

  updateItemSelection(id, isSelected) {
    const $item = this.getItemsContainer()?.querySelector(`[data-id="${id}"]`);
    if (!$item) return;
    $item.classList.toggle(CSS_CLASS.SELECTED, isSelected);
  }

  refreshVisibleSelections(selectedIds) {
    this.getItemsContainer()
      ?.querySelectorAll('.list-group-item')
      .forEach($item => {
        const { id } = $item.dataset;
        const isSelected = selectedIds.includes(id);
        $item.classList.toggle(CSS_CLASS.SELECTED, isSelected);
      });
  }

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

  showUploadList() {
    this.#uploadPanel.show();
  }

  hideUploadList() {
    this.#uploadPanel.hide();
  }

  createUploadHeader(totalFiles) {
    this.#uploadPanel.createHeader(totalFiles);
  }

  createUploadItem(file, index) {
    return this.#uploadPanel.createItem(file, index);
  }

  updateUploadItemProgress(index, percent) {
    this.#uploadPanel.updateItemProgress(index, percent);
  }

  setUploadItemState(index, state) {
    this.#uploadPanel.setItemState(index, state);
  }

  setUploadItemWarning(index, text) {
    this.#uploadPanel.setItemWarning(index, text);
  }

  updateTotalProgress(completedFiles, currentPercent, totalFiles) {
    this.#uploadPanel.updateTotalProgress(completedFiles, currentPercent, totalFiles);
  }

  setUploadComplete(successCount, totalFiles) {
    this.#uploadPanel.setComplete(successCount, totalFiles);
  }

  showOfflineOverlay() {
    this.#offlineOverlay.show();
  }

  hideOfflineOverlay() {
    this.#offlineOverlay.hide();
  }

  showMiniPlayer(trackName) {
    this.#miniPlayer.show(trackName);
  }

  hideMiniPlayer() {
    this.#miniPlayer.hide();
  }

  updateMiniPlayerState(isPlaying) {
    this.#miniPlayer.updateState(isPlaying);
  }

  setMiniPlayerWaveform(url, duration) {
    this.#miniPlayer.setWaveformSource(url, duration);
  }

  setMiniPlayerProgress(currentTime) {
    this.#miniPlayer.setWaveformProgress(currentTime);
  }

  clearMiniPlayerWaveform() {
    this.#miniPlayer.clearWaveform();
  }
}
