import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock IDB implementation
const createMockIDBRequest = (result = undefined, error = null) => {
  const request = {
    result,
    error,
    onsuccess: null,
    onerror: null
  };

  setTimeout(() => {
    if (error) {
      request.onerror?.();
    } else {
      request.onsuccess?.();
    }
  }, 0);

  return request;
};

const createMockObjectStore = (data = {}) => ({
  get: vi.fn(key => createMockIDBRequest(data[key])),
  getAll: vi.fn(() => createMockIDBRequest(Object.values(data))),
  put: vi.fn(item => createMockIDBRequest(item.key || item.uuid || item.id)),
  delete: vi.fn(() => createMockIDBRequest()),
  clear: vi.fn(() => createMockIDBRequest()),
  index: vi.fn(() => ({
    getAll: vi.fn(value =>
      createMockIDBRequest(Object.values(data).filter(item => item.workspaceUuid === value))
    )
  }))
});

const createMockTransaction = (stores = {}) => ({
  objectStore: vi.fn(name => stores[name] || createMockObjectStore())
});

const createMockDB = (stores = {}) => ({
  transaction: vi.fn((storeNames, mode) => createMockTransaction(stores)),
  objectStoreNames: {
    contains: vi.fn(name => Object.keys(stores).includes(name))
  },
  createObjectStore: vi.fn(() => ({
    createIndex: vi.fn()
  })),
  deleteObjectStore: vi.fn()
});

describe('IndexedDB Service', () => {
  let IndexedDBService;
  let mockDB;
  let mockStores;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Setup mock stores with data
    mockStores = {
      workspaces: createMockObjectStore({}),
      pendingSync: createMockObjectStore({}),
      audioBlobs: createMockObjectStore({})
    };

    mockDB = createMockDB(mockStores);

    // Mock indexedDB global
    const mockIndexedDB = {
      open: vi.fn(() => {
        const request = {
          result: mockDB,
          error: null,
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null
        };

        setTimeout(() => {
          request.onsuccess?.();
        }, 0);

        return request;
      })
    };

    vi.stubGlobal('indexedDB', mockIndexedDB);

    // Dynamic import to get fresh instance
    const module = await import('../IndexedDB');
    IndexedDBService = module.default;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Audio Blob Methods', () => {
    describe('buildAudioKey', () => {
      it('should build key from workspace uuid and track id', () => {
        const key = IndexedDBService.buildAudioKey('workspace-123', 'track-456');

        expect(key).toBe('workspace-123:track-456');
      });
    });

    describe('getAudioBlob', () => {
      it('should get audio blob by workspace and track id', async () => {
        const mockBlob = { blob: new Blob(['test']), size: 4 };
        mockStores.audioBlobs = createMockObjectStore({
          'ws-1:track-1': mockBlob
        });
        mockDB = createMockDB(mockStores);

        await IndexedDBService.init();
        const result = await IndexedDBService.getAudioBlob('ws-1', 'track-1');

        expect(result).toEqual(mockBlob);
      });

      it('should return undefined for non-existent blob', async () => {
        await IndexedDBService.init();
        const result = await IndexedDBService.getAudioBlob('ws-1', 'non-existent');

        expect(result).toBeUndefined();
      });
    });

    describe('saveAudioBlob', () => {
      it('should save audio blob with metadata', async () => {
        await IndexedDBService.init();

        const blob = new Blob(['audio data'], { type: 'audio/mpeg' });

        await IndexedDBService.saveAudioBlob('ws-1', 'track-1', blob, {
          isDerived: false,
          mimeType: 'audio/mpeg'
        });

        const store = mockDB.transaction().objectStore('audioBlobs');

        expect(store.put).toHaveBeenCalledWith(
          expect.objectContaining({
            key: 'ws-1:track-1',
            workspaceUuid: 'ws-1',
            idTrack: 'track-1',
            blob,
            size: blob.size,
            mimeType: 'audio/mpeg',
            isDerived: false
          })
        );
      });

      it('should use default options when not provided', async () => {
        await IndexedDBService.init();

        const blob = new Blob(['data']);

        await IndexedDBService.saveAudioBlob('ws-1', 'track-1', blob);

        const store = mockDB.transaction().objectStore('audioBlobs');

        expect(store.put).toHaveBeenCalledWith(
          expect.objectContaining({
            isDerived: false,
            mimeType: 'audio/wav',
            sourceHash: null
          })
        );
      });
    });

    describe('deleteAudioBlob', () => {
      it('should delete audio blob by workspace and track id', async () => {
        await IndexedDBService.init();

        await IndexedDBService.deleteAudioBlob('ws-1', 'track-1');

        const store = mockDB.transaction().objectStore('audioBlobs');

        expect(store.delete).toHaveBeenCalledWith('ws-1:track-1');
      });
    });

    describe('getAudioBlobsByWorkspace', () => {
      it('should get all audio blobs for a workspace', async () => {
        const blobs = [
          { key: 'ws-1:track-1', workspaceUuid: 'ws-1' },
          { key: 'ws-1:track-2', workspaceUuid: 'ws-1' }
        ];
        mockStores.audioBlobs = createMockObjectStore({
          'ws-1:track-1': blobs[0],
          'ws-1:track-2': blobs[1]
        });
        mockDB = createMockDB(mockStores);

        await IndexedDBService.init();
        const result = await IndexedDBService.getAudioBlobsByWorkspace('ws-1');

        expect(result).toEqual(blobs);
      });
    });

    describe('getAudioCacheLimit', () => {
      it('should return cache limit constant', () => {
        const limit = IndexedDBService.getAudioCacheLimit();

        expect(limit).toBe(500 * 1024 * 1024); // 500MB
      });
    });

    describe('getAudioBlobsTotalSize', () => {
      it('should calculate total size of all audio blobs', async () => {
        const blobs = [
          { key: 'ws-1:track-1', size: 1000 },
          { key: 'ws-1:track-2', size: 2000 },
          { key: 'ws-2:track-1', size: 3000 }
        ];
        mockStores.audioBlobs = createMockObjectStore({
          'ws-1:track-1': blobs[0],
          'ws-1:track-2': blobs[1],
          'ws-2:track-1': blobs[2]
        });
        mockDB = createMockDB(mockStores);

        await IndexedDBService.init();
        const result = await IndexedDBService.getAudioBlobsTotalSize();

        expect(result).toBe(6000);
      });

      it('should handle blobs without size property', async () => {
        const blobs = [
          { key: 'ws-1:track-1', size: 1000 },
          { key: 'ws-1:track-2' } // no size
        ];
        mockStores.audioBlobs = createMockObjectStore({
          'ws-1:track-1': blobs[0],
          'ws-1:track-2': blobs[1]
        });
        mockDB = createMockDB(mockStores);

        await IndexedDBService.init();
        const result = await IndexedDBService.getAudioBlobsTotalSize();

        expect(result).toBe(1000);
      });
    });

    describe('clearAllAudioBlobs', () => {
      it('should clear all audio blobs', async () => {
        await IndexedDBService.init();

        await IndexedDBService.clearAllAudioBlobs();

        const store = mockDB.transaction().objectStore('audioBlobs');

        expect(store.clear).toHaveBeenCalled();
      });
    });
  });

  describe('isSupported', () => {
    it('should return true when indexedDB is available', () => {
      const instance = IndexedDBService.getInstance();

      expect(instance.isSupported).toBe(true);
    });
  });
});
