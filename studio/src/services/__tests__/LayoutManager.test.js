import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as EventService from '../EventService';
import LayoutManager from '../LayoutManager';

vi.mock('../EventService', () => {
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
    _getListeners: () => listeners,
    _clearListeners: () => listeners.clear()
  };
});

describe('LayoutManager', () => {
  let mockVideo;
  let mockPlayer;
  let mockNavigator;
  let $root, $header, $workspace, $library, $preview, $timeline, $body;

  beforeEach(() => {
    // Create DOM structure
    document.body.innerHTML = `
      <div class="studio">
        <div class="studio-header"></div>
        <div class="studio-workspace">
          <div class="studio-library"></div>
          <div class="studio-preview" style="padding-left: 10px; padding-right: 10px;"></div>
        </div>
        <div class="studio-timeline"></div>
      </div>
    `;

    $root = document.querySelector('.studio');
    $header = document.querySelector('.studio-header');
    $workspace = document.querySelector('.studio-workspace');
    $library = document.querySelector('.studio-library');
    $preview = document.querySelector('.studio-preview');
    $timeline = document.querySelector('.studio-timeline');
    $body = document.querySelector('body');

    // Set default dimensions
    Object.defineProperty($root, 'offsetHeight', { value: 1000, configurable: true });
    Object.defineProperty($header, 'offsetHeight', { value: 60, configurable: true });
    Object.defineProperty($workspace, 'offsetHeight', { value: 400, configurable: true });
    Object.defineProperty($body, 'offsetWidth', { value: 1920, configurable: true });

    // Mock components
    mockVideo = {
      $node: { offsetWidth: 800 },
      resize: vi.fn()
    };

    mockPlayer = {
      resize: vi.fn()
    };

    mockNavigator = {
      resize: vi.fn()
    };

    vi.clearAllMocks();
    EventService._clearListeners();
    LayoutManager.reset();
  });

  const emitVideoResized = (width = 800, height = 400) => {
    EventService.emitLocal('video:resized', { width, height });
  };

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('initialization', () => {
    it('creates singleton instance', () => {
      expect(LayoutManager).toBeTruthy();
    });

    it('init() sets up window resize listener', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      LayoutManager.init();

      expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      addEventListenerSpy.mockRestore();
    });
  });

  describe('registration', () => {
    it('registers video component', () => {
      LayoutManager.registerVideo(mockVideo);
      expect(() => LayoutManager.resize()).not.toThrow();
    });

    it('registers player component', () => {
      LayoutManager.init();
      LayoutManager.registerVideo(mockVideo);
      LayoutManager.registerPlayer(mockPlayer);
      emitVideoResized();

      expect(mockPlayer.resize).toHaveBeenCalled();
    });

    it('registers navigator component', () => {
      LayoutManager.init();
      LayoutManager.registerVideo(mockVideo);
      LayoutManager.registerNavigator(mockNavigator);
      emitVideoResized();

      expect(mockNavigator.resize).toHaveBeenCalled();
    });
  });

  describe('resize', () => {
    it('does nothing when video dimensions not set', () => {
      LayoutManager.resize();

      expect($library.style.width).toBe('');
      expect($preview.style.width).toBe('');
      expect($timeline.style.height).toBe('');
    });

    it('does nothing when video width is zero', () => {
      LayoutManager.init();
      emitVideoResized(0, 400);

      expect($library.style.width).toBe('');
      expect($preview.style.width).toBe('');
      expect($timeline.style.height).toBe('');
    });

    it('clears preview width to use CSS defaults', () => {
      $preview.style.width = '500px';
      LayoutManager.init();
      emitVideoResized();

      expect($preview.style.width).toBe('');
    });

    it('sets library height to match preview height', () => {
      Object.defineProperty($preview, 'offsetHeight', { value: 350, configurable: true });
      LayoutManager.init();
      emitVideoResized();

      expect($library.style.height).toBe('350px');
    });

    it('calculates timeline height based on layout', () => {
      LayoutManager.init();
      emitVideoResized();

      // Total height (1000) - header (60) - workspace (400) = 540
      expect($timeline.style.height).toBe('540px');
    });

    it('calls player.resize() when player is registered', () => {
      LayoutManager.init();
      LayoutManager.registerPlayer(mockPlayer);
      emitVideoResized();

      expect(mockPlayer.resize).toHaveBeenCalled();
    });

    it('calls navigator.resize() when navigator is registered', () => {
      LayoutManager.init();
      LayoutManager.registerNavigator(mockNavigator);
      emitVideoResized();

      expect(mockNavigator.resize).toHaveBeenCalled();
    });

    it('does not call player.resize() when player is not registered', () => {
      LayoutManager.init();
      emitVideoResized();

      // Should not throw
    });

    it('does not call navigator.resize() when navigator is not registered', () => {
      LayoutManager.init();
      emitVideoResized();

      // Should not throw
    });
  });

  describe('resizeFromVideo', () => {
    it('does nothing when video is not registered', () => {
      LayoutManager.resizeFromVideo(500);

      expect($preview.style.width).toBe('');
    });

    it('calls video.resize() with provided height', () => {
      LayoutManager.registerVideo(mockVideo);
      LayoutManager.resizeFromVideo(500);

      expect(mockVideo.resize).toHaveBeenCalledWith(500);
    });

    it('triggers layout resize after video resize', () => {
      Object.defineProperty($preview, 'offsetHeight', { value: 350, configurable: true });
      LayoutManager.init();
      LayoutManager.registerVideo(mockVideo);
      emitVideoResized();
      LayoutManager.resizeFromVideo(500);

      expect($library.style.height).toBe('350px');
    });
  });

  describe('onWindowResize', () => {
    it('triggers video resize via event bus', () => {
      LayoutManager.init();
      LayoutManager.registerVideo(mockVideo);
      emitVideoResized();

      LayoutManager.onWindowResize();

      expect(mockVideo.resize).toHaveBeenCalledWith(400);
    });

    it('triggers layout resize after video resize', () => {
      Object.defineProperty($preview, 'offsetHeight', { value: 350, configurable: true });
      LayoutManager.init();
      LayoutManager.registerVideo(mockVideo);
      emitVideoResized();

      LayoutManager.onWindowResize();

      expect($library.style.height).toBe('350px');
    });
  });

  describe('reset', () => {
    it('clears library width', () => {
      LayoutManager.init();
      emitVideoResized();
      $library.style.width = '1100px';
      LayoutManager.reset();

      expect($library.style.width).toBe('');
    });

    it('clears preview width', () => {
      LayoutManager.init();
      emitVideoResized();
      $preview.style.width = '820px';
      LayoutManager.reset();

      expect($preview.style.width).toBe('');
    });

    it('clears timeline height', () => {
      LayoutManager.init();
      emitVideoResized();
      $timeline.style.height = '540px';
      LayoutManager.reset();

      expect($timeline.style.height).toBe('');
    });

    it('resets all inline styles to CSS defaults', () => {
      LayoutManager.init();
      emitVideoResized();

      LayoutManager.reset();

      expect($library.style.width).toBe('');
      expect($preview.style.width).toBe('');
      expect($timeline.style.height).toBe('');
    });
  });

  describe('integration', () => {
    it('handles full registration and resize flow', () => {
      Object.defineProperty($preview, 'offsetHeight', { value: 350, configurable: true });
      LayoutManager.init();
      LayoutManager.registerPlayer(mockPlayer);
      LayoutManager.registerNavigator(mockNavigator);
      emitVideoResized();

      expect($library.style.height).toBe('350px');
      expect($timeline.style.height).toBe('540px');
      expect(mockPlayer.resize).toHaveBeenCalled();
      expect(mockNavigator.resize).toHaveBeenCalled();
    });

    it('handles resize → reset → resize cycle', () => {
      Object.defineProperty($preview, 'offsetHeight', { value: 350, configurable: true });
      LayoutManager.init();
      emitVideoResized();

      expect($library.style.height).toBe('350px');

      LayoutManager.reset();
      expect($library.style.height).toBe('');

      emitVideoResized();
      expect($library.style.height).toBe('350px');
    });

    it('handles window resize event', () => {
      LayoutManager.init();
      LayoutManager.registerVideo(mockVideo);
      emitVideoResized();

      const event = new Event('resize');
      window.dispatchEvent(event);

      expect(mockVideo.resize).toHaveBeenCalledWith(400);
    });
  });

  describe('edge cases', () => {
    it('handles video with no padding', () => {
      $preview.style.paddingLeft = '0px';
      $preview.style.paddingRight = '0px';
      Object.defineProperty($preview, 'offsetHeight', { value: 350, configurable: true });

      LayoutManager.init();
      emitVideoResized();

      expect($library.style.height).toBe('350px');
    });

    it('handles multiple registrations', () => {
      Object.defineProperty($preview, 'offsetHeight', { value: 350, configurable: true });
      LayoutManager.init();
      LayoutManager.registerVideo(mockVideo);
      LayoutManager.registerVideo(mockVideo);
      emitVideoResized();

      expect($library.style.height).toBe('350px');
    });

    it('handles multiple resize calls', () => {
      Object.defineProperty($preview, 'offsetHeight', { value: 350, configurable: true });
      LayoutManager.init();
      emitVideoResized();
      emitVideoResized();
      emitVideoResized();

      expect($library.style.height).toBe('350px');
    });

    it('handles reset without prior resize', () => {
      expect(() => LayoutManager.reset()).not.toThrow();
    });

    it('handles changing video dimensions and updates timeline', () => {
      LayoutManager.init();
      emitVideoResized();
      expect($timeline.style.height).toBe('540px');

      // Change root height
      Object.defineProperty($root, 'offsetHeight', { value: 1200, configurable: true });
      emitVideoResized();
      expect($timeline.style.height).toBe('740px');
    });
  });

  describe('event bus', () => {
    it('init() caches DOM nodes', () => {
      LayoutManager.init();

      expect(() => LayoutManager.resize()).not.toThrow();
    });

    it('init() subscribes to layout:resize event', () => {
      LayoutManager.init();

      expect(EventService.on).toHaveBeenCalledWith('layout:resize', expect.any(Function));
    });

    it('layout:resize event triggers resizeFromVideo', () => {
      LayoutManager.init();
      LayoutManager.registerVideo(mockVideo);

      EventService.emitLocal('layout:resize', { height: 500 });

      expect(mockVideo.resize).toHaveBeenCalledWith(500);
    });

    it('layout:resize event without height uses workspace fallback', () => {
      LayoutManager.init();
      LayoutManager.registerVideo(mockVideo);

      EventService.emitLocal('layout:resize', {});

      expect(mockVideo.resize).toHaveBeenCalledWith(400);
    });
  });

  describe('resizeFromVideo fallback', () => {
    it('uses provided height when valid number', () => {
      LayoutManager.registerVideo(mockVideo);
      LayoutManager.resizeFromVideo(500);

      expect(mockVideo.resize).toHaveBeenCalledWith(500);
    });

    it('uses workspace height fallback when height is 0', () => {
      LayoutManager.init();
      LayoutManager.registerVideo(mockVideo);
      LayoutManager.resizeFromVideo(0);

      expect(mockVideo.resize).toHaveBeenCalledWith(400);
    });

    it('uses workspace height fallback when height is undefined', () => {
      LayoutManager.init();
      LayoutManager.registerVideo(mockVideo);
      LayoutManager.resizeFromVideo(undefined);

      expect(mockVideo.resize).toHaveBeenCalledWith(400);
    });

    it('uses workspace height fallback when height is negative', () => {
      LayoutManager.init();
      LayoutManager.registerVideo(mockVideo);
      LayoutManager.resizeFromVideo(-100);

      expect(mockVideo.resize).toHaveBeenCalledWith(400);
    });
  });

  describe('resize timeline min height', () => {
    it('applies minimum height of 320 when calculated height is smaller and the video cannot shrink', () => {
      Object.defineProperty($root, 'offsetHeight', { value: 500, configurable: true });
      Object.defineProperty($header, 'offsetHeight', { value: 60, configurable: true });
      Object.defineProperty($workspace, 'offsetHeight', { value: 400, configurable: true });

      LayoutManager.init();
      emitVideoResized();

      expect($timeline.style.height).toBe('320px');
    });

    it('reads the minimum from the --timeline-min-height token', () => {
      Object.defineProperty($root, 'offsetHeight', { value: 500, configurable: true });
      $root.style.setProperty('--timeline-min-height', '250px');

      LayoutManager.init();
      emitVideoResized();

      expect($timeline.style.height).toBe('250px');
    });

    it('shrinks the video instead of squeezing the timeline', () => {
      // 720p laptop: 720 - 60 (header) - 500 (workspace) = 160px left for the timeline
      Object.defineProperty($root, 'offsetHeight', { value: 720, configurable: true });
      Object.defineProperty($workspace, 'offsetHeight', {
        value: 500,
        configurable: true,
        writable: true
      });

      mockVideo.resize = vi.fn(height => {
        // The real VideoView shrinks, the workspace follows, then VIDEO_RESIZED fires.
        Object.defineProperty($workspace, 'offsetHeight', {
          value: 500 - (400 - height),
          configurable: true
        });
        emitVideoResized((height * 16) / 9, height);
      });

      $root.classList.add('has-video');
      LayoutManager.init();
      LayoutManager.registerVideo(mockVideo);
      emitVideoResized(711, 400);

      // deficit = 320 - 160 = 160 → video 400 → 240
      expect(mockVideo.resize).toHaveBeenCalledTimes(1);
      expect(mockVideo.resize).toHaveBeenCalledWith(240);
      expect($timeline.style.height).toBe('320px');
    });

    it('does not shrink the video before it is mounted (placeholder layout)', () => {
      Object.defineProperty($root, 'offsetHeight', { value: 720, configurable: true });
      Object.defineProperty($workspace, 'offsetHeight', { value: 500, configurable: true });

      LayoutManager.init();
      LayoutManager.registerVideo(mockVideo);
      emitVideoResized(711, 400);

      expect(mockVideo.resize).not.toHaveBeenCalled();
    });

    it('never shrinks the video below the VideoView minimum', () => {
      Object.defineProperty($root, 'offsetHeight', { value: 720, configurable: true });
      Object.defineProperty($workspace, 'offsetHeight', { value: 700, configurable: true });
      const minVideoHeight = Math.ceil(window.innerHeight * 0.25);

      $root.classList.add('has-video');
      LayoutManager.init();
      LayoutManager.registerVideo(mockVideo);
      emitVideoResized(711, 400);

      expect(mockVideo.resize).toHaveBeenCalledWith(minVideoHeight);
    });

    it('restores the preferred video height on window resize after a shrink', () => {
      Object.defineProperty($root, 'offsetHeight', { value: 720, configurable: true });
      Object.defineProperty($workspace, 'offsetHeight', { value: 500, configurable: true });

      mockVideo.resize = vi.fn(height => {
        Object.defineProperty($workspace, 'offsetHeight', {
          value: 500 - (400 - height),
          configurable: true
        });
        emitVideoResized((height * 16) / 9, height);
      });

      $root.classList.add('has-video');
      LayoutManager.init();
      LayoutManager.registerVideo(mockVideo);
      emitVideoResized(711, 400);
      expect(mockVideo.resize).toHaveBeenLastCalledWith(240);

      // Window grows back: the video asks again for its preferred 400px, not the shrunk 240px
      Object.defineProperty($root, 'offsetHeight', { value: 1000, configurable: true });
      LayoutManager.onWindowResize();

      expect(mockVideo.resize).toHaveBeenLastCalledWith(400);
    });

    it('uses calculated height when greater than minimum', () => {
      Object.defineProperty($root, 'offsetHeight', { value: 1000, configurable: true });
      Object.defineProperty($header, 'offsetHeight', { value: 60, configurable: true });
      Object.defineProperty($workspace, 'offsetHeight', { value: 400, configurable: true });

      LayoutManager.init();
      emitVideoResized();

      expect($timeline.style.height).toBe('540px');
    });
  });

  describe('resize library height', () => {
    it('aligns library height to preview height', () => {
      Object.defineProperty($preview, 'offsetHeight', { value: 350, configurable: true });

      LayoutManager.init();
      emitVideoResized();

      expect($library.style.height).toBe('350px');
    });

    it('does not set library height when preview has no height', () => {
      Object.defineProperty($preview, 'offsetHeight', { value: 0, configurable: true });

      LayoutManager.init();
      emitVideoResized();

      expect($library.style.height).toBe('');
    });
  });
});
