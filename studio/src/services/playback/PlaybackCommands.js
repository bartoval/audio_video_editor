/**
 * PlaybackCommands - playback actions (play/pause/seek/skip)
 *
 * Still calls components directly for now (video, player, navigator).
 * Future: replace with EventBus.
 */
import { Ctx as Scheduler } from '../../lib';
import PlaybackState from './PlaybackState';

class PlaybackCommands {
  #video = null;
  #player = null;
  #navigator = null;

  // ============================================================================
  // Component Registration
  // ============================================================================

  registerVideo(video) {
    this.#video = video;
  }

  registerPlayer(player) {
    this.#player = player;
  }

  registerNavigator(navigator) {
    this.#navigator = navigator;
  }

  // ============================================================================
  // Core Playback
  // ============================================================================

  play() {
    if (!this.#video) {
      return false;
    }

    if (!this.#video.isPlaying()) {
      this.#video.play();
    }

    if (!PlaybackState.isPlaying()) {
      setTimeout(() => {
        Scheduler.play();
        PlaybackState.play();
      }, 0);
    }

    if (this.#player) {
      this.#player.play();
    }

    return true;
  }

  pause() {
    const time = PlaybackState.getTime();

    PlaybackState.pause();
    Scheduler.pause(time);

    if (this.#video) {
      this.#video.stop(time);
    }

    return true;
  }

  reset(isScene = false) {
    if (!this.#video) {
      return false;
    }

    const { start } = PlaybackState.getTimeSlice();

    if (!isScene) {
      PlaybackState.resetTimeSlice(this.#video.getDuration());
    }

    const seekTime = isScene ? start : 0;

    PlaybackState.seekTo(seekTime);
    PlaybackState.pause();
    Scheduler.pause(seekTime);

    this.#video.stop(seekTime);

    if (this.#player) {
      this.#player.stop(seekTime);
    }

    if (this.#navigator) {
      this.#navigator.moveTo(seekTime);
    }

    return true;
  }

  stop() {
    PlaybackState.stop();
    Scheduler.stop();
  }

  // ============================================================================
  // Seek Operations
  // ============================================================================

  rewind() {
    return this.#seekToTime(0);
  }

  fastForward() {
    const duration = PlaybackState.getDuration();

    return this.#seekToTime(Math.max(0, duration - 0.1));
  }

  skipBack(seconds = 5) {
    const time = Math.max(0, PlaybackState.getTime() - seconds);

    return this.#seekToTime(time);
  }

  skipForward(seconds = 5) {
    const duration = PlaybackState.getDuration();
    const time = Math.min(duration, PlaybackState.getTime() + seconds);

    return this.#seekToTime(time);
  }

  seekTo(time) {
    return this.#seekToTime(time);
  }

  #seekToTime(time) {
    PlaybackState.seekTo(time);
    PlaybackState.pause();
    Scheduler.pause(time);

    if (this.#video) {
      this.#video.stop(time);
    }

    if (this.#player) {
      this.#player.pause(time);
    }

    if (this.#navigator) {
      this.#navigator.moveTo(time);
    }

    return true;
  }

  // ============================================================================
  // Scrubber Movement (from Player or Navigator)
  // ============================================================================

  moveFromPlayer(time) {
    if (this.#navigator) {
      this.#navigator.moveTo(time);
    }

    PlaybackState.seekTo(time);
    PlaybackState.pause();
    Scheduler.pause(time);

    if (this.#video) {
      this.#video.stop(time);
    }

    return true;
  }

  moveFromNavigator(time) {
    if (this.#player) {
      this.#player.pause(time);
    }

    PlaybackState.seekTo(time);
    PlaybackState.pause();
    Scheduler.pause(time);

    if (this.#video) {
      this.#video.stop(time);
    }

    return true;
  }

  // ============================================================================
  // Update (called by loop)
  // ============================================================================

  updateFrame(time) {
    const { start, end } = PlaybackState.getTimeSlice();
    const duration = PlaybackState.getDuration();

    // Loop within time slice
    if (time > end && time < duration - 0.2) {
      if (this.#video) {
        this.#video.setCurrentTime(start);
      }

      if (this.#navigator) {
        this.#navigator.moveTo(start);
      }

      return;
    }

    if (this.#player) {
      this.#player.moveTo(time);
    }

    if (this.#navigator) {
      this.#navigator.updateFrame(time);
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  cleanup() {
    this.stop();
    PlaybackState.seekTo(0);

    if (this.#video) {
      this.#video.reset();
    }

    if (this.#navigator) {
      this.#navigator.clear();
    }

    if (this.#player) {
      this.#player.stop(0);
    }

    PlaybackState.resetTimeSlice(0);
  }
}

export default new PlaybackCommands();
