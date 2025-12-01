// @ts-check

/**
 * @typedef {import('@types').PlaybackState} PlaybackState
 */

/**
 * Playback Store - manages playback state
 * Controls video/audio playback via MasterClock.
 */
import { MasterClock } from '../lib';

import { createStore } from './createStore';

/** @type {PlaybackState} */
const initialState = {
  duration: 0,
  time: 0,
  isPlaying: false,
  isLoopEnabled: false,
  timeSlice: { start: 0, end: 0 },
  speed: 1.0
};

const playbackStore = createStore(initialState, {
  actions: {
    init(state, duration) {
      if (isNaN(duration) || duration < 0) {
        throw new Error(`[PlaybackStore] Invalid duration: ${duration}`);
      }

      MasterClock.init(duration);

      return {
        duration,
        time: 0,
        isPlaying: false,
        isLoopEnabled: false,
        timeSlice: { start: 0, end: duration },
        speed: 1.0
      };
    },

    play(state) {
      if (state.isPlaying) {
        return undefined;
      }

      MasterClock.play();

      return { isPlaying: true };
    },

    pause(state) {
      if (!state.isPlaying) {
        return undefined;
      }

      MasterClock.pause();

      return { isPlaying: false };
    },

    stop() {
      MasterClock.stop();

      return {
        time: 0,
        isPlaying: false
      };
    },

    seek(state, time) {
      if (isNaN(time) || time < 0) {
        throw new Error(`[PlaybackStore] Invalid seek time: ${time}`);
      }

      const clampedTime = Math.min(time, state.duration);
      MasterClock.seekTo(clampedTime);

      return { time: clampedTime };
    },

    tick(state, time) {
      if (time === state.time) {
        return undefined;
      }

      return { time };
    },

    setTimeSlice(state, slice) {
      const { start, end } = slice;

      if (isNaN(start) || isNaN(end) || start < 0 || end > state.duration || start >= end) {
        console.warn('[PlaybackStore] Invalid time slice:', slice);

        return undefined;
      }

      return { timeSlice: { start, end } };
    },

    resetTimeSlice(state) {
      return { timeSlice: { start: 0, end: state.duration } };
    },

    setSpeed(state, speed) {
      if (isNaN(speed) || speed <= 0) {
        console.warn('[PlaybackStore] Invalid speed:', speed);

        return undefined;
      }

      return { speed };
    },

    toggleLoop(state) {
      return { isLoopEnabled: !state.isLoopEnabled };
    },

    setLoopEnabled(state, enabled) {
      return { isLoopEnabled: enabled };
    },

    updateDuration(state, newDuration) {
      if (isNaN(newDuration) || newDuration < 0) {
        console.warn('[PlaybackStore] Invalid duration:', newDuration);

        return undefined;
      }

      MasterClock.setDuration(newDuration);

      const clampedTime = Math.min(state.time, newDuration);
      const { start, end } = state.timeSlice;
      const clampedSlice = {
        start: Math.min(start, newDuration),
        end: Math.min(end, newDuration)
      };

      return {
        duration: newDuration,
        time: clampedTime,
        timeSlice: clampedSlice
      };
    }
  }
});

export default playbackStore;
