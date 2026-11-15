/**
 * SyncManager - synchronizes projects only on explicit request
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
import { syncProjects } from './ProjectSync';
import { isOnline } from '../../lib';
import BufferCache from '../../lib/audio/BufferCache';

class SyncManager {
  static #instance = null;
  #isSyncing = false;
  #syncPromise = null;
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

  // Synchronization is explicit; starting the app or reconnecting never sends edits.
  init() {}

  sync() {
    if (this.#syncPromise) return this.#syncPromise;
    this.#isSyncing = true;
    this.#syncPromise = syncProjects(status => this.#emit({ type: 'progress', status }))
      .then(result => {
        this.#emit({ type: 'complete', ...result });
        return result;
      })
      .finally(() => {
        this.#isSyncing = false;
        this.#syncPromise = null;
        this.#emit({ type: 'idle' });
      });
    return this.#syncPromise;
  }

  #emit(event) {
    this.#listeners.forEach(cb => cb(event));
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
