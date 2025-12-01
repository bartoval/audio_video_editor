import Mediator from 'Mediator';
import Commander from './modules/Main';
import Signals from 'signals';

export default class Player {
  constructor($parent) {
    this.$node = null;
    this.onMove = new Signals.Signal();

    this.render($parent);
    this.commander = new Commander(this.$node);

    this.commander.onMove.add(time => Mediator.onMoveFromPlayer(time));
    this.commander.onPlay.add(() => {
      Mediator.onSetTimeSlice();
      Mediator.onStart();
    });
    this.commander.onPause.add(() => Mediator.onStop());
    this.commander.onStop.add(() => Mediator.onReset());

    Mediator.registerPlayer(this);
  }

  init(duration, metaInfo) {
    this.commander.init(duration, metaInfo);
  }

  resize() {
    return this.commander.resize();
  }

  play() {
    return this.commander.setIsPlaying(true);
  }

  stop(time) {
    return this.moveTo(time) && this.commander.setIsPlaying(false);
  }

  pause(time) {
    return this.moveTo(time) && this.commander.setIsPlaying(false);
  }

  moveTo(time) {
    if (isNaN(time) || time < 0) {
      throw new Error('wrong input: time is ' + time);
    }

    this.commander.moveTo(time);

    return true;
  }

  render($parent) {
    this.$node = document.createElement('div');
    this.$node.className = 'w-100 flex-shrink-0 bg-body-tertiary border-top px-3 py-2';
    $parent.appendChild(this.$node);
  }
}
