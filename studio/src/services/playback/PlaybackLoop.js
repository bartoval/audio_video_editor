// @ts-check

/**
 * PlaybackLoop - manages RAF update loop
 */
import { setFrames, MasterClock } from '../../lib';
import { playbackStore } from '../../store';

class PlaybackLoop {
  /** @type {((time: number) => void) | null} */
  #onUpdate = null;
  /** @type {(() => void) | null} */
  #onEndReached = null;

  constructor() {
    this.tick = this.tick.bind(this);
  }

  /**
   * @param {(time: number) => void} callback
   */
  setOnUpdate(callback) {
    this.#onUpdate = callback;
  }

  /**
   * @param {() => void} callback
   */
  setOnEndReached(callback) {
    this.#onEndReached = callback;
  }

  start() {
    window.requestAnimationFrame(this.tick);
  }

  /**
   * @param {DOMHighResTimeStamp} preciseTimestamp
   */
  tick(preciseTimestamp) {
    window.requestAnimationFrame(this.tick);

    try {
      const timestamp = preciseTimestamp || performance.now() || Date.now();
      const dt = MasterClock.tick(timestamp);

      const state = playbackStore.getState();

      if (state.isPlaying) {
        const time = MasterClock.getTime();

        // Update store with current time
        playbackStore.actions.tick(time);

        if (this.#onUpdate) {
          this.#onUpdate(time);
        }

        if (time >= state.duration && state.duration > 0) {
          if (this.#onEndReached) {
            this.#onEndReached();
          }
        }
      }

      setFrames(dt);
    } catch (error) {
      console.error('[PlaybackLoop] RAF error:', error);
    }
  }
}

export default new PlaybackLoop();
