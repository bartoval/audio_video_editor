/**
 * PlaybackCommands - playback actions (play/pause/seek/skip)
 *
 * Uses playbackStore for state management.
 * Components subscribe to playbackStore for updates.
 */
import { Ctx as Scheduler } from '../../lib';
import { playbackStore } from '../../store';

class PlaybackCommands {
  #video = null;
  #navigator = null;
  #prevTime = 0;

  // Component Registration

  registerVideo(video) {
    this.#video = video;
  }

  registerNavigator(navigator) {
    this.#navigator = navigator;
  }

  // Core Playback

  play() {
    // Play video if available
    if (this.#video?.hasVideo?.()) {
      if (!this.#video.isPlaying()) {
        this.#video.play();
      }
    }

    const state = playbackStore.getState();

    if (!state.isPlaying) {
      setTimeout(() => {
        Scheduler.play();
        playbackStore.actions.play();
      }, 0);
    }

    return true;
  }

  pause() {
    const time = playbackStore.getState().time;

    playbackStore.actions.pause();
    Scheduler.pause(time);

    if (this.#video) {
      this.#video.stop(time);
    }

    return true;
  }

  reset(isScene = false) {
    const state = playbackStore.getState();
    const { start } = state.timeSlice;

    if (!isScene) {
      playbackStore.actions.resetTimeSlice();
    }

    const seekTime = isScene ? start : 0;

    playbackStore.actions.seek(seekTime);
    playbackStore.actions.pause();
    Scheduler.pause(seekTime);

    if (this.#video?.hasVideo?.()) {
      this.#video.stop(seekTime);
    }

    if (this.#navigator) {
      this.#navigator.moveTo(seekTime);
    }

    return true;
  }

  stop() {
    playbackStore.actions.stop();
    Scheduler.stop();
  }

  // Seek Operations

  rewind() {
    return this.#seekToTime(0);
  }

  fastForward() {
    const state = playbackStore.getState();

    return this.#seekToTime(Math.max(0, state.duration - 0.1));
  }

  skipBack(seconds = 5) {
    const state = playbackStore.getState();
    const time = Math.max(0, state.time - seconds);

    return this.#seekToTime(time);
  }

  skipForward(seconds = 5) {
    const state = playbackStore.getState();
    const time = Math.min(state.duration, state.time + seconds);

    return this.#seekToTime(time);
  }

  seekTo(time) {
    return this.#seekToTime(time);
  }

  #seekToTime(time) {
    playbackStore.actions.seek(time);
    playbackStore.actions.pause();
    Scheduler.pause(time);

    if (this.#video) {
      this.#video.stop(time);
    }

    if (this.#navigator) {
      this.#navigator.moveTo(time);
    }

    return true;
  }

  // Scrubber Movement (from Player or Navigator)

  moveFromPlayer(time) {
    if (this.#navigator) {
      this.#navigator.moveTo(time);
    }

    playbackStore.actions.seek(time);
    playbackStore.actions.pause();
    Scheduler.pause(time);

    if (this.#video) {
      this.#video.stop(time);
    }

    return true;
  }

  moveFromNavigator(time) {
    playbackStore.actions.seek(time);
    playbackStore.actions.pause();
    Scheduler.pause(time);

    if (this.#video) {
      this.#video.stop(time);
    }

    return true;
  }

  // Update (called by loop)

  updateFrame(time) {
    const state = playbackStore.getState();
    const { start, end } = state.timeSlice;

    const crossedEndBoundary = this.#prevTime <= end && time > end;

    if (state.isLoopEnabled && crossedEndBoundary && time < state.duration - 0.2) {
      Scheduler.pause(start);
      Scheduler.play();

      playbackStore.actions.seek(start);

      if (this.#video) {
        this.#video.setCurrentTime(start);
      }

      if (this.#navigator) {
        this.#navigator.moveTo(start);
      }

      this.#prevTime = start;

      return;
    }

    this.#prevTime = time;

    if (this.#navigator) {
      this.#navigator.updateFrame(time);
    }
  }

  // Cleanup

  cleanup() {
    this.stop();
    playbackStore.actions.seek(0);

    if (this.#video) {
      this.#video.reset();
    }

    if (this.#navigator) {
      this.#navigator.clear();
    }

    // Reset to empty state
    playbackStore.actions.init(0);
  }
}

export default new PlaybackCommands();
