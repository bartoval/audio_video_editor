/**
 * PlaybackLoop - manages RAF update loop
 */
import { setFrames } from '../../lib';
import PlaybackState from './PlaybackState';

class PlaybackLoop {
  #onUpdate = null;
  #onEndReached = null;

  constructor() {
    this.tick = this.tick.bind(this);
  }

  // ============================================================================
  // Callbacks
  // ============================================================================

  setOnUpdate(callback) {
    this.#onUpdate = callback;
  }

  setOnEndReached(callback) {
    this.#onEndReached = callback;
  }

  // ============================================================================
  // Loop Control
  // ============================================================================

  start() {
    window.requestAnimationFrame(this.tick);
  }

  tick(preciseTimestamp) {
    window.requestAnimationFrame(this.tick);

    try {
      const timestamp = preciseTimestamp || performance.now() || Date.now();
      const dt = PlaybackState.tick(timestamp);

      if (PlaybackState.isPlaying()) {
        const time = PlaybackState.getTime();
        const duration = PlaybackState.getDuration();

        if (this.#onUpdate) {
          this.#onUpdate(time);
        }

        if (time >= duration && duration > 0) {
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
