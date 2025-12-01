/**
 * LibraryActions - handles delete, selection, search, sort, drag
 */
import { ConfirmModal } from '../../core';

export default class LibraryActions {
  #model = null;
  #view = null;
  #playback = null;

  // Callbacks
  #onEmpty = null;
  #onAddToTimeline = null;

  // ============================================================================
  // Setup
  // ============================================================================

  setModel(model) {
    this.#model = model;
  }

  setView(view) {
    this.#view = view;
  }

  setPlayback(playback) {
    this.#playback = playback;
  }

  setCallbacks({ onEmpty, onAddToTimeline }) {
    this.#onEmpty = onEmpty;
    this.#onAddToTimeline = onAddToTimeline;
  }

  // ============================================================================
  // Selection
  // ============================================================================

  handleSelectAll() {
    if (this.#model.isAllSelected()) {
      this.#model.deselectAll();
    } else {
      this.#model.selectAll();
    }

    this.#updateToolbar();
    this.#view?.refreshVisibleSelections(this.#model.getSelectedIds());
  }

  toggleSelection(id) {
    this.#model.toggleSelection(id);
    this.#updateToolbar();
    this.#view?.updateItemSelection(id, this.#model.isSelected(id));
  }

  // ============================================================================
  // Delete
  // ============================================================================

  async confirmDeleteItem(id, name) {
    const confirmed = await ConfirmModal.show({
      title: 'Delete Track',
      message: `Are you sure you want to delete "${name}"?`,
      confirmText: 'Delete',
      danger: true
    });

    if (confirmed) {
      await this.#deleteItem(id);
    }
  }

  async handleDeleteSelected() {
    const count = this.#model.getSelectedCount();

    if (count === 0) {
      return;
    }

    const confirmed = await ConfirmModal.show({
      title: 'Delete Tracks',
      message: `Are you sure you want to delete ${count} selected track${count > 1 ? 's' : ''}?`,
      confirmText: 'Delete',
      danger: true
    });

    if (!confirmed) {
      return;
    }

    const currentPlayingId = this.#playback?.getCurrentPlayingId();
    const results = await this.#model.deleteSelected();

    results.forEach(({ id, success }) => {
      if (success) {
        if (currentPlayingId === id) {
          this.#playback?.stop();
        }

        this.#view?.removeItem(id);
      }
    });

    this.#updateToolbar();
    this.#checkEmptyState();
  }

  async #deleteItem(id) {
    try {
      if (this.#playback?.getCurrentPlayingId() === id) {
        this.#playback?.stop();
      }

      await this.#model.deleteItem(id);
      this.#view?.removeItem(id);
      this.#updateToolbar();
      this.#checkEmptyState();
    } catch (err) {
      console.error('[LibraryActions] Error deleting item:', id, err);
    }
  }

  // ============================================================================
  // Search & Sort
  // ============================================================================

  handleSearch(query) {
    const items = this.#model.setSearchQuery(query);

    this.#view?.setItems(items);
    this.#updateToolbar();
  }

  handleSort(field) {
    const items = this.#model.setSortField(field);

    this.#view?.setItems(items);
  }

  handleToggleSortDir() {
    const { items, isDesc } = this.#model.toggleSortDirection();

    this.#view?.setItems(items);
    this.#view?.updateSortDirection(isDesc);
  }

  // ============================================================================
  // Drag
  // ============================================================================

  handleDragStart() {
    document.querySelector('.studio')?.classList.add('is-dragging');
  }

  handleDragEnd() {
    document.querySelector('.studio')?.classList.remove('is-dragging');

    // Deselect all after drop
    this.#model.deselectAll();
    this.#updateToolbar();
    this.#view?.refreshVisibleSelections([]);
  }

  // ============================================================================
  // Add to Timeline
  // ============================================================================

  handleAddToTimeline() {
    const selectedIds = this.#model.getSelectedIds();

    if (selectedIds.length === 0) {
      return;
    }

    const tracks = selectedIds.map(id => {
      const item = this.#model.getItemById(id);

      return {
        id: item.id,
        label: item.name,
        duration: item.duration / 1000
      };
    });

    this.#onAddToTimeline?.(tracks);
    this.#model.deselectAll();
    this.#updateToolbar();
    this.#view?.refreshVisibleSelections(this.#model.getSelectedIds());
  }

  addSingleToTimeline(id) {
    const item = this.#model.getItemById(id);

    if (!item) {
      return;
    }

    const track = {
      id: item.id,
      label: item.name,
      duration: item.duration / 1000
    };

    this.#onAddToTimeline?.([track]);
  }

  getSelectedTracks() {
    const selectedIds = this.#model.getSelectedIds();

    return selectedIds.map(id => {
      const item = this.#model.getItemById(id);

      return {
        id: item.id,
        label: item.name,
        duration: item.duration / 1000
      };
    });
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  updateToolbar() {
    this.#updateToolbar();
  }

  #updateToolbar() {
    this.#view?.updateToolbar(
      this.#model.getSelectedCount(),
      this.#model.getItemCount(),
      this.#model.isAllSelected()
    );
  }

  #checkEmptyState() {
    if (this.#model.isEmpty()) {
      if (this.#playback?.getCurrentPlayingId()) {
        this.#playback?.stop();
      }

      this.#view?.showEmptyState();
      this.#onEmpty?.();
    }
  }

  checkEmptyState() {
    this.#checkEmptyState();
  }
}
