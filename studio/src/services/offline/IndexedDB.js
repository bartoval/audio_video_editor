/**
 * IndexedDB - offline data persistence
 *
 * Stores:
 * - workspaces: Project data (title, video, scenes, tracks)
 * - pendingSync: Operations to sync when online
 * - audioBlobs: Cached audio files for offline playback
 */

const DB_NAME = 'audio-video-sync';
const DB_VERSION = 3;

// Store names
const STORES = {
  WORKSPACES: 'workspaces',
  PENDING_SYNC: 'pendingSync',
  AUDIO_BLOBS: 'audioBlobs'
};

// Audio blob storage limits
const AUDIO_CACHE_LIMIT = 500 * 1024 * 1024; // 500MB

class IndexedDBService {
  static #instance = null;
  #db = null;
  #isSupported = 'indexedDB' in window;

  // Static API

  static getInstance() {
    if (!IndexedDBService.#instance) {
      IndexedDBService.#instance = new IndexedDBService();
    }

    return IndexedDBService.#instance;
  }

  static async init() {
    return IndexedDBService.getInstance().init();
  }

  // Workspaces
  static async getWorkspace(uuid) {
    return IndexedDBService.getInstance().get(STORES.WORKSPACES, uuid);
  }

  static async getAllWorkspaces() {
    return IndexedDBService.getInstance().getAll(STORES.WORKSPACES);
  }

  static async saveWorkspace(uuid, data) {
    return IndexedDBService.getInstance().put(STORES.WORKSPACES, {
      uuid,
      ...data,
      updatedAt: Date.now()
    });
  }

  static async deleteWorkspace(uuid) {
    return IndexedDBService.getInstance().delete(STORES.WORKSPACES, uuid);
  }

  // Pending Sync
  static async addPendingSync(operation) {
    return IndexedDBService.getInstance().put(STORES.PENDING_SYNC, {
      ...operation,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now()
    });
  }

  static async getPendingSync() {
    return IndexedDBService.getInstance().getAll(STORES.PENDING_SYNC);
  }

  static async clearPendingSync(id) {
    return IndexedDBService.getInstance().delete(STORES.PENDING_SYNC, id);
  }

  static async clearAllPendingSync() {
    return IndexedDBService.getInstance().clear(STORES.PENDING_SYNC);
  }

  // Audio Blobs

  /**
   * Build key for audio blob storage
   * @param {string} workspaceUuid - Workspace UUID (or 'library' for shared tracks)
   * @param {string} idTrack - Track ID
   * @returns {string} Storage key
   */
  static buildAudioKey(workspaceUuid, idTrack) {
    return `${workspaceUuid}:${idTrack}`;
  }

  /**
   * Get audio blob from storage
   * @param {string} workspaceUuid - Workspace UUID
   * @param {string} idTrack - Track ID
   * @returns {Promise<Object|null>} Audio blob record or null
   */
  static async getAudioBlob(workspaceUuid, idTrack) {
    const key = IndexedDBService.buildAudioKey(workspaceUuid, idTrack);

    return IndexedDBService.getInstance().get(STORES.AUDIO_BLOBS, key);
  }

  /**
   * Save audio blob to storage
   * @param {string} workspaceUuid - Workspace UUID
   * @param {string} idTrack - Track ID
   * @param {Blob} blob - Audio blob data
   * @param {Object} options - Additional metadata
   * @param {boolean} options.isDerived - True if processed (stretched, etc)
   * @param {string} options.sourceHash - Hash of source for invalidation
   * @param {string} options.mimeType - MIME type of audio
   * @returns {Promise<void>}
   */
  static async saveAudioBlob(workspaceUuid, idTrack, blob, options = {}) {
    const key = IndexedDBService.buildAudioKey(workspaceUuid, idTrack);
    const { isDerived = false, sourceHash = null, mimeType = 'audio/wav' } = options;

    const record = {
      key,
      workspaceUuid,
      idTrack,
      blob,
      size: blob.size,
      mimeType,
      isDerived,
      sourceHash,
      updatedAt: Date.now()
    };

    // Check storage limits before saving
    await IndexedDBService.getInstance().#enforceStorageLimit(record.size);

    return IndexedDBService.getInstance().put(STORES.AUDIO_BLOBS, record);
  }

  /**
   * Delete audio blob from storage
   * @param {string} workspaceUuid - Workspace UUID
   * @param {string} idTrack - Track ID
   * @returns {Promise<void>}
   */
  static async deleteAudioBlob(workspaceUuid, idTrack) {
    const key = IndexedDBService.buildAudioKey(workspaceUuid, idTrack);

    return IndexedDBService.getInstance().delete(STORES.AUDIO_BLOBS, key);
  }

  /**
   * Get all audio blobs for a workspace
   * @param {string} workspaceUuid - Workspace UUID
   * @returns {Promise<Array>} Audio blob records
   */
  static async getAudioBlobsByWorkspace(workspaceUuid) {
    return IndexedDBService.getInstance().getByIndex(
      STORES.AUDIO_BLOBS,
      'workspaceUuid',
      workspaceUuid
    );
  }

  /**
   * Delete all audio blobs for a workspace
   * @param {string} workspaceUuid - Workspace UUID
   * @returns {Promise<void>}
   */
  static async deleteAudioBlobsByWorkspace(workspaceUuid) {
    const blobs = await IndexedDBService.getAudioBlobsByWorkspace(workspaceUuid);

    for (const blob of blobs) {
      await IndexedDBService.getInstance().delete(STORES.AUDIO_BLOBS, blob.key);
    }
  }

  /**
   * Delete all derived audio blobs for a workspace
   * @param {string} workspaceUuid - Workspace UUID
   * @returns {Promise<void>}
   */
  static async deleteDerivedAudioBlobs(workspaceUuid) {
    const blobs = await IndexedDBService.getAudioBlobsByWorkspace(workspaceUuid);

    for (const blob of blobs) {
      if (blob.isDerived) {
        await IndexedDBService.getInstance().delete(STORES.AUDIO_BLOBS, blob.key);
      }
    }
  }

  /**
   * Get total size of audio blobs in storage
   * @returns {Promise<number>} Total size in bytes
   */
  static async getAudioBlobsTotalSize() {
    const allBlobs = await IndexedDBService.getInstance().getAll(STORES.AUDIO_BLOBS);

    return allBlobs.reduce((total, blob) => total + (blob.size || 0), 0);
  }

  /**
   * Clear all audio blobs
   * @returns {Promise<void>}
   */
  static async clearAllAudioBlobs() {
    return IndexedDBService.getInstance().clear(STORES.AUDIO_BLOBS);
  }

  /**
   * Get storage limit for audio blobs
   * @returns {number} Limit in bytes
   */
  static getAudioCacheLimit() {
    return AUDIO_CACHE_LIMIT;
  }

  // Instance API

  async init() {
    if (!this.#isSupported) {
      return null;
    }

    if (this.#db) {
      return this.#db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.#db = request.result;

        // Handle version change (another tab upgraded the DB)
        this.#db.onversionchange = () => {
          this.#db.close();
          this.#db = null;
          console.log('[IndexedDB] Database version changed, connection closed');
        };

        resolve(this.#db);
      };

      request.onblocked = () => {
        console.warn('[IndexedDB] Database upgrade blocked - close other tabs');
      };

      request.onupgradeneeded = event => {
        const db = event.target.result;

        // Workspaces store
        if (!db.objectStoreNames.contains(STORES.WORKSPACES)) {
          db.createObjectStore(STORES.WORKSPACES, { keyPath: 'uuid' });
        }

        // Remove old projects store if exists
        if (db.objectStoreNames.contains('projects')) {
          db.deleteObjectStore('projects');
        }

        // Pending sync store
        if (!db.objectStoreNames.contains(STORES.PENDING_SYNC)) {
          const store = db.createObjectStore(STORES.PENDING_SYNC, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Audio blobs store (v3)
        if (!db.objectStoreNames.contains(STORES.AUDIO_BLOBS)) {
          const audioStore = db.createObjectStore(STORES.AUDIO_BLOBS, { keyPath: 'key' });
          audioStore.createIndex('workspaceUuid', 'workspaceUuid', { unique: false });
          audioStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          audioStore.createIndex('isDerived', 'isDerived', { unique: false });
        }
      };
    });
  }

  async get(storeName, key) {
    await this.#ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = this.#db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getAll(storeName) {
    await this.#ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = this.#db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async put(storeName, data) {
    await this.#ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = this.#db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async delete(storeName, key) {
    await this.#ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = this.#db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(storeName) {
    await this.#ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = this.#db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Get all records matching an index value
   * @param {string} storeName - Store name
   * @param {string} indexName - Index name
   * @param {*} value - Value to match
   * @returns {Promise<Array>} Matching records
   */
  async getByIndex(storeName, indexName, value) {
    await this.#ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = this.#db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  /**
   * Enforce storage limit by evicting oldest entries (LRU)
   * @param {number} neededBytes - Bytes needed for new entry
   */
  async #enforceStorageLimit(neededBytes) {
    const allBlobs = await this.getAll(STORES.AUDIO_BLOBS);
    let totalSize = allBlobs.reduce((sum, blob) => sum + (blob.size || 0), 0);

    // If we're under limit after adding new entry, no eviction needed
    if (totalSize + neededBytes <= AUDIO_CACHE_LIMIT) {
      return;
    }

    // Sort by updatedAt (oldest first) for LRU eviction
    const sorted = allBlobs.sort((a, b) => a.updatedAt - b.updatedAt);

    // Evict oldest entries until we have room
    for (const blob of sorted) {
      if (totalSize + neededBytes <= AUDIO_CACHE_LIMIT) {
        break;
      }

      // Skip derived blobs initially (prefer evicting source copies)
      // This is a simple heuristic - derived can be regenerated
      if (!blob.isDerived) {
        await this.delete(STORES.AUDIO_BLOBS, blob.key);
        totalSize -= blob.size || 0;
        console.log('[IndexedDB] Evicted audio blob:', blob.key, 'size:', blob.size);
      }
    }

    // If still over limit, evict derived blobs too
    for (const blob of sorted) {
      if (totalSize + neededBytes <= AUDIO_CACHE_LIMIT) {
        break;
      }

      if (blob.isDerived) {
        await this.delete(STORES.AUDIO_BLOBS, blob.key);
        totalSize -= blob.size || 0;
        console.log('[IndexedDB] Evicted derived audio blob:', blob.key);
      }
    }
  }

  async #ensureDb() {
    if (!this.#db) {
      await this.init();
    }
  }

  // Public Getters

  get isSupported() {
    return this.#isSupported;
  }
}

export default IndexedDBService;
export { STORES, AUDIO_CACHE_LIMIT };
