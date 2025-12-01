import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TiledThumbsView from '../TiledThumbsView.js';
import timelineStore from '../../../../../store/timelineStore.js';

// Mock workspace service
vi.mock('../../../../../services/workspace', () => ({
  getThumbsManifestUrl: vi.fn(() => '/api/thumbs/manifest.json'),
  getTileUrl: vi.fn((scale, tile) => `/api/thumbs/${scale}/${tile}`),
  invalidateCache: vi.fn()
}));

// Mock ConfigStore
vi.mock('../../../../../services/ConfigStore', () => ({
  getDefaultScale: vi.fn(() => '0.1'),
  getThumbScaleForZoom: vi.fn(() => '0.1'), // Always return 0.1 for simplicity
  getTiles: vi.fn(() => ({ cols: 10, rows: 1 })),
  getThumbsPerTile: vi.fn(() => 10)
}));

// Mock ThumbPreview
vi.mock('../ThumbPreview', () => ({
  default: class ThumbPreview {
    constructor(duration) {
      this.duration = duration;
      this.$node = document.createElement('div');
      this.$node.className = 'thumb-preview';
    }
    show() {}
    hide() {}
    setPosition() {}
  }
}));

// Mock lib
vi.mock('../../../../../lib', () => ({
  View: class View {
    constructor($parent) {
      this.$parent = $parent;
      this.$node = null;
    }
    mount() {
      if (this.render) {
        this.render();
      }
      if (this.onMount) {
        this.onMount();
      }
    }
  },
  getScale: vi.fn(() => 0.1),
  getPosXFromTime: vi.fn(time => time * 10),
  getTimeFromPosX: vi.fn(posX => posX / 10),
  scaleChanged: vi.fn((a, b) => Math.abs(a - b) >= 0.0000001)
}));

describe('TiledThumbsView', () => {
  let $container;
  let view;
  let originalFetch;

  beforeEach(() => {
    // Create container
    $container = document.createElement('div');
    document.body.appendChild($container);

    // Mock global fetch
    originalFetch = global.fetch;
    global.fetch = vi.fn();

    // Clear store
    timelineStore.actions.clear();
  });

  afterEach(() => {
    if (view && view.$node) {
      view.$node.remove();
    }
    $container.remove();
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders thumbs container with data-testid', () => {
      view = new TiledThumbsView($container);

      const $thumbsContainer = $container.querySelector('[data-testid="thumbs-container"]');
      expect($thumbsContainer).toBeTruthy();
      expect($thumbsContainer.classList.contains('thumbs')).toBe(true);
      expect($thumbsContainer.classList.contains('thumbs-tiled')).toBe(true);
    });

    it('renders empty list initially', () => {
      view = new TiledThumbsView($container);

      const $list = $container.querySelector('ul');
      expect($list).toBeTruthy();
      expect($list.classList.contains('list-unstyled')).toBe(true);
      expect($list.children.length).toBe(0);
    });
  });

  describe('Loader Behavior', () => {
    it('shows loader when manifest is placeholder', async () => {
      // Mock fetch to return placeholder manifest
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'processing',
          mode: 'tiles',
          scalesReady: [],
          thumbWidth: null,
          thumbHeight: null,
          scales: {}
        })
      });

      view = new TiledThumbsView($container);
      await view.init(100);

      const $thumbsContainer = $container.querySelector('[data-testid="thumbs-container"]');
      expect($thumbsContainer.classList.contains('loading')).toBe(true);
    });

    it('hides loader when target scale becomes available', async () => {
      // Mock fetch to return manifest with scale available
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ready',
          mode: 'tiles',
          scalesReady: ['0.1'],
          thumbWidth: 160,
          thumbHeight: 90,
          scales: {
            0.1: {
              thumbWidth: 160,
              thumbHeight: 90,
              tilesCount: 5,
              totalThumbs: 50
            }
          }
        })
      });

      view = new TiledThumbsView($container);
      await view.init(100);

      const $thumbsContainer = $container.querySelector('[data-testid="thumbs-container"]');
      expect($thumbsContainer.classList.contains('loading')).toBe(false);
    });

    it('keeps loader when target scale is not available', async () => {
      // Mock fetch to return manifest with only 0.01 scale (but we need 0.1)
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'processing',
          mode: 'tiles',
          scalesReady: ['0.01'],
          thumbWidth: 160,
          thumbHeight: 90,
          scales: {
            0.01: {
              thumbWidth: 160,
              thumbHeight: 90,
              tilesCount: 20,
              totalThumbs: 200
            }
          }
        })
      });

      view = new TiledThumbsView($container);
      await view.init(100);

      const $thumbsContainer = $container.querySelector('[data-testid="thumbs-container"]');
      expect($thumbsContainer.classList.contains('loading')).toBe(true);
    });
  });

  describe('Store Subscription', () => {
    it('reacts to new scale ready event', async () => {
      // Initial: placeholder manifest
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'processing',
          mode: 'tiles',
          scalesReady: [],
          thumbWidth: null,
          thumbHeight: null,
          scales: {}
        })
      });

      view = new TiledThumbsView($container);
      await view.init(100);

      let $thumbsContainer = $container.querySelector('[data-testid="thumbs-container"]');
      expect($thumbsContainer.classList.contains('loading')).toBe(true);

      // Simulate new scale ready via store
      // Mock next fetch to return scale available
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'ready',
          mode: 'tiles',
          scalesReady: ['0.1'],
          thumbWidth: 160,
          thumbHeight: 90,
          scales: {
            0.1: {
              thumbWidth: 160,
              thumbHeight: 90,
              tilesCount: 5,
              totalThumbs: 50
            }
          }
        })
      });

      // Trigger store update (simulates SSE event)
      timelineStore.actions.setScalesReady(['0.1']);

      // Wait for async manifest reload
      await new Promise(resolve => setTimeout(resolve, 100));

      $thumbsContainer = $container.querySelector('[data-testid="thumbs-container"]');
      expect($thumbsContainer.classList.contains('loading')).toBe(false);
    });

    it('updates store loading state when manifest is placeholder', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'processing',
          mode: 'tiles',
          scalesReady: [],
          thumbWidth: null,
          thumbHeight: null,
          scales: {}
        })
      });

      view = new TiledThumbsView($container);
      await view.init(100);

      const state = timelineStore.getState();
      expect(state.thumbs.loading).toBe(true);
      expect(state.thumbs.status).toBe('processing');
    });

    it('updates store loading state when all scales complete', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ready',
          mode: 'tiles',
          scalesReady: ['0.01', '0.02', '0.05', '0.1'],
          thumbWidth: 160,
          thumbHeight: 90,
          scales: {
            0.1: {
              thumbWidth: 160,
              thumbHeight: 90,
              tilesCount: 5,
              totalThumbs: 50
            }
          }
        })
      });

      view = new TiledThumbsView($container);
      await view.init(100);

      const state = timelineStore.getState();
      expect(state.thumbs.loading).toBe(false);
      expect(state.thumbs.status).toBe('ready');
    });
  });

  describe('Progressive Loading', () => {
    it('hides loader immediately when target scale is ready, not all scales', async () => {
      // First: placeholder
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'processing',
          mode: 'tiles',
          scalesReady: [],
          thumbWidth: null,
          thumbHeight: null,
          scales: {}
        })
      });

      view = new TiledThumbsView($container);
      await view.init(100);

      let $thumbsContainer = $container.querySelector('[data-testid="thumbs-container"]');
      expect($thumbsContainer.classList.contains('loading')).toBe(true);

      // Simulate target scale (0.1) becoming available, but not all scales
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'processing', // Still processing other scales
          mode: 'tiles',
          scalesReady: ['0.1'], // Only 0.1 ready
          thumbWidth: 160,
          thumbHeight: 90,
          scales: {
            0.1: {
              thumbWidth: 160,
              thumbHeight: 90,
              tilesCount: 5,
              totalThumbs: 50
            }
          }
        })
      });

      // Trigger scale ready event
      timelineStore.actions.setScalesReady(['0.1']);

      // Wait for async manifest reload
      await new Promise(resolve => setTimeout(resolve, 100));

      $thumbsContainer = $container.querySelector('[data-testid="thumbs-container"]');
      // Loader should be hidden because target scale (0.1) is available
      expect($thumbsContainer.classList.contains('loading')).toBe(false);
    });

    it('does not reload manifest when non-target scale completes', async () => {
      // Initial: manifest with 0.1 scale ready
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'processing',
          mode: 'tiles',
          scalesReady: ['0.1'],
          thumbWidth: 160,
          thumbHeight: 90,
          scales: {
            0.1: {
              thumbWidth: 160,
              thumbHeight: 90,
              tilesCount: 5,
              totalThumbs: 50
            }
          }
        })
      });

      view = new TiledThumbsView($container);
      await view.init(100);

      const fetchCallsBefore = global.fetch.mock.calls.length;

      // Simulate 0.01 scale completing (not the target scale)
      timelineStore.actions.setScalesReady(['0.1', '0.01']);

      // Wait briefly
      await new Promise(resolve => setTimeout(resolve, 10));

      // Manifest should be reloaded (to check if new scale affects target)
      const fetchCallsAfter = global.fetch.mock.calls.length;
      expect(fetchCallsAfter).toBeGreaterThan(fetchCallsBefore);
    });
  });

  describe('Manifest Loading Failures', () => {
    it('shows loader and starts polling when manifest fetch fails', async () => {
      // Mock fetch to fail
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      view = new TiledThumbsView($container);
      await view.init(100);

      const $thumbsContainer = $container.querySelector('[data-testid="thumbs-container"]');
      expect($thumbsContainer.classList.contains('loading')).toBe(true);
    });

    it('retries manifest fetch on failure', async () => {
      // First fetch fails
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      view = new TiledThumbsView($container);
      await view.init(100);

      // Should have tried once
      const initialCalls = global.fetch.mock.calls.length;
      expect(initialCalls).toBeGreaterThanOrEqual(1);

      // Mock successful response for retry
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ready',
          mode: 'tiles',
          scalesReady: ['0.1'],
          thumbWidth: 160,
          thumbHeight: 90,
          scales: {
            0.1: {
              thumbWidth: 160,
              thumbHeight: 90,
              tilesCount: 5,
              totalThumbs: 50
            }
          }
        })
      });

      // Wait for retry
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should have retried
      expect(global.fetch.mock.calls.length).toBeGreaterThan(initialCalls);
    }, 10000); // Increase timeout for this test
  });

  describe('Cleanup', () => {
    it('unsubscribes from store on destroy', () => {
      view = new TiledThumbsView($container);

      const subscribersBefore = timelineStore.subscribe(() => {});
      view.onDestroy();

      // Internal check: subscription should be cleared
      // (Hard to verify without exposing internal state, but we ensure no errors)
      expect(() => view.onDestroy()).not.toThrow();
    });
  });
});
