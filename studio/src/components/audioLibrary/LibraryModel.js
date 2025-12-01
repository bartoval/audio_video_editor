import { getUuid } from '../../services/workspace';
import { deleteAudioLibraryItem } from '../../services/api';
import { isOnline } from '../../lib';

/**
 * LibraryModel - manages audio library data and selection state
 */
export default class LibraryModel {
  #isOffline = false;
  #items = [];
  #filteredItems = [];
  #selectedIds = new Set();
  #currentPlayingId = null;
  #src = '';
  #searchQuery = '';
  #sortField = 'name';
  #sortDesc = false;

  constructor(apiUrl = '') {
    this.#src = apiUrl;
  }

  // ============================================================================
  // Items
  // ============================================================================

  getItems() {
    return this.#filteredItems;
  }

  getAllItems() {
    return this.#items;
  }

  getItemById(id) {
    return this.#items.find(item => item.id === id);
  }

  getItemCount() {
    return this.#filteredItems.length;
  }

  getTotalCount() {
    return this.#items.length;
  }

  isEmpty() {
    return this.#items.length === 0;
  }

  setItems(items) {
    this.#items = items;
    this.#selectedIds.clear();
    this.#applyFilterAndSort();
  }

  removeItem(id) {
    this.#items = this.#items.filter(item => item.id !== id);
    this.#selectedIds.delete(id);

    if (this.#currentPlayingId === id) {
      this.#currentPlayingId = null;
    }

    this.#applyFilterAndSort();
  }

  // ============================================================================
  // Search & Sort
  // ============================================================================

  setSearchQuery(query) {
    this.#searchQuery = query.toLowerCase().trim();
    this.#applyFilterAndSort();

    return this.#filteredItems;
  }

  setSortField(field) {
    this.#sortField = field;
    this.#applyFilterAndSort();

    return this.#filteredItems;
  }

  toggleSortDirection() {
    this.#sortDesc = !this.#sortDesc;
    this.#applyFilterAndSort();

    return { items: this.#filteredItems, isDesc: this.#sortDesc };
  }

  isSortDesc() {
    return this.#sortDesc;
  }

  #applyFilterAndSort() {
    let items = [...this.#items];

    // Filter by search query (starts with)
    if (this.#searchQuery) {
      items = items.filter(item => item.name?.toLowerCase().startsWith(this.#searchQuery));
    }

    // Sort
    const dir = this.#sortDesc ? -1 : 1;

    items.sort((a, b) => {
      let result = 0;

      switch (this.#sortField) {
        case 'name':
          result = (a.name || '').localeCompare(b.name || '');
          break;
        case 'duration':
          result = (a.duration || 0) - (b.duration || 0);
          break;
        case 'date':
          result = new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
          break;
      }

      return result * dir;
    });

    this.#filteredItems = items;
  }

  // ============================================================================
  // Selection
  // ============================================================================

  getSelectedIds() {
    return [...this.#selectedIds];
  }

  getSelectedCount() {
    return this.#selectedIds.size;
  }

  isSelected(id) {
    return this.#selectedIds.has(id);
  }

  isAllSelected() {
    return this.#selectedIds.size === this.#items.length && this.#items.length > 0;
  }

  toggleSelection(id) {
    if (this.#selectedIds.has(id)) {
      this.#selectedIds.delete(id);
    } else {
      this.#selectedIds.add(id);
    }
  }

  selectAll() {
    this.#items.forEach(({ id }) => this.#selectedIds.add(id));
  }

  deselectAll() {
    this.#selectedIds.clear();
  }

  // ============================================================================
  // Playback State
  // ============================================================================

  getCurrentPlayingId() {
    return this.#currentPlayingId;
  }

  setCurrentPlayingId(id) {
    this.#currentPlayingId = id;
  }

  isPlaying(id) {
    return this.#currentPlayingId === id;
  }

  // ============================================================================
  // Offline State
  // ============================================================================

  isOffline() {
    return this.#isOffline;
  }

  // ============================================================================
  // API
  // ============================================================================

  async load() {
    if (!this.#src) {
      return [];
    }

    // Check offline before fetch
    if (!isOnline()) {
      this.#isOffline = true;

      return this.#items;
    }

    try {
      const response = await window.fetch(this.#src);
      const metaInfoList = await response.json();

      this.#items = Object.entries(metaInfoList).map(([id, data]) => ({ ...data, id }));
      this.#selectedIds.clear();
      this.#isOffline = false;
      this.#applyFilterAndSort();

      return this.#filteredItems;
    } catch {
      this.#isOffline = true;

      return this.#items;
    }
  }

  async deleteItem(id) {
    const uuid = getUuid();

    if (!uuid) {
      throw new Error('No project selected');
    }

    const { status } = await deleteAudioLibraryItem(id);

    if (status !== 'deleted') {
      throw new Error('Failed to delete');
    }

    this.removeItem(id);

    return true;
  }

  async deleteSelected() {
    const idsToDelete = [...this.#selectedIds];
    const results = [];

    for (const id of idsToDelete) {
      try {
        await this.deleteItem(id);
        results.push({ id, success: true });
      } catch (err) {
        results.push({ id, success: false, error: err });
      }
    }

    return results;
  }
}
