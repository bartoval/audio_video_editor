import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('ConfigStore', () => {
  let ConfigStore;
  let originalFetch;

  beforeEach(async () => {
    originalFetch = global.fetch;
    vi.clearAllMocks();
    localStorage.clear();

    // Reset module to get fresh state
    vi.resetModules();
    ConfigStore = await import('../ConfigStore');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('load', () => {
    it('starts with usable defaults without contacting the backend', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('No server'));
      const config = await ConfigStore.load();
      expect(config.defaultScale).toBe('0.1');
      expect(config.scales.length).toBeGreaterThan(0);
      expect(await ConfigStore.load()).toBe(config);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('restores a saved configuration without making requests', async () => {
      const thumbs = { scales: [{ scale: '0.2' }], defaultScale: '0.2' };
      localStorage.setItem('studio-thumbnails-config-v1', JSON.stringify(thumbs));
      global.fetch = vi.fn();
      expect(await ConfigStore.load()).toEqual(thumbs);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('uses defaults when the saved configuration is malformed', async () => {
      localStorage.setItem('studio-thumbnails-config-v1', '{invalid');
      expect((await ConfigStore.load()).defaultScale).toBe('0.1');
    });
  });

  describe('setConfig', () => {
    it('sets configuration manually', () => {
      const mockConfig = {
        scales: [{ scale: '0.1' }],
        defaultScale: '0.1'
      };

      ConfigStore.setConfig(mockConfig);

      expect(ConfigStore.isReady()).toBe(true);
      expect(ConfigStore.getScales()).toEqual([0.1]);
    });

    it('notifies listeners on manual config', () => {
      const listener = vi.fn();
      ConfigStore.onReady(listener);

      const mockConfig = {
        scales: [{ scale: '0.1' }]
      };

      ConfigStore.setConfig(mockConfig);

      expect(listener).toHaveBeenCalledWith(mockConfig);
    });
  });

  describe('isReady', () => {
    it('returns false before config loaded', () => {
      expect(ConfigStore.isReady()).toBe(false);
    });

    it('returns true after config set', () => {
      ConfigStore.setConfig({ scales: [] });
      expect(ConfigStore.isReady()).toBe(true);
    });
  });

  describe('onReady', () => {
    it('calls callback immediately if already ready', () => {
      const mockConfig = { scales: [] };
      ConfigStore.setConfig(mockConfig);

      const callback = vi.fn();
      ConfigStore.onReady(callback);

      expect(callback).toHaveBeenCalledWith(mockConfig);
    });

    it('calls callback when config becomes ready', () => {
      const callback = vi.fn();
      ConfigStore.onReady(callback);

      const mockConfig = { scales: [] };
      ConfigStore.setConfig(mockConfig);

      expect(callback).toHaveBeenCalledWith(mockConfig);
    });

    it('returns unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = ConfigStore.onReady(callback);

      const mockConfig1 = { scales: [{ scale: '0.1' }] };
      ConfigStore.setConfig(mockConfig1);

      unsubscribe();

      const mockConfig2 = { scales: [{ scale: '0.2' }] };
      ConfigStore.setConfig(mockConfig2);

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('getScales', () => {
    it('returns null if config not ready', () => {
      expect(ConfigStore.getScales()).toBe(null);
    });

    it('returns scales as numbers', () => {
      ConfigStore.setConfig({
        scales: [{ scale: '0.1' }, { scale: '0.2' }, { scale: '0.5' }]
      });

      expect(ConfigStore.getScales()).toEqual([0.1, 0.2, 0.5]);
    });

    it('handles empty scales array', () => {
      ConfigStore.setConfig({ scales: [] });
      expect(ConfigStore.getScales()).toEqual([]);
    });
  });

  describe('getDefaultScale', () => {
    it('returns undefined if config not ready', () => {
      expect(ConfigStore.getDefaultScale()).toBeUndefined();
    });

    it('returns default scale', () => {
      ConfigStore.setConfig({ defaultScale: '0.1' });
      expect(ConfigStore.getDefaultScale()).toBe('0.1');
    });
  });

  describe('getThumbScaleForZoom', () => {
    it('converts zoom scale to string', () => {
      expect(ConfigStore.getThumbScaleForZoom(0.1)).toBe('0.1');
      expect(ConfigStore.getThumbScaleForZoom(0.5)).toBe('0.5');
    });
  });

  describe('getTiles', () => {
    it('returns null if config not ready', () => {
      expect(ConfigStore.getTiles()).toBe(null);
    });

    it('returns tile configuration', () => {
      const tiles = { cols: 10, rows: 2 };
      ConfigStore.setConfig({ tiles });

      expect(ConfigStore.getTiles()).toEqual(tiles);
    });
  });

  describe('getThumbsPerTile', () => {
    it('returns null if config not ready', () => {
      expect(ConfigStore.getThumbsPerTile()).toBe(null);
    });

    it('calculates thumbs per tile', () => {
      ConfigStore.setConfig({ tiles: { cols: 10, rows: 2 } });
      expect(ConfigStore.getThumbsPerTile()).toBe(20);
    });

    it('handles different grid sizes', () => {
      ConfigStore.setConfig({ tiles: { cols: 5, rows: 4 } });
      expect(ConfigStore.getThumbsPerTile()).toBe(20);
    });
  });

  describe('getThumbExtension', () => {
    it('returns null if config not ready', () => {
      expect(ConfigStore.getThumbExtension()).toBe(null);
    });

    it('returns extension', () => {
      ConfigStore.setConfig({ extension: 'webp' });
      expect(ConfigStore.getThumbExtension()).toBe('webp');
    });
  });
});
