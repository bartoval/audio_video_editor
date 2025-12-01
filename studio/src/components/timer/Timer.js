import Mediator from 'Mediator';
import Scheduler from 'Audio/Ctx';
import Component from 'Component';
import MasterClock from 'MasterClock';

export default class Timer {
  constructor(sec = 0) {
    this.onUpdate = this.onUpdate.bind(this);

    if (sec > 0) {
      MasterClock.init(sec);
    }

    Mediator.registerTimer(this);
    window.requestAnimationFrame(this.onUpdate);
  }

  /** Initialize with duration */
  init(sec) {
    if (isNaN(sec) || sec < 0) {
      throw new Error('wrong input: time is ' + sec);
    }

    this.reset();
    MasterClock.init(sec);

    return true;
  }

  /** Get duration from MasterClock */
  getDuration() {
    return MasterClock.getDuration();
  }

  /** Get current time from MasterClock */
  getTime() {
    return MasterClock.getTime();
  }

  /** Seek to time via MasterClock */
  seekTo(sec) {
    if (isNaN(sec) || sec < 0) {
      throw new Error('wrong input: time is ' + sec);
    }

    MasterClock.seekTo(sec);

    return true;
  }

  /** Check if playing */
  isRunning() {
    return MasterClock.isPlaying();
  }

  /** Start playback */
  start() {
    setTimeout(() => {
      Scheduler.play();
      MasterClock.play();
    }, 0);

    return true;
  }

  /** Stop/pause playback */
  stop() {
    MasterClock.pause();
    Scheduler.pause(this.getTime());

    return true;
  }

  /** Reset to beginning */
  reset() {
    MasterClock.stop();
    Scheduler.stop();

    return true;
  }

  /** RAF loop - drives MasterClock */
  onUpdate(preciseTimestamp) {
    window.requestAnimationFrame(this.onUpdate);

    try {
      const timestamp = preciseTimestamp || performance.now() || Date.now();
      const dt = MasterClock.tick(timestamp);

      if (MasterClock.isPlaying()) {
        Mediator.onUpdate();

        const time = MasterClock.getTime();
        const duration = MasterClock.getDuration();

        if (time >= duration && duration > 0) {
          console.log('[Timer] End of media');
          Mediator.onStop(time);
        }
      }

      Component.setFrames(dt);
    } catch (error) {
      console.error('[Timer] RAF loop error:', error);
    }
  }
}
