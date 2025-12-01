/**
 * LibraryPresenter - facade that coordinates library modules
 *
 * Delegates to:
 * - LibraryPlayback: audio playback and visualization
 * - LibraryUpload: file handling and upload
 * - LibraryActions: selection, delete, search, sort
 */
import LibraryModel from './LibraryModel';
import LibraryView from './LibraryView';
import { LibraryPlayback, LibraryUpload, LibraryActions } from './presenter';

export default class LibraryPresenter {
  #model = null;
  #view = null;

  // Delegate modules
  #playback = null;
  #upload = null;
  #actions = null;

  // Callbacks from config
  #onEmpty = null;
  #onLoad = null;

  constructor($parent, config = {}) {
    const { api, onEmpty, onLoad, onAddToTimeline } = config;

    this.#onEmpty = onEmpty;
    this.#onLoad = onLoad;

    // Initialize MVP
    this.#model = new LibraryModel(api?.list);
    this.#view = new LibraryView($parent);

    // Initialize delegate modules
    this.#playback = new LibraryPlayback();
    this.#upload = new LibraryUpload();
    this.#actions = new LibraryActions();

    // Wire up modules
    this.#playback.setView(this.#view);

    this.#upload.setView(this.#view);
    this.#upload.setOnComplete(() => this.reload());

    this.#actions.setModel(this.#model);
    this.#actions.setView(this.#view);
    this.#actions.setPlayback(this.#playback);
    this.#actions.setCallbacks({ onEmpty, onAddToTimeline });

    // Render view and bind events
    this.#view.render();
    this.#bindViewCallbacks();
    this.#initVirtualScroll();
    this.#initOfflineHandler();
  }

  // ============================================================================
  // Public API
  // ============================================================================

  load() {
    this.#model
      .load()
      .then(items => {
        if (this.#model.isOffline()) {
          this.#view.showOfflineOverlay();
        } else {
          this.#view.hideOfflineOverlay();
        }

        this.#view.setItems(items);
        this.#actions.updateToolbar();

        if (items.length === 0) {
          this.#view.showEmptyState();
          this.#onEmpty?.();
        } else {
          this.#view.hideEmptyState();
          this.#onLoad?.(items.length);
        }
      })
      .catch(() => {
        this.#view.showEmptyState();
        this.#onEmpty?.();
      });
  }

  reload() {
    this.#model.setItems([]);
    this.#view.setItems([]);
    this.load();
  }

  // ============================================================================
  // View Callbacks Binding
  // ============================================================================

  #bindViewCallbacks() {
    // File/Upload handlers
    this.#view.onFileSelect = files => this.#upload.handleFileSelect(files);
    this.#view.onFolderSelect = files => this.#upload.handleFileSelect(files);
    this.#view.onFileDrop = dataTransfer => this.#upload.handleDrop(dataTransfer);

    // Item click handler
    this.#view.onItemClick = event => this.#handleItemClick(event);

    // Action handlers
    this.#view.onSelectAll = () => this.#actions.handleSelectAll();
    this.#view.onDeleteSelected = () => this.#actions.handleDeleteSelected();
    this.#view.onAddToTimeline = () => this.#actions.handleAddToTimeline();
    this.#view.onDragStart = () => this.#actions.handleDragStart();
    this.#view.onDragEnd = () => this.#actions.handleDragEnd();
    this.#view.onGetSelectedTracks = () => this.#actions.getSelectedTracks();
    this.#view.onSearch = query => this.#actions.handleSearch(query);
    this.#view.onSort = field => this.#actions.handleSort(field);
    this.#view.onToggleSortDir = () => this.#actions.handleToggleSortDir();

    // Mini player handlers
    this.#view.onMiniPlayerPause = () => this.#playback.togglePlayPause();
    this.#view.onMiniPlayerGoTo = () => this.#playback.goToCurrentTrack();
  }

  #initVirtualScroll() {
    this.#view.initVirtualScroll(
      (data, index) => this.#renderItem(data, index),
      (data, $item) => this.#onItemRendered(data, $item)
    );
  }

  #initOfflineHandler() {
    window.addEventListener('online', () => this.#view.hideOfflineOverlay());
    window.addEventListener('offline', () => this.#view.showOfflineOverlay());
  }

  // ============================================================================
  // Item Rendering
  // ============================================================================

  #renderItem(data, index) {
    const isSelected = this.#model.isSelected(data.id);

    return this.#view.renderAudioItem(data, index, isSelected);
  }

  #onItemRendered(data) {
    const currentId = this.#playback.getCurrentPlayingId();

    if (currentId === data.id) {
      this.#playback.attachListOscilloscope(data.id);
    }
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  #handleItemClick(event) {
    const $playBtn = event.target.closest('.audio-play');

    if ($playBtn) {
      event.stopPropagation();
      event.preventDefault();

      const { id } = $playBtn.dataset;
      const item = this.#model.getItemById(id);

      this.#playback.play(id, item);

      return;
    }

    const $deleteBtn = event.target.closest('.audio-delete');

    if ($deleteBtn) {
      event.stopPropagation();
      event.preventDefault();

      const { id } = $deleteBtn.dataset;
      const item = this.#model.getItemById(id);

      if (item) {
        this.#actions.confirmDeleteItem(id, item.name);
      }

      return;
    }

    const $addBtn = event.target.closest('.audio-add');

    if ($addBtn) {
      event.stopPropagation();
      event.preventDefault();

      const { id } = $addBtn.dataset;
      this.#actions.addSingleToTimeline(id);

      return;
    }

    // Click on row (but not on drag handle) = toggle selection
    const $dragHandle = event.target.closest('.drag-handle');

    if ($dragHandle) {
      return;
    }

    const $row = event.target.closest('.list-group-item');

    if ($row) {
      const { id } = $row.dataset;
      this.#actions.toggleSelection(id);
    }
  }
}
