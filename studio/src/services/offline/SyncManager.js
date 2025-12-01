/**
 * SyncManager - synchronizes pending operations when back online
 *
 * Events emitted via listeners:
 * - { type: 'start' }
 * - { type: 'complete', successCount, failCount }
 * - { type: 'online' }
 * - { type: 'audio-prefetch-start', count }
 * - { type: 'audio-prefetch-progress', completed, total, percent }
 * - { type: 'audio-prefetch-complete', successCount, failCount }
 */
import IndexedDB from './IndexedDB';
import { buildUrl } from '../../config/routes';
import { EVENT } from '../../config/constants';
import { isOnline } from '../../lib';
import * as EventService from '../EventService';
import BufferCache from '../../lib/audio/BufferCache';

class SyncManager {
  static #instance = null;
  #isSyncing = false;
  #isPrefetching = false;
  #listeners = new Set();
  #prefetchAbortController = null;

  // Static API

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

  /**
   * Prefetch audio tracks for offline use
   * @param {string} workspaceUuid - Workspace UUID
   * @param {Array<{idTrack: string, url: string}>} audioManifest - List of tracks to prefetch
   * @returns {Promise<{success: number, failed: number}>}
   */
  static prefetchAudio(workspaceUuid, audioManifest) {
    return SyncManager.getInstance().prefetchAudio(workspaceUuid, audioManifest);
  }

  /**
   * Cancel any ongoing audio prefetch
   */
  static cancelPrefetch() {
    return SyncManager.getInstance().cancelPrefetch();
  }

  /**
   * Get offline status for a workspace's audio
   * @param {string} workspaceUuid - Workspace UUID
   * @param {Array<string>} trackIds - List of track IDs to check
   * @returns {Promise<{available: number, missing: number, trackStatus: Map}>}
   */
  static getAudioOfflineStatus(workspaceUuid, trackIds) {
    return SyncManager.getInstance().getAudioOfflineStatus(workspaceUuid, trackIds);
  }

  /**
   * Clear all audio for a workspace from IDB and notify SW
   * @param {string} workspaceUuid - Workspace UUID
   */
  static clearWorkspaceAudio(workspaceUuid) {
    return SyncManager.getInstance().clearWorkspaceAudio(workspaceUuid);
  }

  // Instance API

  init() {
    // Listen to browser online event (fallback)
    window.addEventListener('online', this.#handleOnline);

    // Listen to EventService connection events (SSE-based, more reliable)
    EventService.on(EVENT.CONNECTION, this.#handleEventServiceConnection);

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

  // Private Methods

  #handleOnline = async () => {
    // Only show toast if there are pending operations to sync
    const pending = await IndexedDB.getPendingSync();

    if (pending.length > 0) {
      this.#emit({ type: 'online' });
    }

    setTimeout(() => this.sync(), 1000);
  };

  #handleEventServiceConnection = async ({ online }) => {
    // When EventService detects we're back online, trigger sync
    if (online) {
      await this.#handleOnline();
    }
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

  // Audio Prefetch Methods

  /**
   * Prefetch audio tracks for offline use
   * Downloads and stores in IDB for offline access
   *
   * @param {string} workspaceUuid - Workspace UUID
   * @param {Array<{idTrack: string, url: string}>} audioManifest - Tracks to prefetch
   * @returns {Promise<{success: number, failed: number}>}
   */
  async prefetchAudio(workspaceUuid, audioManifest) {
    if (this.#isPrefetching) {
      this.cancelPrefetch();
    }

    if (!isOnline() || !audioManifest || audioManifest.length === 0) {
      return { success: 0, failed: 0 };
    }

    this.#isPrefetching = true;
    this.#prefetchAbortController = new AbortController();

    const total = audioManifest.length;
    let completed = 0;
    let success = 0;
    let failed = 0;

    this.#emit({ type: 'audio-prefetch-start', count: total });

    for (const { idTrack, url } of audioManifest) {
      // Check for abort
      if (this.#prefetchAbortController?.signal.aborted) {
        console.log('[SyncManager] Audio prefetch aborted');
        break;
      }

      try {
        // Check if already in IDB
        const existing = await IndexedDB.getAudioBlob(workspaceUuid, idTrack);

        if (existing?.blob) {
          success++;
          completed++;
          this.#emitPrefetchProgress(completed, total);

          continue;
        }

        // Fetch from network
        const response = await fetch(url, {
          signal: this.#prefetchAbortController?.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();

        // Save to IDB
        await IndexedDB.saveAudioBlob(workspaceUuid, idTrack, blob, {
          isDerived: false,
          mimeType: blob.type || 'audio/mpeg'
        });

        console.log('[SyncManager] Prefetched audio:', idTrack);
        success++;
      } catch (error) {
        if (error.name === 'AbortError') {
          break;
        }

        console.warn('[SyncManager] Failed to prefetch:', idTrack, error.message);
        failed++;
      }

      completed++;
      this.#emitPrefetchProgress(completed, total);
    }

    this.#isPrefetching = false;
    this.#prefetchAbortController = null;

    this.#emit({
      type: 'audio-prefetch-complete',
      successCount: success,
      failCount: failed
    });

    return { success, failed };
  }

  /**
   * Cancel ongoing prefetch operation
   */
  cancelPrefetch() {
    if (this.#prefetchAbortController) {
      this.#prefetchAbortController.abort();
      this.#prefetchAbortController = null;
    }

    this.#isPrefetching = false;
  }

  /**
   * Check offline status for audio tracks
   *
   * @param {string} workspaceUuid - Workspace UUID
   * @param {Array<string>} trackIds - Track IDs to check
   * @returns {Promise<{available: number, missing: number, trackStatus: Map}>}
   */
  async getAudioOfflineStatus(workspaceUuid, trackIds) {
    const trackStatus = new Map();
    let available = 0;
    let missing = 0;

    for (const idTrack of trackIds) {
      // Check RAM cache first
      const inCache = BufferCache.get(idTrack) !== null;

      if (inCache) {
        trackStatus.set(idTrack, { available: true, source: 'ram' });
        available++;

        continue;
      }

      // Check IDB
      const idbRecord = await IndexedDB.getAudioBlob(workspaceUuid, idTrack);

      if (idbRecord?.blob) {
        trackStatus.set(idTrack, { available: true, source: 'idb' });
        available++;
      } else {
        trackStatus.set(idTrack, { available: false, source: null });
        missing++;
      }
    }

    return { available, missing, trackStatus };
  }

  /**
   * Clear all audio for a workspace
   * Removes from IDB and notifies Service Worker
   *
   * @param {string} workspaceUuid - Workspace UUID
   */
  async clearWorkspaceAudio(workspaceUuid) {
    // Clear from IDB
    await IndexedDB.deleteAudioBlobsByWorkspace(workspaceUuid);

    // Notify Service Worker to clear Cache API
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'INVALIDATE_WORKSPACE_AUDIO',
        payload: { uuid: workspaceUuid }
      });
    }

    console.log('[SyncManager] Cleared workspace audio:', workspaceUuid);
  }

  #emitPrefetchProgress(completed, total) {
    this.#emit({
      type: 'audio-prefetch-progress',
      completed,
      total,
      percent: Math.round((completed / total) * 100)
    });
  }

  // Public Getters

  get isSyncing() {
    return this.#isSyncing;
  }

  get isPrefetching() {
    return this.#isPrefetching;
  }
}

export default SyncManager;
