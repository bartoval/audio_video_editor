import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../../lib', () => ({
  isOnline: vi.fn(() => true)
}));

vi.mock('../../workspace', () => ({
  getUuid: vi.fn(() => 'test-uuid'),
  getLibraryTrackUrl: vi.fn(id => `/api/v1/workspaces/test-uuid/audio/${id}`)
}));

import OfflinePrefetch from '../OfflinePrefetch';
import { isOnline } from '../../../lib';
import { getUuid } from '../../workspace';

describe('OfflinePrefetch', () => {
  let mockServiceWorker;
  let mockRegistration;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock service worker
    mockRegistration = {
      active: {
        postMessage: vi.fn()
      }
    };

    mockServiceWorker = {
      ready: Promise.resolve(mockRegistration),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: mockServiceWorker,
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    OfflinePrefetch.getInstance().destroy();
  });

  describe('init', () => {
    it('should register message event listener', () => {
      OfflinePrefetch.init();

      expect(mockServiceWorker.addEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    it('should not register multiple listeners on repeated init', () => {
      OfflinePrefetch.init();
      OfflinePrefetch.init();

      expect(mockServiceWorker.addEventListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('prefetch', () => {
    beforeEach(() => {
      OfflinePrefetch.init();
    });

    it('should return false when offline', async () => {
      isOnline.mockReturnValue(false);

      const result = await OfflinePrefetch.prefetch({});

      expect(result).toBe(false);
    });

    it('should send PREFETCH_OFFLINE message to service worker', async () => {
      isOnline.mockReturnValue(true);

      const editorData = {
        tracks: [
          { audioId: 'track-1' },
          { audioId: '-1' }, // Original audio, should be skipped
          { audioId: 'track-2' }
        ]
      };

      const result = await OfflinePrefetch.prefetch(editorData);

      expect(result).toBe(true);
      expect(mockRegistration.active.postMessage).toHaveBeenCalledWith({
        type: 'PREFETCH_OFFLINE',
        payload: {
          uuid: 'test-uuid',
          audioUrls: [
            '/api/v1/workspaces/test-uuid/audio/track-1',
            '/api/v1/workspaces/test-uuid/audio/track-2'
          ],
          videoUrls: null
        }
      });
    });

    it('should include video URLs from editor data', async () => {
      isOnline.mockReturnValue(true);

      const editorData = {
        video: {
          urls: { small: '/video-small.mp4', medium: '/video-medium.mp4' }
        },
        tracks: []
      };

      await OfflinePrefetch.prefetch(editorData);

      expect(mockRegistration.active.postMessage).toHaveBeenCalledWith({
        type: 'PREFETCH_OFFLINE',
        payload: {
          uuid: 'test-uuid',
          audioUrls: [],
          videoUrls: { small: '/video-small.mp4', medium: '/video-medium.mp4' }
        }
      });
    });

    it('should set isPrefetching to true when prefetching', async () => {
      isOnline.mockReturnValue(true);

      await OfflinePrefetch.prefetch({});

      expect(OfflinePrefetch.isPrefetching).toBe(true);
    });

    it('should return false when no active service worker', async () => {
      isOnline.mockReturnValue(true);
      mockRegistration.active = null;

      const result = await OfflinePrefetch.prefetch({});

      expect(result).toBe(false);
    });
  });

  describe('checkStatus', () => {
    beforeEach(() => {
      OfflinePrefetch.init();
    });

    it('should send CHECK_OFFLINE_STATUS message to service worker', async () => {
      await OfflinePrefetch.checkStatus();

      expect(mockRegistration.active.postMessage).toHaveBeenCalledWith({
        type: 'CHECK_OFFLINE_STATUS',
        payload: { uuid: 'test-uuid' }
      });
    });

    it('should return false when no active service worker', async () => {
      mockRegistration.active = null;

      const result = await OfflinePrefetch.checkStatus();

      expect(result).toBe(false);
    });
  });

  describe('cancel', () => {
    beforeEach(() => {
      OfflinePrefetch.init();
    });

    it('should reset isPrefetching state', async () => {
      isOnline.mockReturnValue(true);
      await OfflinePrefetch.prefetch({});

      expect(OfflinePrefetch.isPrefetching).toBe(true);

      OfflinePrefetch.cancel();

      expect(OfflinePrefetch.isPrefetching).toBe(false);
    });
  });

  describe('message handling', () => {
    let messageHandler;

    beforeEach(() => {
      OfflinePrefetch.init();
      messageHandler = mockServiceWorker.addEventListener.mock.calls[0][1];
    });

    it('should set isPrefetching to false on complete status', async () => {
      isOnline.mockReturnValue(true);
      await OfflinePrefetch.prefetch({});

      expect(OfflinePrefetch.isPrefetching).toBe(true);

      messageHandler({
        data: {
          type: 'PREFETCH_PROGRESS',
          payload: {
            uuid: 'test-uuid',
            status: 'complete'
          }
        }
      });

      expect(OfflinePrefetch.isPrefetching).toBe(false);
    });

    it('should set isPrefetching to false on aborted status', async () => {
      isOnline.mockReturnValue(true);
      await OfflinePrefetch.prefetch({});

      expect(OfflinePrefetch.isPrefetching).toBe(true);

      messageHandler({
        data: {
          type: 'PREFETCH_PROGRESS',
          payload: {
            uuid: 'test-uuid',
            status: 'aborted'
          }
        }
      });

      expect(OfflinePrefetch.isPrefetching).toBe(false);
    });

    it('should ignore messages from other workspaces', async () => {
      isOnline.mockReturnValue(true);
      await OfflinePrefetch.prefetch({});

      expect(OfflinePrefetch.isPrefetching).toBe(true);

      messageHandler({
        data: {
          type: 'PREFETCH_PROGRESS',
          payload: {
            uuid: 'other-uuid',
            status: 'complete'
          }
        }
      });

      // Should still be prefetching since message was for different uuid
      expect(OfflinePrefetch.isPrefetching).toBe(true);
    });

    it('should dispatch offline-status event on OFFLINE_STATUS message', async () => {
      const eventHandler = vi.fn();
      window.addEventListener('offline-status', eventHandler);

      messageHandler({
        data: {
          type: 'OFFLINE_STATUS',
          payload: {
            uuid: 'test-uuid',
            available: true
          }
        }
      });

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { uuid: 'test-uuid', available: true }
        })
      );

      window.removeEventListener('offline-status', eventHandler);
    });

    it('should ignore OFFLINE_STATUS for different workspace', async () => {
      getUuid.mockReturnValue('current-uuid');

      const eventHandler = vi.fn();
      window.addEventListener('offline-status', eventHandler);

      messageHandler({
        data: {
          type: 'OFFLINE_STATUS',
          payload: {
            uuid: 'other-uuid',
            available: true
          }
        }
      });

      expect(eventHandler).not.toHaveBeenCalled();

      window.removeEventListener('offline-status', eventHandler);
    });
  });

  describe('destroy', () => {
    it('should remove message event listener', () => {
      OfflinePrefetch.init();

      OfflinePrefetch.getInstance().destroy();

      expect(mockServiceWorker.removeEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    it('should allow re-initialization after destroy', () => {
      OfflinePrefetch.init();
      OfflinePrefetch.getInstance().destroy();

      mockServiceWorker.addEventListener.mockClear();

      OfflinePrefetch.init();

      expect(mockServiceWorker.addEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });
  });
});
