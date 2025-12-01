/**
 * SyncManager - synchronizes pending operations when back online
 *
 * Events emitted via listeners:
 * - { type: 'start' }
 * - { type: 'complete', successCount, failCount }
 * - { type: 'online' }
 */
import IndexedDB from './IndexedDB';
import { buildUrl } from '../../config/routes';
import { isOnline } from '../../lib';

class SyncManager {
  static #instance = null;
  #isSyncing = false;
  #listeners = new Set();

  // ============================================================================
  // Static API
  // ============================================================================

  static getInstance() {
    if (!SyncManager.#instance) {
      SyncManager.#instance = new SyncManager();
    }

    return SyncManager.#instance;
  }

  static init() {
    return SyncManager.getInstance().init();
  }

  static sync() {
    return SyncManager.getInstance().sync();
  }

  static onSyncComplete(callback) {
    SyncManager.getInstance().#listeners.add(callback);

    return () => SyncManager.getInstance().#listeners.delete(callback);
  }

  // ============================================================================
  // Instance API
  // ============================================================================

  init() {
    window.addEventListener('online', this.#handleOnline);

    if (isOnline()) {
      this.sync();
    }
  }

  async sync() {
    if (this.#isSyncing || !isOnline()) {
      return;
    }

    this.#isSyncing = true;

    try {
      const pending = await IndexedDB.getPendingSync();

      if (pending.length === 0) {
        return;
      }

      this.#emit({ type: 'start', count: pending.length });

      let successCount = 0;
      let failCount = 0;

      pending.sort((a, b) => a.createdAt - b.createdAt);

      for (const operation of pending) {
        try {
          await this.#processOperation(operation);
          await IndexedDB.clearPendingSync(operation.id);
          successCount++;
        } catch (error) {
          if (error.message?.includes('fetch') || error.name === 'TypeError') {
            break;
          }

          failCount++;
        }
      }

      this.#emit({ type: 'complete', successCount, failCount });
    } finally {
      this.#isSyncing = false;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  #handleOnline = () => {
    this.#emit({ type: 'online' });
    setTimeout(() => this.sync(), 1000);
  };

  #emit(event) {
    this.#listeners.forEach(cb => cb(event));
  }

  async #processOperation(operation) {
    const { type, uuid, data } = operation;

    switch (type) {
      case 'backup':
        await this.#syncBackup(uuid, data);
        break;

      default:
        console.warn('[SyncManager] Unknown operation type:', type);
    }
  }

  async #syncBackup(uuid, data) {
    const response = await fetch(buildUrl('state', uuid), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Backup failed: ${response.status}`);
    }
  }

  // ============================================================================
  // Public Getters
  // ============================================================================

  get isSyncing() {
    return this.#isSyncing;
  }
}

export default SyncManager;
