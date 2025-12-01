// @ts-check

import { TIMING } from '../config/constants';
import { PLAYBACK } from '../config/ui';

const { SYNC_THRESHOLD_MS } = PLAYBACK;
const { SYNC_CHECK_INTERVAL } = TIMING;

/**
 * MasterClock - Single source of truth for playback time
 * Synchronizes video element and AudioContext
 */
class MasterClock {
  /** @type {number} */
  #syncThresholdMs;
  /** @type {number} */
  #syncCheckInterval;
  /** @type {number} */
  #time = 0;
  /** @type {number} */
  #duration = 0;
  /** @type {boolean} */
  #isPlaying = false;
  /** @type {number} */
  #lastTimestamp = -1;
  /** @type {HTMLVideoElement | null} */
  #videoElement = null;
  /** @type {AudioContext | null} */
  #audioContext = null;
  /** @type {number} */
  #audioContextStartTime = 0;
  /** @type {Set<function(number, boolean): void>} */
  #subscribers = new Set();
  /** @type {ReturnType<typeof setInterval> | null} */
  #syncCheckTimer = null;

  /**
   * @param {{ syncThresholdMs?: number, syncCheckInterval?: number }} [options]
   */
  constructor({
    syncThresholdMs = SYNC_THRESHOLD_MS,
    syncCheckInterval = SYNC_CHECK_INTERVAL
  } = {}) {
    this.#syncThresholdMs = syncThresholdMs;
    this.#syncCheckInterval = syncCheckInterval;
  }

  /**
   * Initialize clock with duration (resets state)
   * @param {number} duration - Duration in seconds
   */
  init(duration) {
    if (isNaN(duration) || duration < 0) {
      throw new Error('[MasterClock] Invalid duration: ' + duration);
    }

    this.#duration = duration;
    this.#time = 0;
    this.#isPlaying = false;
    this.#lastTimestamp = -1;
  }

  /**
   * Update duration without resetting playback state
   * @param {number} newDuration - New duration in seconds
   */
  setDuration(newDuration) {
    if (isNaN(newDuration) || newDuration < 0) {
      throw new Error('[MasterClock] Invalid duration: ' + newDuration);
    }

    this.#duration = newDuration;

    if (this.#time > this.#duration) {
      this.#time = this.#duration;
      this.#notifySubscribers();
    }
  }

  /**
   * Register video element for sync
   * @param {HTMLVideoElement} videoEl
   */
  registerVideo(videoEl) {
    this.#videoElement = videoEl;
  }

  /**
   * Register AudioContext for sync
   * @param {AudioContext} ctx
   */
  registerAudioContext(ctx) {
    this.#audioContext = ctx;
  }

  /**
   * Subscribe to time updates
   * @param {function(number, boolean): void} callback - Called with (time, isPlaying)
   * @returns {function(): void} Unsubscribe function
   */
  subscribe(callback) {
    this.#subscribers.add(callback);

    return () => this.#subscribers.delete(callback);
  }

  /** Get current time in seconds */
  getTime() {
    return this.#time;
  }

  /** Get current time in milliseconds */
  getTimeMs() {
    return this.#time * 1000;
  }

  /** Get total duration in seconds */
  getDuration() {
    return this.#duration;
  }

  /** Check if playing */
  isPlaying() {
    return this.#isPlaying;
  }

  /**
   * Seek to specific time
   * @param {number} time - Target time in seconds
   */
  seekTo(time) {
    if (isNaN(time) || time < 0) {
      throw new Error('[MasterClock] Invalid seek time: ' + time);
    }

    this.#time = Math.min(time, this.#duration);

    if (this.#videoElement) {
      this.#videoElement.currentTime = this.#time;
    }

    if (this.#audioContext) {
      this.#audioContextStartTime = this.#audioContext.currentTime - this.#time;
    }

    this.#notifySubscribers();
  }

  /** Start playback */
  play() {
    if (this.#isPlaying) {
      return;
    }

    this.#isPlaying = true;
    this.#lastTimestamp = -1;

    if (this.#audioContext) {
      this.#audioContextStartTime = this.#audioContext.currentTime - this.#time;
    }

    this.#startSyncMonitor();
    this.#notifySubscribers();
  }

  /** Pause playback */
  pause() {
    this.#isPlaying = false;
    this.#stopSyncMonitor();
    this.#notifySubscribers();
  }

  /** Stop and reset */
  stop() {
    this.#isPlaying = false;
    this.#time = 0;
    this.#lastTimestamp = -1;
    this.#stopSyncMonitor();
    this.#notifySubscribers();
  }

  /**
   * RAF tick - advance time
   * @param {number} [timestamp] - RAF timestamp
   * @returns {number} Delta time in seconds
   */
  tick(timestamp) {
    if (!this.#isPlaying) {
      return 0;
    }

    const now = timestamp || performance.now();

    if (this.#lastTimestamp < 0) {
      this.#lastTimestamp = now;

      return 0;
    }

    const dt = (now - this.#lastTimestamp) / 1000;
    this.#lastTimestamp = now;

    this.#time += dt;

    if (this.#time >= this.#duration && this.#duration > 0) {
      this.#time = this.#duration;
      this.pause();

      return dt;
    }

    return dt;
  }

  /** Force sync all sources */
  forceSync() {
    if (this.#videoElement) {
      this.#videoElement.currentTime = this.#time;
    }

    if (this.#audioContext) {
      this.#audioContextStartTime = this.#audioContext.currentTime - this.#time;
    }

    console.log('[MasterClock] Forced sync at:', this.#time.toFixed(3), 's');
  }

  /** Get sync status */
  getSyncStatus() {
    const status = {
      masterTime: this.#time,
      isPlaying: this.#isPlaying,
      subscriberCount: this.#subscribers.size
    };

    if (this.#videoElement) {
      status.videoTime = this.#videoElement.currentTime;
      status.videoDrift = Math.abs(this.#videoElement.currentTime - this.#time) * 1000;
    }

    if (this.#audioContext) {
      const audioTime = this.#audioContext.currentTime - this.#audioContextStartTime;
      status.audioTime = audioTime;
      status.audioDrift = Math.abs(audioTime - this.#time) * 1000;
    }

    return status;
  }

  /** Clean up resources */
  dispose() {
    this.#stopSyncMonitor();
    this.#subscribers.clear();
    this.#videoElement = null;
    this.#audioContext = null;
    this.#time = 0;
    this.#duration = 0;
    this.#isPlaying = false;
  }

  #checkSync = () => {
    if (!this.#isPlaying) {
      return;
    }

    const drifts = [];

    if (this.#videoElement && !this.#videoElement.paused && this.#videoElement.readyState >= 2) {
      const videoDrift = Math.abs(this.#videoElement.currentTime - this.#time) * 1000;

      if (videoDrift > this.#syncThresholdMs) {
        drifts.push({ source: 'video', drift: videoDrift });
        this.#videoElement.currentTime = this.#time;
      }
    }

    if (this.#audioContext && this.#audioContext.state === 'running') {
      const audioTime = this.#audioContext.currentTime - this.#audioContextStartTime;
      const audioDrift = Math.abs(audioTime - this.#time) * 1000;

      if (audioDrift > this.#syncThresholdMs) {
        drifts.push({ source: 'audio', drift: audioDrift });
        this.#audioContextStartTime = this.#audioContext.currentTime - this.#time;
      }
    }

    if (drifts.length > 0) {
      console.warn('[MasterClock] Sync correction:', drifts);
    }
  };

  #startSyncMonitor() {
    if (this.#syncCheckTimer) {
      return;
    }

    this.#syncCheckTimer = setInterval(this.#checkSync, this.#syncCheckInterval);
  }

  #stopSyncMonitor() {
    if (this.#syncCheckTimer) {
      clearInterval(this.#syncCheckTimer);
      this.#syncCheckTimer = null;
    }
  }

  #notifySubscribers() {
    this.#subscribers.forEach(callback => {
      try {
        callback(this.#time, this.#isPlaying);
      } catch (error) {
        console.error('[MasterClock] Subscriber error:', error);
      }
    });
  }
}

export default new MasterClock();
