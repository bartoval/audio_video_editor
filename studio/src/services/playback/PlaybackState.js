/**
 * PlaybackState - manages playback state and time slice
 */
import { MasterClock } from '../../lib';

class PlaybackState {
  #start = 0;
  #end = 0;

  // ============================================================================
  // Time Slice
  // ============================================================================

  setTimeSlice(start, end) {
    this.#start = start;
    this.#end = end;
  }

  getTimeSlice() {
    return { start: this.#start, end: this.#end };
  }

  get start() {
    return this.#start;
  }

  get end() {
    return this.#end;
  }

  resetTimeSlice(duration) {
    this.#start = 0;
    this.#end = duration;
  }

  // ============================================================================
  // MasterClock Delegation
  // ============================================================================

  init(duration) {
    if (isNaN(duration) || duration < 0) {
      throw new Error(`Invalid duration: ${duration}`);
    }

    MasterClock.init(duration);
    this.#start = 0;
    this.#end = duration;
  }

  getTime() {
    return MasterClock.getTime();
  }

  getDuration() {
    return MasterClock.getDuration();
  }

  seekTo(time) {
    if (isNaN(time) || time < 0) {
      throw new Error(`Invalid time: ${time}`);
    }

    MasterClock.seekTo(time);
  }

  isPlaying() {
    return MasterClock.isPlaying();
  }

  play() {
    MasterClock.play();
  }

  pause() {
    MasterClock.pause();
  }

  stop() {
    MasterClock.stop();
  }

  tick(timestamp) {
    return MasterClock.tick(timestamp);
  }
}

export default new PlaybackState();
