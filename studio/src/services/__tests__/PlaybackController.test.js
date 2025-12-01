import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock all dependencies
vi.mock('../playback', () => ({
  PlaybackLoop: {
    setOnUpdate: vi.fn(),
    setOnEndReached: vi.fn(),
    start: vi.fn()
  },
  PlaybackCommands: {
    registerVideo: vi.fn(),
    registerNavigator: vi.fn(),
    stop: vi.fn(),
    play: vi.fn(() => true),
    pause: vi.fn(() => true),
    reset: vi.fn(() => true),
    rewind: vi.fn(() => true),
    fastForward: vi.fn(() => true),
    skipBack: vi.fn(() => true),
    skipForward: vi.fn(() => true),
    moveFromPlayer: vi.fn(() => true),
    moveFromNavigator: vi.fn(() => true),
    updateFrame: vi.fn(),
    cleanup: vi.fn()
  }
}));

const mockPlaybackStore = {
  getState: vi.fn(() => ({
    time: 0,
    duration: 100,
    isPlaying: false,
    timeSlice: null
  })),
  actions: {
    init: vi.fn(),
    seek: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    setTimeSlice: vi.fn()
  }
};

vi.mock('../../store', () => ({
  playbackStore: mockPlaybackStore
}));

describe('PlaybackController', () => {
  let playbackController;
  let PlaybackLoop;
  let PlaybackCommands;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset mock state
    mockPlaybackStore.getState.mockReturnValue({
      time: 0,
      duration: 100,
      isPlaying: false,
      timeSlice: null
    });

    // Re-import to get fresh mocks
    vi.resetModules();

    const playbackModule = await import('../playback');
    PlaybackLoop = playbackModule.PlaybackLoop;
    PlaybackCommands = playbackModule.PlaybackCommands;

    const module = await import('../PlaybackController.js');
    playbackController = module.default;
  });

  describe('constructor', () => {
    it('sets up loop callbacks', () => {
      expect(PlaybackLoop.setOnUpdate).toHaveBeenCalled();
      expect(PlaybackLoop.setOnEndReached).toHaveBeenCalled();
    });
  });

  describe('component registration', () => {
    it('registers video element', () => {
      const videoElement = { play: vi.fn() };
      playbackController.registerVideo(videoElement);

      expect(PlaybackCommands.registerVideo).toHaveBeenCalledWith(videoElement);
    });

    it('registers navigator', () => {
      const navigator = { id: 'navigator' };
      playbackController.registerNavigator(navigator);

      expect(PlaybackCommands.registerNavigator).toHaveBeenCalledWith(navigator);
    });
  });

  describe('timer interface', () => {
    describe('init()', () => {
      it('stops playback and initializes duration', () => {
        const result = playbackController.init(120);

        expect(PlaybackCommands.stop).toHaveBeenCalled();
        expect(mockPlaybackStore.actions.init).toHaveBeenCalledWith(120);
        expect(result).toBe(true);
      });
    });

    describe('getDuration()', () => {
      it('returns duration from store', () => {
        mockPlaybackStore.getState.mockReturnValue({ duration: 150 });

        expect(playbackController.getDuration()).toBe(150);
      });
    });

    describe('getTime()', () => {
      it('returns time from store', () => {
        mockPlaybackStore.getState.mockReturnValue({ time: 30 });

        expect(playbackController.getTime()).toBe(30);
      });
    });

    describe('seekTo()', () => {
      it('seeks to specified time', () => {
        const result = playbackController.seekTo(45);

        expect(mockPlaybackStore.actions.seek).toHaveBeenCalledWith(45);
        expect(result).toBe(true);
      });
    });

    describe('isRunning()', () => {
      it('returns false when not playing', () => {
        mockPlaybackStore.getState.mockReturnValue({ isPlaying: false });

        expect(playbackController.isRunning()).toBe(false);
      });

      it('returns true when playing', () => {
        mockPlaybackStore.getState.mockReturnValue({ isPlaying: true });

        expect(playbackController.isRunning()).toBe(true);
      });
    });

    describe('start()', () => {
      it('starts playback asynchronously and returns true', async () => {
        vi.useFakeTimers();

        const result = playbackController.start();

        expect(result).toBe(true);
        expect(mockPlaybackStore.actions.play).not.toHaveBeenCalled();

        vi.runAllTimers();

        expect(mockPlaybackStore.actions.play).toHaveBeenCalled();

        vi.useRealTimers();
      });
    });

    describe('stop()', () => {
      it('pauses playback and returns true', () => {
        const result = playbackController.stop();

        expect(mockPlaybackStore.actions.pause).toHaveBeenCalled();
        expect(result).toBe(true);
      });
    });

    describe('reset()', () => {
      it('calls PlaybackCommands.stop and returns true', () => {
        const result = playbackController.reset();

        expect(PlaybackCommands.stop).toHaveBeenCalled();
        expect(result).toBe(true);
      });
    });
  });

  describe('time slice', () => {
    describe('setTimeSlice()', () => {
      it('sets time slice with provided values', () => {
        mockPlaybackStore.getState.mockReturnValue({ time: 10, duration: 100 });

        playbackController.setTimeSlice({ start: 20, end: 80 });

        expect(mockPlaybackStore.actions.setTimeSlice).toHaveBeenCalledWith({
          start: 20,
          end: 80
        });
      });

      it('uses current time for missing start', () => {
        mockPlaybackStore.getState.mockReturnValue({ time: 15, duration: 100 });

        playbackController.setTimeSlice({ end: 80 });

        expect(mockPlaybackStore.actions.setTimeSlice).toHaveBeenCalledWith({
          start: 15,
          end: 80
        });
      });

      it('uses duration for missing end', () => {
        mockPlaybackStore.getState.mockReturnValue({ time: 10, duration: 100 });

        playbackController.setTimeSlice({ start: 20 });

        expect(mockPlaybackStore.actions.setTimeSlice).toHaveBeenCalledWith({
          start: 20,
          end: 100
        });
      });

      it('does nothing if timeSlice is null/undefined', () => {
        playbackController.setTimeSlice(null);
        playbackController.setTimeSlice(undefined);

        expect(mockPlaybackStore.actions.setTimeSlice).not.toHaveBeenCalled();
      });
    });

    describe('getTimeSlice()', () => {
      it('returns timeSlice from store', () => {
        mockPlaybackStore.getState.mockReturnValue({
          timeSlice: { start: 10, end: 50 }
        });

        expect(playbackController.getTimeSlice()).toEqual({ start: 10, end: 50 });
      });

      it('returns null when no timeSlice', () => {
        mockPlaybackStore.getState.mockReturnValue({ timeSlice: null });

        expect(playbackController.getTimeSlice()).toBeNull();
      });
    });
  });

  describe('playback actions', () => {
    describe('play()', () => {
      it('delegates to PlaybackCommands.play', () => {
        const result = playbackController.play();

        expect(PlaybackCommands.play).toHaveBeenCalled();
        expect(result).toBe(true);
      });
    });

    describe('pause()', () => {
      it('delegates to PlaybackCommands.pause', () => {
        const result = playbackController.pause();

        expect(PlaybackCommands.pause).toHaveBeenCalled();
        expect(result).toBe(true);
      });
    });

    describe('resetPlayback()', () => {
      it('delegates to PlaybackCommands.reset without isScene', () => {
        const result = playbackController.resetPlayback();

        expect(PlaybackCommands.reset).toHaveBeenCalledWith(false);
        expect(result).toBe(true);
      });

      it('delegates to PlaybackCommands.reset with isScene=true', () => {
        playbackController.resetPlayback(true);

        expect(PlaybackCommands.reset).toHaveBeenCalledWith(true);
      });
    });

    describe('rewind()', () => {
      it('delegates to PlaybackCommands.rewind', () => {
        const result = playbackController.rewind();

        expect(PlaybackCommands.rewind).toHaveBeenCalled();
        expect(result).toBe(true);
      });
    });

    describe('fastForward()', () => {
      it('delegates to PlaybackCommands.fastForward', () => {
        const result = playbackController.fastForward();

        expect(PlaybackCommands.fastForward).toHaveBeenCalled();
        expect(result).toBe(true);
      });
    });

    describe('skipBack()', () => {
      it('skips back 5 seconds by default', () => {
        playbackController.skipBack();

        expect(PlaybackCommands.skipBack).toHaveBeenCalledWith(5);
      });

      it('skips back specified seconds', () => {
        playbackController.skipBack(10);

        expect(PlaybackCommands.skipBack).toHaveBeenCalledWith(10);
      });
    });

    describe('skipForward()', () => {
      it('skips forward 5 seconds by default', () => {
        playbackController.skipForward();

        expect(PlaybackCommands.skipForward).toHaveBeenCalledWith(5);
      });

      it('skips forward specified seconds', () => {
        playbackController.skipForward(10);

        expect(PlaybackCommands.skipForward).toHaveBeenCalledWith(10);
      });
    });
  });

  describe('scrubber movement', () => {
    describe('moveFromPlayer()', () => {
      it('delegates to PlaybackCommands.moveFromPlayer', () => {
        const result = playbackController.moveFromPlayer(25);

        expect(PlaybackCommands.moveFromPlayer).toHaveBeenCalledWith(25);
        expect(result).toBe(true);
      });
    });

    describe('moveFromNavigator()', () => {
      it('delegates to PlaybackCommands.moveFromNavigator', () => {
        const result = playbackController.moveFromNavigator(30);

        expect(PlaybackCommands.moveFromNavigator).toHaveBeenCalledWith(30);
        expect(result).toBe(true);
      });
    });
  });

  describe('update loop', () => {
    describe('startLoop()', () => {
      it('starts the playback loop', () => {
        playbackController.startLoop();

        expect(PlaybackLoop.start).toHaveBeenCalled();
      });
    });
  });

  describe('cleanup', () => {
    describe('cleanup()', () => {
      it('delegates to PlaybackCommands.cleanup', () => {
        playbackController.cleanup();

        expect(PlaybackCommands.cleanup).toHaveBeenCalled();
      });
    });
  });
});
