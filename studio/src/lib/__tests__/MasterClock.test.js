import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MasterClock from '../MasterClock.js';

// Helper to flush RAF
const flushRAF = () => new Promise(resolve => requestAnimationFrame(resolve));

describe('MasterClock', () => {
  let mockVideoElement;
  let mockAudioContext;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Reset MasterClock state before each test
    MasterClock.dispose();

    // Mock video element
    mockVideoElement = {
      currentTime: 0,
      paused: false,
      readyState: 4, // HAVE_ENOUGH_DATA
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    // Mock AudioContext
    mockAudioContext = {
      currentTime: 0,
      state: 'running',
      resume: vi.fn(),
      suspend: vi.fn()
    };

    // Spy on console methods
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.clearAllMocks();
  });

  afterEach(() => {
    MasterClock.dispose();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('initialization', () => {
    it('initializes with valid duration', () => {
      MasterClock.init(120);

      expect(MasterClock.getDuration()).toBe(120);
      expect(MasterClock.getTime()).toBe(0);
      expect(MasterClock.isPlaying()).toBe(false);
    });

    it('throws error for invalid duration', () => {
      expect(() => MasterClock.init(NaN)).toThrow('[MasterClock] Invalid duration');
      expect(() => MasterClock.init(-1)).toThrow('[MasterClock] Invalid duration');
    });

    it('resets state on re-initialization', () => {
      MasterClock.init(100);
      MasterClock.seekTo(50);
      MasterClock.play();

      MasterClock.init(200);

      expect(MasterClock.getDuration()).toBe(200);
      expect(MasterClock.getTime()).toBe(0);
      expect(MasterClock.isPlaying()).toBe(false);
    });
  });

  describe('registration', () => {
    beforeEach(() => {
      MasterClock.init(100);
    });

    it('registers video element', () => {
      MasterClock.registerVideo(mockVideoElement);

      // Should sync on seekTo
      MasterClock.seekTo(10);
      expect(mockVideoElement.currentTime).toBe(10);
    });

    it('registers AudioContext', () => {
      MasterClock.registerAudioContext(mockAudioContext);

      // Verify it's registered by checking sync status
      const status = MasterClock.getSyncStatus();
      expect(status.audioTime).toBeDefined();
    });

    it('handles multiple registrations', () => {
      MasterClock.registerVideo(mockVideoElement);
      MasterClock.registerAudioContext(mockAudioContext);

      const status = MasterClock.getSyncStatus();
      expect(status.videoTime).toBeDefined();
      expect(status.audioTime).toBeDefined();
    });
  });

  describe('time queries', () => {
    beforeEach(() => {
      MasterClock.init(100);
    });

    it('getTime returns current time in seconds', () => {
      expect(MasterClock.getTime()).toBe(0);

      MasterClock.seekTo(25.5);
      expect(MasterClock.getTime()).toBe(25.5);
    });

    it('getTimeMs returns current time in milliseconds', () => {
      expect(MasterClock.getTimeMs()).toBe(0);

      MasterClock.seekTo(25.5);
      expect(MasterClock.getTimeMs()).toBe(25500);
    });

    it('getDuration returns total duration', () => {
      expect(MasterClock.getDuration()).toBe(100);
    });

    it('isPlaying returns playback state', () => {
      expect(MasterClock.isPlaying()).toBe(false);

      MasterClock.play();
      expect(MasterClock.isPlaying()).toBe(true);

      MasterClock.pause();
      expect(MasterClock.isPlaying()).toBe(false);
    });
  });

  describe('seekTo', () => {
    beforeEach(() => {
      MasterClock.init(100);
    });

    it('seeks to valid time', () => {
      MasterClock.seekTo(50);
      expect(MasterClock.getTime()).toBe(50);
    });

    it('clamps to duration', () => {
      MasterClock.seekTo(150);
      expect(MasterClock.getTime()).toBe(100);
    });

    it('throws error for invalid time', () => {
      expect(() => MasterClock.seekTo(NaN)).toThrow('[MasterClock] Invalid seek time');
      expect(() => MasterClock.seekTo(-5)).toThrow('[MasterClock] Invalid seek time');
    });

    it('syncs video element on seek', () => {
      MasterClock.registerVideo(mockVideoElement);

      MasterClock.seekTo(30);
      expect(mockVideoElement.currentTime).toBe(30);
    });

    it('syncs AudioContext on seek', () => {
      mockAudioContext.currentTime = 10;
      MasterClock.registerAudioContext(mockAudioContext);

      MasterClock.seekTo(5);

      const status = MasterClock.getSyncStatus();
      expect(status.audioTime).toBe(5);
    });

    it('notifies subscribers on seek', () => {
      const subscriber = vi.fn();
      MasterClock.subscribe(subscriber);

      MasterClock.seekTo(25);

      expect(subscriber).toHaveBeenCalledWith(25, false);
    });
  });

  describe('playback control', () => {
    beforeEach(() => {
      MasterClock.init(100);
    });

    it('play starts playback', () => {
      MasterClock.play();

      expect(MasterClock.isPlaying()).toBe(true);
    });

    it('play does nothing if already playing', () => {
      const subscriber = vi.fn();
      MasterClock.subscribe(subscriber);

      MasterClock.play();
      subscriber.mockClear();

      MasterClock.play();

      expect(subscriber).not.toHaveBeenCalled();
    });

    it('pause stops playback', () => {
      MasterClock.play();
      MasterClock.pause();

      expect(MasterClock.isPlaying()).toBe(false);
    });

    it('stop resets to zero', () => {
      MasterClock.seekTo(50);
      MasterClock.play();

      MasterClock.stop();

      expect(MasterClock.getTime()).toBe(0);
      expect(MasterClock.isPlaying()).toBe(false);
    });

    it('play notifies subscribers', () => {
      const subscriber = vi.fn();
      MasterClock.subscribe(subscriber);

      MasterClock.play();

      expect(subscriber).toHaveBeenCalledWith(0, true);
    });

    it('pause notifies subscribers', () => {
      const subscriber = vi.fn();
      MasterClock.subscribe(subscriber);

      MasterClock.play();
      subscriber.mockClear();

      MasterClock.pause();

      expect(subscriber).toHaveBeenCalledWith(0, false);
    });

    it('stop notifies subscribers', () => {
      const subscriber = vi.fn();
      MasterClock.subscribe(subscriber);

      MasterClock.seekTo(50);
      MasterClock.play();
      subscriber.mockClear();

      MasterClock.stop();

      expect(subscriber).toHaveBeenCalledWith(0, false);
    });
  });

  describe('tick (RAF updates)', () => {
    beforeEach(() => {
      MasterClock.init(100);
    });

    it('returns 0 when not playing', () => {
      const dt = MasterClock.tick(1000);
      expect(dt).toBe(0);
      expect(MasterClock.getTime()).toBe(0);
    });

    it('returns 0 on first tick', () => {
      MasterClock.play();

      const dt = MasterClock.tick(1000);

      expect(dt).toBe(0);
      expect(MasterClock.getTime()).toBe(0);
    });

    it('advances time on subsequent ticks', () => {
      MasterClock.play();

      MasterClock.tick(1000); // First tick (baseline)
      const dt = MasterClock.tick(1016.67); // ~1 frame at 60fps

      expect(dt).toBeCloseTo(0.01667, 4); // ~16.67ms in seconds
      expect(MasterClock.getTime()).toBeCloseTo(0.01667, 4);
    });

    it('uses performance.now() if no timestamp provided', () => {
      const performanceSpy = vi.spyOn(performance, 'now').mockReturnValue(2000);

      MasterClock.play();
      MasterClock.tick(); // First tick

      performanceSpy.mockReturnValue(2016.67);
      const dt = MasterClock.tick(); // Second tick

      expect(dt).toBeCloseTo(0.01667, 4);

      performanceSpy.mockRestore();
    });

    it('pauses at duration end', () => {
      MasterClock.init(0.05); // 50ms duration
      MasterClock.play();

      MasterClock.tick(1000);
      MasterClock.tick(1100); // Advance beyond duration

      expect(MasterClock.getTime()).toBe(0.05);
      expect(MasterClock.isPlaying()).toBe(false);
    });

    it('does not pause at duration if duration is 0', () => {
      MasterClock.init(0);
      MasterClock.play();

      MasterClock.tick(1000);
      MasterClock.tick(1016.67);

      expect(MasterClock.isPlaying()).toBe(true);
    });
  });

  describe('subscriptions', () => {
    beforeEach(() => {
      MasterClock.init(100);
    });

    it('subscribe returns unsubscribe function', () => {
      const subscriber = vi.fn();
      const unsubscribe = MasterClock.subscribe(subscriber);

      expect(typeof unsubscribe).toBe('function');
    });

    it('notifies subscriber on state changes', () => {
      const subscriber = vi.fn();
      MasterClock.subscribe(subscriber);

      MasterClock.play();
      expect(subscriber).toHaveBeenCalledWith(0, true);

      MasterClock.pause();
      expect(subscriber).toHaveBeenCalledWith(0, false);

      MasterClock.seekTo(50);
      expect(subscriber).toHaveBeenCalledWith(50, false);
    });

    it('unsubscribe stops notifications', () => {
      const subscriber = vi.fn();
      const unsubscribe = MasterClock.subscribe(subscriber);

      unsubscribe();
      subscriber.mockClear();

      MasterClock.play();

      expect(subscriber).not.toHaveBeenCalled();
    });

    it('handles multiple subscribers', () => {
      const subscriber1 = vi.fn();
      const subscriber2 = vi.fn();

      MasterClock.subscribe(subscriber1);
      MasterClock.subscribe(subscriber2);

      MasterClock.play();

      expect(subscriber1).toHaveBeenCalledWith(0, true);
      expect(subscriber2).toHaveBeenCalledWith(0, true);
    });

    it('catches subscriber errors without throwing', () => {
      const errorSubscriber = vi.fn(() => {
        throw new Error('Subscriber error');
      });
      const normalSubscriber = vi.fn();

      MasterClock.subscribe(errorSubscriber);
      MasterClock.subscribe(normalSubscriber);

      expect(() => MasterClock.play()).not.toThrow();

      expect(errorSubscriber).toHaveBeenCalled();
      expect(normalSubscriber).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[MasterClock] Subscriber error:',
        expect.any(Error)
      );
    });
  });

  describe('forceSync', () => {
    beforeEach(() => {
      MasterClock.init(100);
      MasterClock.seekTo(50);
    });

    it('syncs video element', () => {
      mockVideoElement.currentTime = 0; // Out of sync
      MasterClock.registerVideo(mockVideoElement);

      MasterClock.forceSync();

      expect(mockVideoElement.currentTime).toBe(50);
    });

    it('syncs AudioContext', () => {
      mockAudioContext.currentTime = 100;
      MasterClock.registerAudioContext(mockAudioContext);

      MasterClock.forceSync();

      const status = MasterClock.getSyncStatus();
      expect(status.audioTime).toBe(50);
    });

    it('logs sync message', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      MasterClock.forceSync();

      expect(consoleLogSpy).toHaveBeenCalledWith('[MasterClock] Forced sync at:', '50.000', 's');

      consoleLogSpy.mockRestore();
    });
  });

  describe('getSyncStatus', () => {
    beforeEach(() => {
      MasterClock.init(100);
      MasterClock.seekTo(25);
    });

    it('returns basic status', () => {
      const status = MasterClock.getSyncStatus();

      expect(status.masterTime).toBe(25);
      expect(status.isPlaying).toBe(false);
      expect(status.subscriberCount).toBeGreaterThanOrEqual(0);
    });

    it('includes video status when registered', () => {
      mockVideoElement.currentTime = 25.1;
      MasterClock.registerVideo(mockVideoElement);

      const status = MasterClock.getSyncStatus();

      expect(status.videoTime).toBe(25.1);
      expect(status.videoDrift).toBeCloseTo(100, 0); // 0.1s * 1000ms
    });

    it('includes audio status when registered', () => {
      mockAudioContext.currentTime = 50;
      MasterClock.registerAudioContext(mockAudioContext);

      const status = MasterClock.getSyncStatus();

      expect(status.audioTime).toBeDefined();
      expect(status.audioDrift).toBeDefined();
    });

    it('tracks subscriber count', () => {
      const status1 = MasterClock.getSyncStatus();
      const initialCount = status1.subscriberCount;

      const unsubscribe = MasterClock.subscribe(() => {});

      const status2 = MasterClock.getSyncStatus();
      expect(status2.subscriberCount).toBe(initialCount + 1);

      unsubscribe();

      const status3 = MasterClock.getSyncStatus();
      expect(status3.subscriberCount).toBe(initialCount);
    });
  });

  describe('dispose', () => {
    beforeEach(() => {
      MasterClock.init(100);
      MasterClock.registerVideo(mockVideoElement);
      MasterClock.registerAudioContext(mockAudioContext);
      MasterClock.seekTo(50);
      MasterClock.play();
    });

    it('resets all state', () => {
      MasterClock.dispose();

      expect(MasterClock.getTime()).toBe(0);
      expect(MasterClock.getDuration()).toBe(0);
      expect(MasterClock.isPlaying()).toBe(false);
    });

    it('clears subscribers', () => {
      const subscriber = vi.fn();
      MasterClock.subscribe(subscriber);

      MasterClock.dispose();

      const status = MasterClock.getSyncStatus();
      expect(status.subscriberCount).toBe(0);
    });

    it('stops sync monitoring', async () => {
      MasterClock.dispose();

      // Wait for any pending sync checks
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should not crash or warn after dispose
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('clears registered elements', () => {
      MasterClock.dispose();

      const status = MasterClock.getSyncStatus();
      expect(status.videoTime).toBeUndefined();
      expect(status.audioTime).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('handles seek during playback', () => {
      MasterClock.init(100);
      MasterClock.play();

      MasterClock.tick(1000);
      MasterClock.tick(1050);

      MasterClock.seekTo(75);

      expect(MasterClock.getTime()).toBe(75);
      expect(MasterClock.isPlaying()).toBe(true);
    });

    it('handles rapid play/pause cycles', () => {
      MasterClock.init(100);

      MasterClock.play();
      MasterClock.pause();
      MasterClock.play();
      MasterClock.pause();

      expect(MasterClock.isPlaying()).toBe(false);
    });

    it('handles zero duration', () => {
      MasterClock.init(0);

      MasterClock.play();
      MasterClock.tick(1000);
      MasterClock.tick(1100);

      expect(MasterClock.isPlaying()).toBe(true);
    });

    it('handles video element with low readyState', () => {
      MasterClock.init(100);

      mockVideoElement.readyState = 1; // HAVE_METADATA
      mockVideoElement.currentTime = 50;
      MasterClock.registerVideo(mockVideoElement);

      MasterClock.seekTo(25);
      MasterClock.play();

      // Should not crash or throw
      expect(MasterClock.isPlaying()).toBe(true);
    });

    it('handles paused video element', () => {
      MasterClock.init(100);

      mockVideoElement.paused = true;
      mockVideoElement.currentTime = 50;
      MasterClock.registerVideo(mockVideoElement);

      MasterClock.play();

      // Should not crash or throw
      expect(MasterClock.isPlaying()).toBe(true);
    });

    it('handles suspended AudioContext', () => {
      MasterClock.init(100);

      mockAudioContext.state = 'suspended';
      MasterClock.registerAudioContext(mockAudioContext);

      MasterClock.play();

      // Should not crash or throw
      expect(MasterClock.isPlaying()).toBe(true);
    });

    it('handles multiple dispose calls', () => {
      MasterClock.init(100);

      MasterClock.dispose();

      expect(() => MasterClock.dispose()).not.toThrow();
    });

    it('handles operations after dispose', () => {
      MasterClock.init(100);
      MasterClock.dispose();

      // Should not crash
      expect(MasterClock.getTime()).toBe(0);
      expect(MasterClock.isPlaying()).toBe(false);

      const status = MasterClock.getSyncStatus();
      expect(status.masterTime).toBe(0);
    });
  });
});
