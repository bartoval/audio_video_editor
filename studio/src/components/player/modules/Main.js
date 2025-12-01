/**
 * Created by valerio bartolini.
 */
import Signals from 'signals';
import Controller from './Controller';
import Scrubber from './Scrubber';
import Timer from './Timer';

// ============================================================================
// Private methods
// ============================================================================

let _addSignals = self => {
  self.scrubber.onMove.add(time => {
    self.timer.update(time);
    self.setIsPlaying(false);
    self.onMove.dispatch(time);
  });
  self.controller.onPlay.add(() => {
    self.onPlay.dispatch();
  });
  self.controller.onPause.add(() => {
    self.onPause.dispatch();
  });
  self.controller.onStop.add(() => {
    self.onStop.dispatch();
  });
  self.controller.onFullScreen.add(() => {
    self.scrubber.resize();
  });
};

// ============================================================================
// Class
// ============================================================================

export default class Main {
  constructor($parent) {
    this.$node = null;
    this.$controlsRow = null;
    this.$infoRow = null;

    this.render($parent);

    this.controller = new Controller(this.$controlsRow);
    this.scrubber = new Scrubber(this.$controlsRow);
    this.timer = new Timer(this.$infoRow);

    this.onMove = new Signals.Signal();
    this.onPlay = new Signals.Signal();
    this.onPause = new Signals.Signal();
    this.onStop = new Signals.Signal();

    _addSignals(this);
  }

  /**
   * @param duration
   * @param metaInfo
   */
  init(duration, metaInfo) {
    if (isNaN(duration) || duration < 0) {
      throw new Error('wrong input: duration is ' + duration);
    }

    this.scrubber.init(duration);
    this.timer.init(duration, metaInfo);
    this.controller.init();
  }

  /**
   * @returns {boolean}
   */
  resize() {
    return this.scrubber.resize();
  }

  /**
   * @param isPlaying
   * @returns {boolean}
   */
  setIsPlaying(isPlaying) {
    if (typeof isPlaying !== 'boolean') {
      throw new Error('wrong input: isPlaying is ' + isPlaying);
    }

    return this.controller.setIsPlaying(isPlaying) && this.scrubber.setIsScrolling(isPlaying);
  }

  /**
   * @param time
   * @returns {boolean}
   */
  moveTo(time) {
    if (isNaN(time) || time < 0) {
      throw new Error('wrong input: time is ' + time);
    }

    this.scrubber.moveTo(time);
    this.timer.update(time);

    return true;
  }

  /**
   * Called when play is triggered externally
   * @returns {boolean}
   */
  play() {
    return this.setIsPlaying(true);
  }

  /**
   * Called when stop is triggered externally
   * @param time
   * @returns {boolean}
   */
  stop(time) {
    this.setIsPlaying(false);
    this.moveTo(time);

    return true;
  }

  /**
   * Called when pause is triggered externally
   * @param time
   * @returns {boolean}
   */
  pause(time) {
    this.setIsPlaying(false);
    this.moveTo(time);

    return true;
  }

  render($parent) {
    // Player main container
    this.$node = document.createElement('div');
    this.$node.className = 'd-flex flex-column gap-2 w-100';
    $parent.appendChild(this.$node);

    // Top row: Controls + Scrubber
    this.$controlsRow = document.createElement('div');
    this.$controlsRow.className = 'd-flex align-items-center gap-3';
    this.$node.appendChild(this.$controlsRow);

    // Bottom row: Timer info
    this.$infoRow = document.createElement('div');
    this.$infoRow.className = 'd-flex align-items-center';
    this.$node.appendChild(this.$infoRow);
  }
}
