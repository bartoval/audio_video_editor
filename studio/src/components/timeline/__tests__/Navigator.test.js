import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Navigator from '../Navigator.js';
import * as EventService from '../../../services/EventService';

// Mock Mediator to avoid errors
vi.mock('../../Mediator', () => ({
  default: {
    registerNavigator: vi.fn(),
    onMoveFromNavigator: vi.fn(),
    onSetTimeSlice: vi.fn(),
    onStart: vi.fn(),
    onStop: vi.fn(),
    onReset: vi.fn()
  }
}));

// Mock ShortcutService
vi.mock('../../../services/ShortcutService', () => ({
  setActionHandler: vi.fn(),
  clearActionHandler: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn()
}));

// Mock ConfigStore to provide scales
vi.mock('../../../services/ConfigStore', () => ({
  getScales: () => [0.01, 0.02, 0.05, 0.1, 0.2],
  getDefaultScale: () => '0.1',
  getThumbScaleForZoom: () => '0.1',
  getThumbsPerTile: () => 10,
  getTiles: () => ({ cols: 10, rows: 1 }),
  getThumbUrl: () => '/api/thumbs'
}));

// Mock workspace
vi.mock('../../../services/workspace', () => ({
  getUuid: () => 'test-uuid',
  getRouteUrl: () => '/api/v1/workspaces/test-uuid',
  getTrackUrl: id => `/api/v1/workspaces/test-uuid/audio/${id}`,
  getLibraryTrackUrl: id => `/api/v1/workspaces/test-uuid/audio/${id}`,
  getDerivedTrackUrl: id => `/api/v1/workspaces/test-uuid/audio/derived/${id}`,
  getThumbsManifestUrl: () => '/api/v1/workspaces/test-uuid/video/thumbnails/manifest.json'
}));

// Mock IndexedDB
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

// Mock PlaybackLoop
vi.mock('../../../services/playback/PlaybackLoop', () => ({
  default: {
    setOnUpdate: vi.fn(),
    setOnEndReached: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    tick: vi.fn()
  }
}));

// Mock FetchUtils
vi.mock('../../../lib/audio/utils/FetchUtils', () => ({
  fetchWithRetry: vi.fn().mockResolvedValue({
    ok: true,
    clone: () => ({ blob: () => Promise.resolve(new Blob()) }),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
  }),
  fetchAudio: vi.fn().mockResolvedValue({ duration: 30 })
}));

// Mock EventService
vi.mock('../../../services/EventService', () => {
  const listeners = new Map();
  return {
    on: vi.fn((event, callback) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event).add(callback);
      return vi.fn(() => listeners.get(event)?.delete(callback));
    }),
    off: vi.fn((event, callback) => {
      listeners.get(event)?.delete(callback);
    }),
    emitLocal: vi.fn((event, data) => {
      const callbacks = listeners.get(event);
      if (callbacks) {
        callbacks.forEach(cb => cb(data));
      }
    }),
    isOnline: vi.fn(() => true),
    _getListeners: () => listeners,
    _clearListeners: () => listeners.clear()
  };
});

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

describe('Navigator', () => {
  let $container;
  let navigator;

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    // Create container
    $container = document.createElement('div');
    document.body.appendChild($container);

    vi.clearAllMocks();
    EventService._clearListeners();
  });

  afterEach(() => {
    if (navigator) {
      navigator.$node?.remove();
    }
    $container.remove();
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders navigator with data-testid', () => {
      navigator = new Navigator($container);

      const $navigator = $container.querySelector('[data-testid="navigator-root"]');
      expect($navigator).toBeTruthy();
      expect($navigator.classList.contains('navigator')).toBe(true);
    });

    it('renders all child components', () => {
      navigator = new Navigator($container);

      // Check for minimap
      expect($container.querySelector('[data-testid="minimap"]')).toBeTruthy();

      // Check for ruler
      expect($container.querySelector('[data-testid="ruler"]')).toBeTruthy();

      // Check for tracks container
      expect($container.querySelector('[data-testid="tracks-container"]')).toBeTruthy();
    });

    it('creates timeline wrapper', () => {
      navigator = new Navigator($container);

      const $timeline = $container.querySelector('.timeline');
      expect($timeline).toBeTruthy();
    });
  });

  describe('Initialization', () => {
    it('initializes with duration', async () => {
      navigator = new Navigator($container);

      const result = await navigator.init(100);

      expect(result).toBe(true);
    });

    it('throws error for invalid duration', async () => {
      navigator = new Navigator($container);

      await expect(navigator.init(0)).rejects.toThrow('wrong duration');
      await expect(navigator.init(-10)).rejects.toThrow('wrong duration');
      await expect(navigator.init(NaN)).rejects.toThrow('wrong duration');
    });

    it('initializes with config', async () => {
      navigator = new Navigator($container);

      const config = {
        tracks: [],
        markers: []
      };

      const result = await navigator.init(100, config);
      expect(result).toBe(true);
    });
  });

  describe('Navigation', () => {
    beforeEach(async () => {
      navigator = new Navigator($container);
      await navigator.init(100);
    });

    it('moves to specific time', () => {
      const result = navigator.moveTo(50);

      expect(result).toBe(true);
    });

    it('resets to start', () => {
      navigator.moveTo(50);
      const result = navigator.reset();

      expect(result).toBe(true);
    });

    it('updates frame during playback', () => {
      const result = navigator.updateFrame(25);

      expect(result).toBe(true);
    });
  });

  describe('Minimap', () => {
    beforeEach(async () => {
      navigator = new Navigator($container);
      await navigator.init(100);
    });

    it('renders minimap', () => {
      const $minimap = $container.querySelector('[data-testid="minimap"]');
      expect($minimap).toBeTruthy();
    });

    it('minimap shows viewport indicator', () => {
      const $viewport = $container.querySelector('.minimap-viewport');
      expect($viewport).toBeTruthy();
    });

    it('minimap shows playhead', () => {
      const $playhead = $container.querySelector('.minimap-playhead');
      expect($playhead).toBeTruthy();
    });
  });

  describe('Data Export', () => {
    beforeEach(async () => {
      navigator = new Navigator($container);
      await navigator.init(100);
    });

    it('exports timeline data', () => {
      const data = navigator.getData();

      expect(data).toHaveProperty('tracks');
      expect(data).toHaveProperty('markers');
      expect(Array.isArray(data.tracks)).toBe(true);
      expect(Array.isArray(data.markers)).toBe(true);
    });
  });

  describe('Window Resize', () => {
    beforeEach(async () => {
      navigator = new Navigator($container);
      await navigator.init(100);
    });

    it('handles resize', () => {
      expect(() => navigator.resize()).not.toThrow();
    });
  });

  describe('Track Management', () => {
    beforeEach(async () => {
      navigator = new Navigator($container);
      await navigator.init(100);
    });

    it('adds tracks to timeline', () => {
      const audioTracks = [
        { id: 'track-1', label: 'Track 1', duration: 30 },
        { id: 'track-2', label: 'Track 2', duration: 45 }
      ];

      navigator.addTracksToTimeline(audioTracks);

      // Tracks should be added (internal state, hard to verify without more exposed API)
      expect(navigator.tracks.getCount()).toBeGreaterThan(0);
    });

    it('handles empty tracks array', () => {
      expect(() => navigator.addTracksToTimeline([])).not.toThrow();
    });

    it('handles null tracks', () => {
      expect(() => navigator.addTracksToTimeline(null)).not.toThrow();
    });

    it('clears all tracks', () => {
      const audioTracks = [{ id: 'track-1', label: 'Track 1', duration: 30 }];
      navigator.addTracksToTimeline(audioTracks);

      const result = navigator.clear();

      expect(result).toBe(true);
    });
  });

  describe('Thumbnails', () => {
    beforeEach(async () => {
      navigator = new Navigator($container);
      await navigator.init(100);
    });

    it('reloads thumbnails', () => {
      expect(() => navigator.reloadThumbs()).not.toThrow();
    });

    it('sets thumbnails loading state', () => {
      expect(() => navigator.setThumbsLoading(true)).not.toThrow();
      expect(() => navigator.setThumbsLoading(false)).not.toThrow();
    });

    it('handles thumbnail progress updates', () => {
      const progressData = { percent: 50, scale: '0.1' };
      expect(() => navigator.onThumbnailProgress(progressData)).not.toThrow();
    });
  });

  describe('Event Bus Subscription', () => {
    it('subscribes to timeline:addTracks on mount', () => {
      navigator = new Navigator($container);

      expect(EventService.on).toHaveBeenCalledWith('timeline:addTracks', expect.any(Function));
    });

    it('timeline:addTracks event calls addTracksToTimeline', async () => {
      navigator = new Navigator($container);
      await navigator.init(100);

      const addTracksSpy = vi.spyOn(navigator, 'addTracksToTimeline');
      const tracks = [{ id: 'track-1', label: 'Track 1', duration: 30 }];

      EventService.emitLocal('timeline:addTracks', tracks);

      expect(addTracksSpy).toHaveBeenCalledWith(tracks);
    });

    it('onDestroy calls unsubscribe for timeline:addTracks', async () => {
      navigator = new Navigator($container);
      await navigator.init(100);

      const listenersBefore = EventService._getListeners().get('timeline:addTracks')?.size || 0;

      navigator.onDestroy();

      const listenersAfter = EventService._getListeners().get('timeline:addTracks')?.size || 0;
      expect(listenersAfter).toBeLessThan(listenersBefore);
    });
  });

  describe('Snapshots', () => {
    const cleanDomForSnapshot = $element => {
      const clone = $element.cloneNode(true);

      clone.querySelectorAll('[style]').forEach($el => {
        $el.removeAttribute('style');
      });

      clone.querySelectorAll('canvas').forEach($canvas => {
        $canvas.removeAttribute('width');
        $canvas.removeAttribute('height');
      });

      return clone.innerHTML;
    };

    it('matches DOM structure after render', () => {
      navigator = new Navigator($container);

      const $navigator = $container.querySelector('[data-testid="navigator-root"]');
      expect(cleanDomForSnapshot($navigator)).toMatchSnapshot('navigator-initial-render');
    });

    it('matches DOM structure after initialization', async () => {
      navigator = new Navigator($container);
      await navigator.init(100);

      const $navigator = $container.querySelector('[data-testid="navigator-root"]');
      expect(cleanDomForSnapshot($navigator)).toMatchSnapshot('navigator-after-init');
    });

    it('matches public API shape', () => {
      navigator = new Navigator($container);

      const publicMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(navigator))
        .filter(name => !name.startsWith('_') && name !== 'constructor')
        .sort();

      expect(publicMethods).toMatchSnapshot('navigator-public-api');
    });
  });
});
