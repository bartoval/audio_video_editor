import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing
vi.mock('../IndexedDB', () => ({
  default: {
    init: vi.fn(),
    getPendingSync: vi.fn(() => Promise.resolve([])),
    clearPendingSync: vi.fn(() => Promise.resolve()),
    getAudioBlob: vi.fn(() => Promise.resolve(null)),
    saveAudioBlob: vi.fn(() => Promise.resolve()),
    deleteAudioBlobsByWorkspace: vi.fn(() => Promise.resolve())
  }
}));

vi.mock('../../../lib', () => ({
  isOnline: vi.fn(() => true)
}));

vi.mock('../../../config/routes', () => ({
  buildUrl: vi.fn((type, uuid) => `/api/v1/workspaces/${uuid}/${type}`)
}));

vi.mock('../../EventService', () => ({
  on: vi.fn(() => vi.fn())
}));

vi.mock('../../../lib/audio/utils/AudioBufferSerializer', () => ({
  blobToAudioBuffer: vi.fn()
}));

vi.mock('../../../lib/audio/BufferCache', () => ({
  default: {
    get: vi.fn(() => null)
  }
}));

import SyncManager from '../SyncManager';
import IndexedDB from '../IndexedDB';
import { isOnline } from '../../../lib';
import BufferCache from '../../../lib/audio/BufferCache';

describe('SyncManager', () => {
  let instance;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    SyncManager['#instance'] = null;

    // Mock fetch
    global.fetch = vi.fn();

    // Mock service worker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        controller: {
          postMessage: vi.fn()
        }
      },
      writable: true,
      configurable: true
    });

    instance = SyncManager.getInstance();
  });

  afterEach(() => {
    SyncManager['#instance'] = null;
  });

  describe('Audio Prefetch', () => {
    describe('prefetchAudio', () => {
      it('should return empty result when offline', async () => {
        isOnline.mockReturnValue(false);

        const result = await SyncManager.prefetchAudio('ws-1', [
          { idTrack: 'track-1', url: '/audio/1' }
        ]);

        expect(result).toEqual({ success: 0, failed: 0 });
        expect(fetch).not.toHaveBeenCalled();
      });

      it('should return empty result for empty manifest', async () => {
        isOnline.mockReturnValue(true);

        const result = await SyncManager.prefetchAudio('ws-1', []);

        expect(result).toEqual({ success: 0, failed: 0 });
      });

      it('should return empty result for null manifest', async () => {
        isOnline.mockReturnValue(true);

        const result = await SyncManager.prefetchAudio('ws-1', null);

        expect(result).toEqual({ success: 0, failed: 0 });
      });

      it('should skip tracks already in IDB', async () => {
        isOnline.mockReturnValue(true);
        IndexedDB.getAudioBlob.mockResolvedValue({ blob: new Blob(['cached']) });

        const result = await SyncManager.prefetchAudio('ws-1', [
          { idTrack: 'track-1', url: '/audio/1' }
        ]);

        expect(result).toEqual({ success: 1, failed: 0 });
        expect(fetch).not.toHaveBeenCalled();
      });

      it('should fetch and save new tracks to IDB', async () => {
        isOnline.mockReturnValue(true);
        IndexedDB.getAudioBlob.mockResolvedValue(null);

        const mockBlob = new Blob(['audio data'], { type: 'audio/mpeg' });
        fetch.mockResolvedValue({
          ok: true,
          blob: () => Promise.resolve(mockBlob)
        });

        const result = await SyncManager.prefetchAudio('ws-1', [
          { idTrack: 'track-1', url: '/audio/1' }
        ]);

        expect(result).toEqual({ success: 1, failed: 0 });
        expect(fetch).toHaveBeenCalledWith('/audio/1', expect.any(Object));
        expect(IndexedDB.saveAudioBlob).toHaveBeenCalledWith('ws-1', 'track-1', mockBlob, {
          isDerived: false,
          mimeType: 'audio/mpeg'
        });
      });

      it('should handle fetch errors gracefully', async () => {
        isOnline.mockReturnValue(true);
        IndexedDB.getAudioBlob.mockResolvedValue(null);
        fetch.mockRejectedValue(new Error('Network error'));

        const result = await SyncManager.prefetchAudio('ws-1', [
          { idTrack: 'track-1', url: '/audio/1' }
        ]);

        expect(result).toEqual({ success: 0, failed: 1 });
      });

      it('should handle HTTP errors', async () => {
        isOnline.mockReturnValue(true);
        IndexedDB.getAudioBlob.mockResolvedValue(null);
        fetch.mockResolvedValue({ ok: false, status: 404 });

        const result = await SyncManager.prefetchAudio('ws-1', [
          { idTrack: 'track-1', url: '/audio/1' }
        ]);

        expect(result).toEqual({ success: 0, failed: 1 });
      });

      it('should emit progress events', async () => {
        isOnline.mockReturnValue(true);
        IndexedDB.getAudioBlob.mockResolvedValue(null);

        const mockBlob = new Blob(['audio']);
        fetch.mockResolvedValue({
          ok: true,
          blob: () => Promise.resolve(mockBlob)
        });

        const listener = vi.fn();
        SyncManager.onSyncComplete(listener);

        await SyncManager.prefetchAudio('ws-1', [
          { idTrack: 'track-1', url: '/audio/1' },
          { idTrack: 'track-2', url: '/audio/2' }
        ]);

        // Check for start event
        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'audio-prefetch-start', count: 2 })
        );

        // Check for progress events
        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'audio-prefetch-progress' })
        );

        // Check for complete event
        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'audio-prefetch-complete',
            successCount: 2,
            failCount: 0
          })
        );
      });
    });

    describe('cancelPrefetch', () => {
      it('should set isPrefetching to false', async () => {
        isOnline.mockReturnValue(true);
        IndexedDB.getAudioBlob.mockResolvedValue(null);

        // Start a long-running prefetch
        fetch.mockImplementation(
          () =>
            new Promise(resolve => {
              setTimeout(
                () =>
                  resolve({
                    ok: true,
                    blob: () => Promise.resolve(new Blob(['data']))
                  }),
                1000
              );
            })
        );

        const prefetchPromise = SyncManager.prefetchAudio('ws-1', [
          { idTrack: 'track-1', url: '/audio/1' }
        ]);

        // Cancel immediately
        SyncManager.cancelPrefetch();

        expect(instance.isPrefetching).toBe(false);
      });
    });

    describe('getAudioOfflineStatus', () => {
      it('should check RAM cache first', async () => {
        BufferCache.get.mockReturnValue({ duration: 1 }); // In RAM

        const result = await SyncManager.getAudioOfflineStatus('ws-1', ['track-1']);

        expect(result.available).toBe(1);
        expect(result.missing).toBe(0);
        expect(result.trackStatus.get('track-1')).toEqual({
          available: true,
          source: 'ram'
        });
      });

      it('should check IDB when not in RAM', async () => {
        BufferCache.get.mockReturnValue(null);
        IndexedDB.getAudioBlob.mockResolvedValue({ blob: new Blob(['data']) });

        const result = await SyncManager.getAudioOfflineStatus('ws-1', ['track-1']);

        expect(result.available).toBe(1);
        expect(result.missing).toBe(0);
        expect(result.trackStatus.get('track-1')).toEqual({
          available: true,
          source: 'idb'
        });
      });

      it('should mark as missing when not in RAM or IDB', async () => {
        BufferCache.get.mockReturnValue(null);
        IndexedDB.getAudioBlob.mockResolvedValue(null);

        const result = await SyncManager.getAudioOfflineStatus('ws-1', ['track-1']);

        expect(result.available).toBe(0);
        expect(result.missing).toBe(1);
        expect(result.trackStatus.get('track-1')).toEqual({
          available: false,
          source: null
        });
      });

      it('should handle multiple tracks', async () => {
        BufferCache.get.mockImplementation(id => (id === 'track-1' ? { duration: 1 } : null));
        IndexedDB.getAudioBlob.mockImplementation((ws, id) =>
          id === 'track-2' ? Promise.resolve({ blob: new Blob() }) : Promise.resolve(null)
        );

        const result = await SyncManager.getAudioOfflineStatus('ws-1', [
          'track-1',
          'track-2',
          'track-3'
        ]);

        expect(result.available).toBe(2);
        expect(result.missing).toBe(1);
      });
    });

    describe('clearWorkspaceAudio', () => {
      it('should delete from IDB and notify service worker', async () => {
        await SyncManager.clearWorkspaceAudio('ws-1');

        expect(IndexedDB.deleteAudioBlobsByWorkspace).toHaveBeenCalledWith('ws-1');
        expect(navigator.serviceWorker.controller.postMessage).toHaveBeenCalledWith({
          type: 'INVALIDATE_WORKSPACE_AUDIO',
          payload: { uuid: 'ws-1' }
        });
      });

      it('should not fail when no service worker controller', async () => {
        navigator.serviceWorker.controller = null;

        await expect(SyncManager.clearWorkspaceAudio('ws-1')).resolves.not.toThrow();
        expect(IndexedDB.deleteAudioBlobsByWorkspace).toHaveBeenCalledWith('ws-1');
      });
    });
  });

  describe('Getters', () => {
    it('should expose isSyncing state', () => {
      expect(instance.isSyncing).toBe(false);
    });

    it('should expose isPrefetching state', () => {
      expect(instance.isPrefetching).toBe(false);
    });
  });
});
