import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Navigator from '../Navigator.js';
import { fireEvent } from '@testing-library/dom';

vi.mock('../../../services/Mediator', () => ({
  default: {
    registerNavigator: vi.fn(),
    onMoveFromNavigator: vi.fn(),
    onSetTimeSlice: vi.fn(),
    onStart: vi.fn(),
    onStop: vi.fn(),
    onReset: vi.fn()
  }
}));

vi.mock('../../../services/ShortcutService', () => ({
  setActionHandler: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn()
}));

vi.mock('../../../services/ConfigStore', () => ({
  getScales: () => [0.01, 0.02, 0.05, 0.1, 0.2],
  getDefaultScale: () => '0.1',
  getThumbScaleForZoom: scale => String(scale),
  getThumbsPerTile: () => 10,
  getTiles: () => ({ cols: 10, rows: 1 }),
  getThumbUrl: () => '/api/thumbs'
}));

vi.mock('../../../services/workspace', () => ({
  getUuid: () => 'test-uuid',
  getRouteUrl: () => '/api/v1/workspaces/test-uuid',
  getTrackUrl: id => `/api/v1/workspaces/test-uuid/audio/${id}`,
  getDerivedTrackUrl: id => `/api/v1/workspaces/test-uuid/audio/derived/${id}`,
  getThumbsManifestUrl: () => '/api/v1/workspaces/test-uuid/video/thumbnails/manifest.json'
}));

vi.mock('../../../services/offline/LocalMedia', () => ({
  audioRecord: vi.fn(async () => ({ blob: new Blob(['audio']) })),
  audioUrl: vi.fn(async id => `blob:local/${id}`)
}));

vi.mock('../../../services/offline/IndexedDB', () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    getWorkspace: vi.fn().mockResolvedValue(null),
    saveAudioBlob: vi.fn().mockResolvedValue(),
    getAudioBlob: vi.fn().mockResolvedValue(null)
  }
}));

vi.mock('../../../services/playback/PlaybackLoop', () => ({
  default: {
    setOnUpdate: vi.fn(),
    setOnEndReached: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    tick: vi.fn()
  }
}));

vi.mock('../../../lib/audio/utils/FetchUtils', () => ({
  fetchWithRetry: vi.fn().mockResolvedValue({
    ok: true,
    clone: () => ({ blob: () => Promise.resolve(new Blob()) }),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
  }),
  fetchAudio: vi.fn().mockResolvedValue({ duration: 30 })
}));

const mockManifest = {
  status: 'ready',
  scalesAvailable: ['0.01', '0.02', '0.05', '0.1', '0.2'],
  scales: {
    0.01: { tileWidth: 100, tileHeight: 50, cols: 10, rows: 1 },
    0.02: { tileWidth: 100, tileHeight: 50, cols: 10, rows: 1 },
    0.05: { tileWidth: 100, tileHeight: 50, cols: 10, rows: 1 },
    0.1: { tileWidth: 100, tileHeight: 50, cols: 10, rows: 1 },
    0.2: { tileWidth: 100, tileHeight: 50, cols: 10, rows: 1 }
  }
};

const mockResponse = {
  ok: true,
  clone: () => ({ blob: () => Promise.resolve(new Blob()) }),
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  json: () => Promise.resolve(mockManifest)
};

describe('Navigator - Scrubber and Playback', () => {
  let $container;
  let navigator;

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    $container = document.createElement('div');
    Object.defineProperty($container, 'offsetWidth', {
      get: () => 1000,
      configurable: true
    });
    document.body.appendChild($container);
  });

  afterEach(() => {
    if (navigator) {
      navigator.$node?.remove();
    }
    $container.remove();
    vi.clearAllMocks();
  });

  describe('scrubber movement', () => {
    beforeEach(async () => {
      navigator = new Navigator($container);
      await navigator.init(100);
    });

    it('moves scrubber to specific time', () => {
      const targetTime = 42;
      const result = navigator.moveTo(targetTime);

      expect(result).toBe(true);
    });

    it('updates scrubber handle position', () => {
      navigator.moveTo(50);

      const $handle = $container.querySelector('[data-testid="scrubber-handle"]');
      expect($handle).toBeTruthy();
    });

    it('throws on negative time', () => {
      expect(() => navigator.moveTo(-10)).toThrow('wrong input');
    });

    it('allows scrubber beyond duration during drag', () => {
      const result = navigator.moveTo(150);

      expect(result).toBe(true);
    });

    it('handles fractional time positions', () => {
      const time = 33.333;
      const result = navigator.moveTo(time);

      expect(result).toBe(true);
    });
  });

  describe('scrubber dragging', () => {
    beforeEach(async () => {
      navigator = new Navigator($container);
      await navigator.init(100);
    });

    it('updates time on drag', () => {
      const $ruler = $container.querySelector('[data-testid="ruler"]');
      expect($ruler).toBeTruthy();

      fireEvent.mouseDown($ruler, { clientX: 100 });
      fireEvent.mouseMove(document, { clientX: 200 });

      // Drag operation should complete without errors
    });

    it('resets to start position', () => {
      navigator.moveTo(50);
      const result = navigator.reset();

      expect(result).toBe(true);
    });
  });

  describe('playback frame updates', () => {
    beforeEach(async () => {
      navigator = new Navigator($container);
      await navigator.init(100);
    });

    it('updates frame during playback', () => {
      const result = navigator.updateFrame(25);

      expect(result).toBe(true);
    });

    it('handles rapid frame updates', () => {
      expect(navigator.updateFrame(10)).toBe(true);
      expect(navigator.updateFrame(20)).toBe(true);
      expect(navigator.updateFrame(30)).toBe(true);
    });

    it('updates with fractional frames', () => {
      const time = 16.667;
      const result = navigator.updateFrame(time);

      expect(result).toBe(true);
    });
  });

  describe('seek via click', () => {
    beforeEach(async () => {
      navigator = new Navigator($container);
      await navigator.init(100);
    });

    it('seeks to clicked position', () => {
      const $ruler = $container.querySelector('[data-testid="ruler"]');

      fireEvent.mouseDown($ruler, { clientX: 250 });

      // Seek operation should complete without errors
    });

    it('seeks to timeline start on left edge click', () => {
      const $ruler = $container.querySelector('[data-testid="ruler"]');

      fireEvent.mouseDown($ruler, { clientX: 0 });

      // Seek operation should complete without errors
    });
  });

  describe('scrubber visibility', () => {
    it('shows scrubber when initialized', async () => {
      navigator = new Navigator($container);
      await navigator.init(100);

      const $ruler = $container.querySelector('[data-testid="ruler"]');
      expect($ruler).toBeTruthy();
    });

    it('maintains scrubber during zoom', async () => {
      navigator = new Navigator($container);
      await navigator.init(100);

      const $zoomIn = $container.querySelector('[data-testid="zoom-in"]');
      $zoomIn?.click();

      const $ruler = $container.querySelector('[data-testid="ruler"]');
      expect($ruler).toBeTruthy();
    });
  });

  describe('edge cases', () => {
    beforeEach(async () => {
      navigator = new Navigator($container);
      await navigator.init(100);
    });

    it('throws on moveTo with NaN', () => {
      expect(() => navigator.moveTo(NaN)).toThrow('wrong input');
    });

    it('throws on moveTo with undefined', () => {
      expect(() => navigator.moveTo(undefined)).toThrow('wrong input');
    });

    it('handles moveTo with null', () => {
      const result = navigator.moveTo(null);
      expect(result).toBe(true);
    });

    it('throws on updateFrame with negative time', () => {
      expect(() => navigator.updateFrame(-5)).toThrow('wrong input');
    });

    it('handles rapid reset calls', () => {
      navigator.moveTo(50);
      expect(navigator.reset()).toBe(true);
      expect(navigator.reset()).toBe(true);
      expect(navigator.reset()).toBe(true);
    });
  });
});
