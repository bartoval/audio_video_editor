import { TIMING } from '../constants';

const SYNC_THRESHOLD_MS = 50;
const { SYNC_CHECK_INTERVAL } = TIMING;

export default (() => {
  let _time = 0;
  let _duration = 0;
  let _isPlaying = false;
  let _lastTimestamp = -1;
  let _videoElement = null;
  let _audioContext = null;
  let _audioContextStartTime = 0;
  const _subscribers = new Set();
  let _syncCheckTimer = null;

  /** Check if video/audio have drifted */
  const _checkSync = () => {
    if (!_isPlaying) {
      return;
    }

    const drifts = [];

    // Check video drift
    if (_videoElement && !_videoElement.paused) {
      const videoDrift = Math.abs(_videoElement.currentTime - _time) * 1000;

      if (videoDrift > SYNC_THRESHOLD_MS) {
        drifts.push({ source: 'video', drift: videoDrift });
        _videoElement.currentTime = _time;
      }
    }

    // Check audio context drift
    if (_audioContext && _audioContext.state === 'running') {
      const audioTime = _audioContext.currentTime - _audioContextStartTime;
      const audioDrift = Math.abs(audioTime - _time) * 1000;

      if (audioDrift > SYNC_THRESHOLD_MS) {
        drifts.push({ source: 'audio', drift: audioDrift });
        // AudioContext can't be seeked directly - we track the offset
        _audioContextStartTime = _audioContext.currentTime - _time;
      }
    }

    if (drifts.length > 0) {
      console.warn('[MasterClock] Sync correction:', drifts);
    }
  };

  /** Start sync monitoring */
  const _startSyncMonitor = () => {
    if (_syncCheckTimer) {
      return;
    }

    _syncCheckTimer = setInterval(_checkSync, SYNC_CHECK_INTERVAL);
  };

  /** Stop sync monitoring */
  const _stopSyncMonitor = () => {
    if (_syncCheckTimer) {
      clearInterval(_syncCheckTimer);
      _syncCheckTimer = null;
    }
  };

  /** Notify all subscribers */
  const _notifySubscribers = () => {
    _subscribers.forEach(callback => {
      try {
        callback(_time, _isPlaying);
      } catch (error) {
        console.error('[MasterClock] Subscriber error:', error);
      }
    });
  };

  return {
    /** Initialize clock with duration */
    init(duration) {
      if (isNaN(duration) || duration < 0) {
        throw new Error('[MasterClock] Invalid duration: ' + duration);
      }

      _duration = duration;
      _time = 0;
      _isPlaying = false;
      _lastTimestamp = -1;
    },

    /** Register video element for sync */
    registerVideo(videoEl) {
      _videoElement = videoEl;
    },

    /** Register AudioContext for sync */
    registerAudioContext(ctx) {
      _audioContext = ctx;
    },

    /** Subscribe to time updates */
    subscribe(callback) {
      _subscribers.add(callback);

      return () => _subscribers.delete(callback);
    },

    /** Get current time in seconds */
    getTime() {
      return _time;
    },

    /** Get current time in milliseconds */
    getTimeMs() {
      return _time * 1000;
    },

    /** Get total duration in seconds */
    getDuration() {
      return _duration;
    },

    /** Check if playing */
    isPlaying() {
      return _isPlaying;
    },

    /** Seek to specific time */
    seekTo(time) {
      if (isNaN(time) || time < 0) {
        throw new Error('[MasterClock] Invalid seek time: ' + time);
      }

      _time = Math.min(time, _duration);

      // Sync external sources immediately on seek
      if (_videoElement) {
        _videoElement.currentTime = _time;
      }

      if (_audioContext) {
        _audioContextStartTime = _audioContext.currentTime - _time;
      }

      _notifySubscribers();
    },

    /** Start playback */
    play() {
      if (_isPlaying) {
        return;
      }

      _isPlaying = true;
      _lastTimestamp = -1;

      // Record audio context start time for sync
      if (_audioContext) {
        _audioContextStartTime = _audioContext.currentTime - _time;
      }

      _startSyncMonitor();
      _notifySubscribers();
    },

    /** Pause playback */
    pause() {
      _isPlaying = false;
      _stopSyncMonitor();
      _notifySubscribers();
    },

    /** Stop and reset */
    stop() {
      _isPlaying = false;
      _time = 0;
      _lastTimestamp = -1;
      _stopSyncMonitor();
      _notifySubscribers();
    },

    /** RAF tick - advance time */
    tick(timestamp) {
      if (!_isPlaying) {
        return 0;
      }

      const now = timestamp || performance.now();

      if (_lastTimestamp < 0) {
        _lastTimestamp = now;

        return 0;
      }

      const dt = (now - _lastTimestamp) / 1000; // Convert to seconds
      _lastTimestamp = now;

      _time += dt;

      // Check end of media
      if (_time >= _duration && _duration > 0) {
        _time = _duration;
        this.pause();

        return dt;
      }

      return dt;
    },

    /** Force sync all sources */
    forceSync() {
      if (_videoElement) {
        _videoElement.currentTime = _time;
      }

      if (_audioContext) {
        _audioContextStartTime = _audioContext.currentTime - _time;
      }

      console.log('[MasterClock] Forced sync at:', _time.toFixed(3), 's');
    },

    /** Get sync status */
    getSyncStatus() {
      const status = {
        masterTime: _time,
        isPlaying: _isPlaying,
        subscriberCount: _subscribers.size
      };

      if (_videoElement) {
        status.videoTime = _videoElement.currentTime;
        status.videoDrift = Math.abs(_videoElement.currentTime - _time) * 1000;
      }

      if (_audioContext) {
        const audioTime = _audioContext.currentTime - _audioContextStartTime;
        status.audioTime = audioTime;
        status.audioDrift = Math.abs(audioTime - _time) * 1000;
      }

      return status;
    },

    /** Clean up resources */
    dispose() {
      _stopSyncMonitor();
      _subscribers.clear();
      _videoElement = null;
      _audioContext = null;
      _time = 0;
      _duration = 0;
      _isPlaying = false;
    }
  };
})();
