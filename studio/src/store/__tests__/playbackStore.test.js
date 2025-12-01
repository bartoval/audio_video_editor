import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the lib module - vi.fn() must be inside factory due to hoisting
vi.mock('../../lib', () => ({
  MasterClock: {
    init: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seekTo: vi.fn()
  }
}));

// Import after mocks are defined
import playbackStore from '../playbackStore.js';
import { MasterClock } from '../../lib';

describe('playbackStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store to initial state by re-initializing
    playbackStore.actions.init(100);
  });

  describe('init', () => {
    it('initializes with valid duration', () => {
      playbackStore.actions.init(60);

      const state = playbackStore.getState();

      expect(state.duration).toBe(60);
      expect(state.time).toBe(0);
      expect(state.isPlaying).toBe(false);
      expect(state.isLoopEnabled).toBe(false);
      expect(state.timeSlice).toEqual({ start: 0, end: 60 });
      expect(state.speed).toBe(1.0);
    });

    it('calls MasterClock.init with duration', () => {
      playbackStore.actions.init(120);

      expect(MasterClock.init).toHaveBeenCalledWith(120);
    });

    it('throws error for negative duration', () => {
      expect(() => playbackStore.actions.init(-1)).toThrow('Invalid duration');
    });

    it('throws error for NaN duration', () => {
      expect(() => playbackStore.actions.init(NaN)).toThrow('Invalid duration');
    });

    it('accepts zero duration', () => {
      playbackStore.actions.init(0);

      const state = playbackStore.getState();

      expect(state.duration).toBe(0);
    });
  });

  describe('play', () => {
    it('sets isPlaying to true', () => {
      playbackStore.actions.play();

      expect(playbackStore.getState().isPlaying).toBe(true);
    });

    it('calls MasterClock.play', () => {
      playbackStore.actions.play();

      expect(MasterClock.play).toHaveBeenCalled();
    });

    it('does not call MasterClock.play if already playing', () => {
      playbackStore.actions.play();
      MasterClock.play.mockClear();

      playbackStore.actions.play();

      expect(MasterClock.play).not.toHaveBeenCalled();
    });
  });

  describe('pause', () => {
    beforeEach(() => {
      playbackStore.actions.play();
    });

    it('sets isPlaying to false', () => {
      playbackStore.actions.pause();

      expect(playbackStore.getState().isPlaying).toBe(false);
    });

    it('calls MasterClock.pause', () => {
      playbackStore.actions.pause();

      expect(MasterClock.pause).toHaveBeenCalled();
    });

    it('does not call MasterClock.pause if already paused', () => {
      playbackStore.actions.pause();
      MasterClock.pause.mockClear();

      playbackStore.actions.pause();

      expect(MasterClock.pause).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('resets time to 0', () => {
      playbackStore.actions.seek(50);
      playbackStore.actions.stop();

      expect(playbackStore.getState().time).toBe(0);
    });

    it('sets isPlaying to false', () => {
      playbackStore.actions.play();
      playbackStore.actions.stop();

      expect(playbackStore.getState().isPlaying).toBe(false);
    });

    it('calls MasterClock.stop', () => {
      playbackStore.actions.stop();

      expect(MasterClock.stop).toHaveBeenCalled();
    });
  });

  describe('seek', () => {
    it('updates time to specified value', () => {
      playbackStore.actions.seek(30);

      expect(playbackStore.getState().time).toBe(30);
    });

    it('calls MasterClock.seekTo with time', () => {
      playbackStore.actions.seek(45);

      expect(MasterClock.seekTo).toHaveBeenCalledWith(45);
    });

    it('clamps time to duration', () => {
      playbackStore.actions.init(60);
      playbackStore.actions.seek(100);

      expect(playbackStore.getState().time).toBe(60);
    });

    it('throws error for negative time', () => {
      expect(() => playbackStore.actions.seek(-5)).toThrow('Invalid seek time');
    });

    it('throws error for NaN time', () => {
      expect(() => playbackStore.actions.seek(NaN)).toThrow('Invalid seek time');
    });

    it('allows seeking to 0', () => {
      playbackStore.actions.seek(50);
      playbackStore.actions.seek(0);

      expect(playbackStore.getState().time).toBe(0);
    });
  });

  describe('tick', () => {
    it('updates time on tick', () => {
      playbackStore.actions.tick(15.5);

      expect(playbackStore.getState().time).toBe(15.5);
    });

    it('does not update if time is same', () => {
      playbackStore.actions.tick(10);

      const callback = vi.fn();
      playbackStore.subscribe(callback);

      playbackStore.actions.tick(10);

      // Should not notify since value didn't change
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('setTimeSlice', () => {
    beforeEach(() => {
      playbackStore.actions.init(100);
    });

    it('sets valid time slice', () => {
      playbackStore.actions.setTimeSlice({ start: 10, end: 50 });

      expect(playbackStore.getState().timeSlice).toEqual({ start: 10, end: 50 });
    });

    it('rejects slice with start >= end', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      playbackStore.actions.setTimeSlice({ start: 50, end: 30 });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('rejects slice with negative start', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      playbackStore.actions.setTimeSlice({ start: -5, end: 50 });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('rejects slice with end > duration', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      playbackStore.actions.setTimeSlice({ start: 10, end: 150 });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('rejects slice with NaN values', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      playbackStore.actions.setTimeSlice({ start: NaN, end: 50 });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('resetTimeSlice', () => {
    it('resets time slice to full duration', () => {
      playbackStore.actions.init(80);
      playbackStore.actions.setTimeSlice({ start: 20, end: 60 });

      playbackStore.actions.resetTimeSlice();

      expect(playbackStore.getState().timeSlice).toEqual({ start: 0, end: 80 });
    });
  });

  describe('setSpeed', () => {
    it('sets valid speed', () => {
      playbackStore.actions.setSpeed(1.5);

      expect(playbackStore.getState().speed).toBe(1.5);
    });

    it('accepts speed less than 1', () => {
      playbackStore.actions.setSpeed(0.5);

      expect(playbackStore.getState().speed).toBe(0.5);
    });

    it('rejects zero speed', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      playbackStore.actions.setSpeed(0);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('rejects negative speed', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      playbackStore.actions.setSpeed(-1);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('rejects NaN speed', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      playbackStore.actions.setSpeed(NaN);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('toggleLoop', () => {
    it('toggles loop from false to true', () => {
      playbackStore.actions.toggleLoop();

      expect(playbackStore.getState().isLoopEnabled).toBe(true);
    });

    it('toggles loop from true to false', () => {
      playbackStore.actions.toggleLoop();
      playbackStore.actions.toggleLoop();

      expect(playbackStore.getState().isLoopEnabled).toBe(false);
    });
  });

  describe('setLoopEnabled', () => {
    it('sets loop to true', () => {
      playbackStore.actions.setLoopEnabled(true);

      expect(playbackStore.getState().isLoopEnabled).toBe(true);
    });

    it('sets loop to false', () => {
      playbackStore.actions.setLoopEnabled(true);
      playbackStore.actions.setLoopEnabled(false);

      expect(playbackStore.getState().isLoopEnabled).toBe(false);
    });
  });

  describe('subscriptions', () => {
    it('notifies subscribers on state changes', () => {
      const callback = vi.fn();
      playbackStore.subscribe(callback);

      playbackStore.actions.setSpeed(1.5);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ speed: 1.5 }));
    });

    it('returns unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = playbackStore.subscribe(callback);

      unsubscribe();
      callback.mockClear();

      playbackStore.actions.setSpeed(2.0);

      expect(callback).not.toHaveBeenCalled();
    });

    it('notifies multiple subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      playbackStore.subscribe(callback1);
      playbackStore.subscribe(callback2);

      playbackStore.actions.toggleLoop();

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('getState', () => {
    it('returns current state', () => {
      playbackStore.actions.init(50);

      const state = playbackStore.getState();

      expect(state).toHaveProperty('duration', 50);
      expect(state).toHaveProperty('time');
      expect(state).toHaveProperty('isPlaying');
      expect(state).toHaveProperty('isLoopEnabled');
      expect(state).toHaveProperty('timeSlice');
      expect(state).toHaveProperty('speed');
    });
  });
});
