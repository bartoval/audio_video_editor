import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../../lib', () => ({
  Ctx: {
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn()
  }
}));

vi.mock('../../../store', () => ({
  playbackStore: {
    getState: vi.fn(() => ({
      isPlaying: false,
      time: 0,
      duration: 100,
      timeSlice: { start: 0, end: 100 }
    })),
    actions: {
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      seek: vi.fn(),
      resetTimeSlice: vi.fn(),
      init: vi.fn()
    }
  }
}));

describe('PlaybackCommands', () => {
  let PlaybackCommands;
  let Scheduler;
  let playbackStore;
  let mockVideo, mockNavigator;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();

    // Reset modules to get fresh singleton instance
    vi.resetModules();

    const libModule = await import('../../../lib');
    Scheduler = libModule.Ctx;

    const storeModule = await import('../../../store');
    playbackStore = storeModule.playbackStore;

    PlaybackCommands = (await import('../PlaybackCommands.js')).default;

    // Mock components
    mockVideo = {
      hasVideo: vi.fn(() => true),
      isPlaying: vi.fn(() => false),
      play: vi.fn(),
      stop: vi.fn(),
      setCurrentTime: vi.fn(),
      reset: vi.fn()
    };

    mockNavigator = {
      moveTo: vi.fn(),
      updateFrame: vi.fn(),
      clear: vi.fn()
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('registration', () => {
    it('registers video component', () => {
      PlaybackCommands.registerVideo(mockVideo);
      expect(() => PlaybackCommands.play()).not.toThrow();
    });

    it('registers navigator component', () => {
      PlaybackCommands.registerNavigator(mockNavigator);
      expect(() => PlaybackCommands.pause()).not.toThrow();
    });
  });

  describe('play', () => {
    it('returns true even when video is not registered (audio-only mode)', () => {
      const result = PlaybackCommands.play();
      expect(result).toBe(true);
    });

    it('calls video.play() when video is registered and not playing', () => {
      PlaybackCommands.registerVideo(mockVideo);
      PlaybackCommands.play();

      expect(mockVideo.play).toHaveBeenCalled();
    });

    it('does not call video.play() when video is already playing', () => {
      mockVideo.isPlaying.mockReturnValue(true);
      PlaybackCommands.registerVideo(mockVideo);
      PlaybackCommands.play();

      expect(mockVideo.play).not.toHaveBeenCalled();
    });

    it('calls Scheduler.play() after timeout when not playing', () => {
      PlaybackCommands.registerVideo(mockVideo);
      PlaybackCommands.play();

      vi.runAllTimers();

      expect(Scheduler.play).toHaveBeenCalled();
    });

    it('calls playbackStore.actions.play() after timeout when not playing', () => {
      PlaybackCommands.registerVideo(mockVideo);
      PlaybackCommands.play();

      vi.runAllTimers();

      expect(playbackStore.actions.play).toHaveBeenCalled();
    });

    it('does not call Scheduler.play() when already playing', () => {
      playbackStore.getState.mockReturnValue({ isPlaying: true });
      PlaybackCommands.registerVideo(mockVideo);
      PlaybackCommands.play();

      vi.runAllTimers();

      expect(Scheduler.play).not.toHaveBeenCalled();
    });

    it('returns true when video is registered', () => {
      PlaybackCommands.registerVideo(mockVideo);
      const result = PlaybackCommands.play();

      expect(result).toBe(true);
    });
  });

  describe('pause', () => {
    it('calls playbackStore.actions.pause()', () => {
      PlaybackCommands.pause();

      expect(playbackStore.actions.pause).toHaveBeenCalled();
    });

    it('calls Scheduler.pause() with current time', () => {
      playbackStore.getState.mockReturnValue({ time: 42 });
      PlaybackCommands.pause();

      expect(Scheduler.pause).toHaveBeenCalledWith(42);
    });

    it('calls video.stop() with current time when registered', () => {
      playbackStore.getState.mockReturnValue({ time: 42 });
      PlaybackCommands.registerVideo(mockVideo);
      PlaybackCommands.pause();

      expect(mockVideo.stop).toHaveBeenCalledWith(42);
    });

    it('does not call video.stop() when video is not registered', () => {
      PlaybackCommands.pause();

      // Should not throw
    });

    it('returns true', () => {
      const result = PlaybackCommands.pause();
      expect(result).toBe(true);
    });
  });

  describe('reset', () => {
    it('returns true even when video is not registered (audio-only mode)', () => {
      playbackStore.getState.mockReturnValue({
        timeSlice: { start: 0, end: 100 }
      });
      const result = PlaybackCommands.reset();
      expect(result).toBe(true);
    });

    it('resets to start of time slice when isScene is true', () => {
      playbackStore.getState.mockReturnValue({
        timeSlice: { start: 10, end: 50 }
      });
      PlaybackCommands.registerVideo(mockVideo);
      PlaybackCommands.reset(true);

      expect(playbackStore.actions.seek).toHaveBeenCalledWith(10);
    });

    it('resets to 0 when isScene is false', () => {
      PlaybackCommands.registerVideo(mockVideo);
      PlaybackCommands.reset(false);

      expect(playbackStore.actions.seek).toHaveBeenCalledWith(0);
    });

    it('calls playbackStore.actions.resetTimeSlice() when isScene is false', () => {
      PlaybackCommands.registerVideo(mockVideo);
      PlaybackCommands.reset(false);

      expect(playbackStore.actions.resetTimeSlice).toHaveBeenCalled();
    });

    it('does not call resetTimeSlice() when isScene is true', () => {
      PlaybackCommands.registerVideo(mockVideo);
      PlaybackCommands.reset(true);

      expect(playbackStore.actions.resetTimeSlice).not.toHaveBeenCalled();
    });

    it('calls video.stop() with seek time', () => {
      PlaybackCommands.registerVideo(mockVideo);
      PlaybackCommands.reset(false);

      expect(mockVideo.stop).toHaveBeenCalledWith(0);
    });

    it('calls navigator.moveTo() with seek time when registered', () => {
      PlaybackCommands.registerVideo(mockVideo);
      PlaybackCommands.registerNavigator(mockNavigator);
      PlaybackCommands.reset(false);

      expect(mockNavigator.moveTo).toHaveBeenCalledWith(0);
    });

    it('returns true when video is registered', () => {
      PlaybackCommands.registerVideo(mockVideo);
      const result = PlaybackCommands.reset();

      expect(result).toBe(true);
    });
  });

  describe('stop', () => {
    it('calls playbackStore.actions.stop()', () => {
      PlaybackCommands.stop();

      expect(playbackStore.actions.stop).toHaveBeenCalled();
    });

    it('calls Scheduler.stop()', () => {
      PlaybackCommands.stop();

      expect(Scheduler.stop).toHaveBeenCalled();
    });
  });

  describe('seek operations', () => {
    beforeEach(() => {
      PlaybackCommands.registerVideo(mockVideo);
      playbackStore.getState.mockReturnValue({
        time: 50,
        duration: 100
      });
    });

    describe('rewind', () => {
      it('seeks to 0', () => {
        PlaybackCommands.rewind();

        expect(playbackStore.actions.seek).toHaveBeenCalledWith(0);
      });

      it('returns true', () => {
        expect(PlaybackCommands.rewind()).toBe(true);
      });
    });

    describe('fastForward', () => {
      it('seeks to end minus 0.1s', () => {
        PlaybackCommands.fastForward();

        expect(playbackStore.actions.seek).toHaveBeenCalledWith(99.9);
      });

      it('returns true', () => {
        expect(PlaybackCommands.fastForward()).toBe(true);
      });
    });

    describe('skipBack', () => {
      it('skips back 5 seconds by default', () => {
        PlaybackCommands.skipBack();

        expect(playbackStore.actions.seek).toHaveBeenCalledWith(45);
      });

      it('skips back custom seconds', () => {
        PlaybackCommands.skipBack(10);

        expect(playbackStore.actions.seek).toHaveBeenCalledWith(40);
      });

      it('does not go below 0', () => {
        playbackStore.getState.mockReturnValue({ time: 3, duration: 100 });
        PlaybackCommands.skipBack(10);

        expect(playbackStore.actions.seek).toHaveBeenCalledWith(0);
      });

      it('returns true', () => {
        expect(PlaybackCommands.skipBack()).toBe(true);
      });
    });

    describe('skipForward', () => {
      it('skips forward 5 seconds by default', () => {
        PlaybackCommands.skipForward();

        expect(playbackStore.actions.seek).toHaveBeenCalledWith(55);
      });

      it('skips forward custom seconds', () => {
        PlaybackCommands.skipForward(10);

        expect(playbackStore.actions.seek).toHaveBeenCalledWith(60);
      });

      it('does not exceed duration', () => {
        playbackStore.getState.mockReturnValue({ time: 98, duration: 100 });
        PlaybackCommands.skipForward(10);

        expect(playbackStore.actions.seek).toHaveBeenCalledWith(100);
      });

      it('returns true', () => {
        expect(PlaybackCommands.skipForward()).toBe(true);
      });
    });

    describe('seekTo', () => {
      it('seeks to specified time', () => {
        PlaybackCommands.seekTo(75);

        expect(playbackStore.actions.seek).toHaveBeenCalledWith(75);
      });

      it('returns true', () => {
        expect(PlaybackCommands.seekTo(75)).toBe(true);
      });
    });
  });

  describe('moveFromPlayer', () => {
    it('updates navigator when registered', () => {
      PlaybackCommands.registerNavigator(mockNavigator);
      PlaybackCommands.moveFromPlayer(30);

      expect(mockNavigator.moveTo).toHaveBeenCalledWith(30);
    });

    it('calls playbackStore.actions.seek() with time', () => {
      PlaybackCommands.moveFromPlayer(30);

      expect(playbackStore.actions.seek).toHaveBeenCalledWith(30);
    });

    it('calls playbackStore.actions.pause()', () => {
      PlaybackCommands.moveFromPlayer(30);

      expect(playbackStore.actions.pause).toHaveBeenCalled();
    });

    it('calls Scheduler.pause() with time', () => {
      PlaybackCommands.moveFromPlayer(30);

      expect(Scheduler.pause).toHaveBeenCalledWith(30);
    });

    it('calls video.stop() when registered', () => {
      PlaybackCommands.registerVideo(mockVideo);
      PlaybackCommands.moveFromPlayer(30);

      expect(mockVideo.stop).toHaveBeenCalledWith(30);
    });

    it('returns true', () => {
      expect(PlaybackCommands.moveFromPlayer(30)).toBe(true);
    });
  });

  describe('moveFromNavigator', () => {
    it('calls playbackStore.actions.seek() with time', () => {
      PlaybackCommands.moveFromNavigator(40);

      expect(playbackStore.actions.seek).toHaveBeenCalledWith(40);
    });

    it('calls playbackStore.actions.pause()', () => {
      PlaybackCommands.moveFromNavigator(40);

      expect(playbackStore.actions.pause).toHaveBeenCalled();
    });

    it('calls Scheduler.pause() with time', () => {
      PlaybackCommands.moveFromNavigator(40);

      expect(Scheduler.pause).toHaveBeenCalledWith(40);
    });

    it('calls video.stop() when registered', () => {
      PlaybackCommands.registerVideo(mockVideo);
      PlaybackCommands.moveFromNavigator(40);

      expect(mockVideo.stop).toHaveBeenCalledWith(40);
    });

    it('returns true', () => {
      expect(PlaybackCommands.moveFromNavigator(40)).toBe(true);
    });
  });

  describe('updateFrame', () => {
    beforeEach(() => {
      playbackStore.getState.mockReturnValue({
        time: 50,
        duration: 100,
        timeSlice: { start: 10, end: 80 },
        isLoopEnabled: true
      });
    });

    it('loops back to start when time exceeds end with loop enabled', () => {
      PlaybackCommands.registerVideo(mockVideo);
      PlaybackCommands.registerNavigator(mockNavigator);

      // First call to set prevTime
      PlaybackCommands.updateFrame(50);

      // Second call that crosses the boundary
      PlaybackCommands.updateFrame(85);

      expect(mockVideo.setCurrentTime).toHaveBeenCalledWith(10);
      expect(mockNavigator.moveTo).toHaveBeenCalledWith(10);
    });

    it('does not loop when time is near duration end', () => {
      PlaybackCommands.registerVideo(mockVideo);
      PlaybackCommands.registerNavigator(mockNavigator);
      // Time must be >= duration - 0.2 to not loop (99.9 > 99.8)
      PlaybackCommands.updateFrame(99.9);

      expect(mockVideo.setCurrentTime).not.toHaveBeenCalled();
    });

    it('updates navigator when time is within range', () => {
      PlaybackCommands.registerNavigator(mockNavigator);
      PlaybackCommands.updateFrame(50);

      expect(mockNavigator.updateFrame).toHaveBeenCalledWith(50);
    });

    it('does not throw when components are not registered', () => {
      expect(() => PlaybackCommands.updateFrame(50)).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('calls stop()', () => {
      PlaybackCommands.cleanup();

      expect(playbackStore.actions.stop).toHaveBeenCalled();
      expect(Scheduler.stop).toHaveBeenCalled();
    });

    it('seeks to 0', () => {
      PlaybackCommands.cleanup();

      expect(playbackStore.actions.seek).toHaveBeenCalledWith(0);
    });

    it('calls video.reset() when registered', () => {
      PlaybackCommands.registerVideo(mockVideo);
      PlaybackCommands.cleanup();

      expect(mockVideo.reset).toHaveBeenCalled();
    });

    it('calls navigator.clear() when registered', () => {
      PlaybackCommands.registerNavigator(mockNavigator);
      PlaybackCommands.cleanup();

      expect(mockNavigator.clear).toHaveBeenCalled();
    });

    it('calls playbackStore.actions.init(0)', () => {
      PlaybackCommands.cleanup();

      expect(playbackStore.actions.init).toHaveBeenCalledWith(0);
    });

    it('resets all components', () => {
      PlaybackCommands.registerVideo(mockVideo);
      PlaybackCommands.registerNavigator(mockNavigator);
      PlaybackCommands.cleanup();

      expect(mockVideo.reset).toHaveBeenCalled();
      expect(mockNavigator.clear).toHaveBeenCalled();
    });
  });

  describe('integration', () => {
    it('handles full playback flow', () => {
      PlaybackCommands.registerVideo(mockVideo);
      PlaybackCommands.registerNavigator(mockNavigator);

      PlaybackCommands.play();
      vi.runAllTimers();

      expect(mockVideo.play).toHaveBeenCalled();
      expect(Scheduler.play).toHaveBeenCalled();

      PlaybackCommands.pause();
      expect(mockVideo.stop).toHaveBeenCalled();

      PlaybackCommands.stop();
      expect(Scheduler.stop).toHaveBeenCalled();
    });

    it('handles seek and update flow', () => {
      PlaybackCommands.registerVideo(mockVideo);
      PlaybackCommands.registerNavigator(mockNavigator);

      PlaybackCommands.seekTo(30);
      expect(mockVideo.stop).toHaveBeenCalledWith(30);
      expect(mockNavigator.moveTo).toHaveBeenCalledWith(30);

      PlaybackCommands.updateFrame(35);
      expect(mockNavigator.updateFrame).toHaveBeenCalledWith(35);
    });
  });
});
