import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock IndexedDB
const mockIndexedDB = {
  getInstance: vi.fn(),
  put: vi.fn(),
  get: vi.fn(),
  delete: vi.fn()
};

vi.mock('../../services/offline/IndexedDB', () => ({
  default: mockIndexedDB
}));

describe('persist', () => {
  let persist, rehydrate, clearPersisted;
  let mockStore;
  let mockInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();

    // Mock IndexedDB instance
    mockInstance = {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined)
    };

    mockIndexedDB.getInstance.mockReturnValue(mockInstance);

    // Reset modules to get fresh imports
    vi.resetModules();
    const persistModule = await import('../persist.js');
    persist = persistModule.persist;
    rehydrate = persistModule.rehydrate;
    clearPersisted = persistModule.clearPersisted;

    // Mock store
    mockStore = {
      subscribe: vi.fn(callback => {
        mockStore._callback = callback;
        return vi.fn(); // unsubscribe
      }),
      getState: vi.fn(() => ({
        tracks: [],
        selection: null,
        zoom: 1
      })),
      setState: vi.fn()
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('persist', () => {
    it('subscribes to store changes', () => {
      persist(mockStore, { key: 'test-key' });

      expect(mockStore.subscribe).toHaveBeenCalled();
    });

    it('returns unsubscribe function', () => {
      const unsubscribe = persist(mockStore, { key: 'test-key' });

      expect(typeof unsubscribe).toBe('function');
    });

    it('debounces saves by default (300ms)', async () => {
      persist(mockStore, { key: 'test-key' });

      const state = { tracks: [], selection: null };
      mockStore._callback(state);

      expect(mockInstance.put).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      expect(mockInstance.put).toHaveBeenCalledWith('workspaces', {
        uuid: 'test-key',
        data: state
      });
    });

    it('respects custom debounce time', async () => {
      persist(mockStore, { key: 'test-key', debounce: 500 });

      const state = { tracks: [], selection: null };
      mockStore._callback(state);

      vi.advanceTimersByTime(300);
      expect(mockInstance.put).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();
      expect(mockInstance.put).toHaveBeenCalled();
    });

    it('saves all fields when fields option is not provided', async () => {
      persist(mockStore, { key: 'test-key' });

      const state = { tracks: ['track1'], selection: 'item1', zoom: 2 };
      mockStore._callback(state);

      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      expect(mockInstance.put).toHaveBeenCalledWith('workspaces', {
        uuid: 'test-key',
        data: state
      });
    });

    it('saves only specified fields when fields option is provided', async () => {
      persist(mockStore, { key: 'test-key', fields: ['tracks', 'zoom'] });

      const state = { tracks: ['track1'], selection: 'item1', zoom: 2 };
      mockStore._callback(state);

      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      expect(mockInstance.put).toHaveBeenCalledWith('workspaces', {
        uuid: 'test-key',
        data: { tracks: ['track1'], zoom: 2 }
      });
    });

    it('clears previous timeout on rapid changes', async () => {
      persist(mockStore, { key: 'test-key' });

      mockStore._callback({ value: 1 });
      vi.advanceTimersByTime(200);

      mockStore._callback({ value: 2 });
      vi.advanceTimersByTime(200);

      mockStore._callback({ value: 3 });
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      // Should only save once with the last value
      expect(mockInstance.put).toHaveBeenCalledTimes(1);
      expect(mockInstance.put).toHaveBeenCalledWith('workspaces', {
        uuid: 'test-key',
        data: { value: 3 }
      });
    });

    it('handles IndexedDB errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockInstance.put.mockRejectedValue(new Error('DB error'));

      persist(mockStore, { key: 'test-key' });

      mockStore._callback({ value: 1 });
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Persist] Failed to save test-key:'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('allows unsubscribe', () => {
      const unsubscribe = persist(mockStore, { key: 'test-key' });

      expect(typeof unsubscribe).toBe('function');
      expect(() => unsubscribe()).not.toThrow();
    });

    it('uses workspaces as store name', async () => {
      persist(mockStore, { key: 'test-key' });

      mockStore._callback({ value: 1 });
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      expect(mockInstance.put).toHaveBeenCalledWith('workspaces', expect.any(Object));
    });
  });

  describe('rehydrate', () => {
    it('restores state from IndexedDB', async () => {
      const savedData = { tracks: ['track1'], zoom: 2 };
      mockInstance.get.mockResolvedValue({ uuid: 'test-key', data: savedData });

      const result = await rehydrate(mockStore, 'test-key');

      expect(mockInstance.get).toHaveBeenCalledWith('workspaces', 'test-key');
      expect(mockStore.setState).toHaveBeenCalledWith(savedData);
      expect(result).toBe(true);
    });

    it('returns false when no data found', async () => {
      mockInstance.get.mockResolvedValue(null);

      const result = await rehydrate(mockStore, 'test-key');

      expect(mockStore.setState).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('returns false when record has no data', async () => {
      mockInstance.get.mockResolvedValue({ uuid: 'test-key' });

      const result = await rehydrate(mockStore, 'test-key');

      expect(mockStore.setState).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('handles IndexedDB errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockInstance.get.mockRejectedValue(new Error('DB error'));

      const result = await rehydrate(mockStore, 'test-key');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Persist] Failed to rehydrate test-key:'),
        expect.any(Error)
      );
      expect(mockStore.setState).not.toHaveBeenCalled();
      expect(result).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it('uses workspaces as store name', async () => {
      await rehydrate(mockStore, 'test-key');

      expect(mockInstance.get).toHaveBeenCalledWith('workspaces', 'test-key');
    });

    it('handles empty data object', async () => {
      mockInstance.get.mockResolvedValue({ uuid: 'test-key', data: {} });

      const result = await rehydrate(mockStore, 'test-key');

      expect(mockStore.setState).toHaveBeenCalledWith({});
      expect(result).toBe(true);
    });
  });

  describe('clearPersisted', () => {
    it('deletes record from IndexedDB', async () => {
      await clearPersisted('test-key');

      expect(mockInstance.delete).toHaveBeenCalledWith('workspaces', 'test-key');
    });

    it('handles IndexedDB errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockInstance.delete.mockRejectedValue(new Error('DB error'));

      await clearPersisted('test-key');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Persist] Failed to clear test-key:'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('uses workspaces as store name', async () => {
      await clearPersisted('test-key');

      expect(mockInstance.delete).toHaveBeenCalledWith('workspaces', 'test-key');
    });
  });

  describe('integration', () => {
    it('handles full persist → rehydrate cycle', async () => {
      const unsubscribe = persist(mockStore, { key: 'timeline', fields: ['tracks'] });

      const state = { tracks: ['track1', 'track2'], selection: 'item1' };
      mockStore._callback(state);

      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      expect(mockInstance.put).toHaveBeenCalledWith('workspaces', {
        uuid: 'timeline',
        data: { tracks: ['track1', 'track2'] }
      });

      // Simulate rehydration
      mockInstance.get.mockResolvedValue({
        uuid: 'timeline',
        data: { tracks: ['track1', 'track2'] }
      });

      const result = await rehydrate(mockStore, 'timeline');

      expect(result).toBe(true);
      expect(mockStore.setState).toHaveBeenCalledWith({ tracks: ['track1', 'track2'] });

      unsubscribe();
    });

    it('handles persist → clear → rehydrate cycle', async () => {
      persist(mockStore, { key: 'workspace' });

      mockStore._callback({ data: 'test' });
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      await clearPersisted('workspace');
      expect(mockInstance.delete).toHaveBeenCalledWith('workspaces', 'workspace');

      mockInstance.get.mockResolvedValue(null);
      const result = await rehydrate(mockStore, 'workspace');

      expect(result).toBe(false);
      expect(mockStore.setState).not.toHaveBeenCalled();
    });

    it('handles multiple stores persisting to different keys', async () => {
      const store1 = { ...mockStore, subscribe: vi.fn(() => vi.fn()) };
      const store2 = { ...mockStore, subscribe: vi.fn(() => vi.fn()) };

      persist(store1, { key: 'timeline' });
      persist(store2, { key: 'workspace' });

      expect(store1.subscribe).toHaveBeenCalled();
      expect(store2.subscribe).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles debounce of 0', async () => {
      persist(mockStore, { key: 'test-key', debounce: 0 });

      mockStore._callback({ value: 1 });
      await vi.runAllTimersAsync();

      expect(mockInstance.put).toHaveBeenCalled();
    });

    it('handles empty fields array', async () => {
      persist(mockStore, { key: 'test-key', fields: [] });

      mockStore._callback({ tracks: ['track1'], zoom: 2 });
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      expect(mockInstance.put).toHaveBeenCalledWith('workspaces', {
        uuid: 'test-key',
        data: {}
      });
    });

    it('handles non-existent fields', async () => {
      persist(mockStore, { key: 'test-key', fields: ['nonExistent'] });

      mockStore._callback({ tracks: ['track1'] });
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      expect(mockInstance.put).toHaveBeenCalledWith('workspaces', {
        uuid: 'test-key',
        data: { nonExistent: undefined }
      });
    });

    it('handles null state', async () => {
      persist(mockStore, { key: 'test-key' });

      mockStore._callback(null);
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      // Should attempt to save null
      expect(mockInstance.put).toHaveBeenCalled();
    });
  });
});
