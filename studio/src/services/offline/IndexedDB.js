/**
 * IndexedDB - offline data persistence
 *
 * Stores:
 * - workspaces: Project data (title, video, scenes, tracks)
 * - pendingSync: Operations to sync when online
 */

const DB_NAME = 'audio-video-sync';
const DB_VERSION = 2;

// Store names
const STORES = {
  WORKSPACES: 'workspaces',
  PENDING_SYNC: 'pendingSync'
};

class IndexedDBService {
  static #instance = null;
  #db = null;
  #isSupported = 'indexedDB' in window;

  // ============================================================================
  // Static API
  // ============================================================================

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

  // ============================================================================
  // Instance API
  // ============================================================================

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
        resolve(this.#db);
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

  async #ensureDb() {
    if (!this.#db) {
      await this.init();
    }
  }

  // ============================================================================
  // Public Getters
  // ============================================================================

  get isSupported() {
    return this.#isSupported;
  }
}

export default IndexedDBService;
export { STORES };
