import Mediator from '../Mediator';
import { Signals, View } from '../../lib';
import ControlBar from './ControlBar';

export default class Player extends View {
  constructor($parent) {
    super($parent);
    this.onMove = new Signals.Signal();
    this.controlBar = null;
    this.mount();
  }

  template() {
    return `<div class="w-100 flex-shrink-0 bg-body-tertiary border-top px-3 py-2"></div>`;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);

    this.controlBar = new ControlBar(this.$node);
  }

  onMount() {
    this.controlBar.onMove.add(time => Mediator.onMoveFromPlayer(time));
    this.controlBar.onPlay.add(() => {
      Mediator.onSetTimeSlice();
      Mediator.onStart();
    });
    this.controlBar.onPause.add(() => Mediator.onStop());
    this.controlBar.onStop.add(() => Mediator.onReset());
    this.controlBar.onRewind.add(() => Mediator.onRewind());
    this.controlBar.onSkipBack.add(seconds => Mediator.onSkipBack(seconds));
    this.controlBar.onSkipForward.add(seconds => Mediator.onSkipForward(seconds));
    this.controlBar.onFastForward.add(() => Mediator.onFastForward());

    Mediator.registerPlayer(this);
  }

  init(duration, metaInfo) {
    this.controlBar.init(duration, metaInfo);
  }

  resize() {
    return this.controlBar.resize();
  }

  play() {
    return this.controlBar.setIsPlaying(true);
  }

  stop(time) {
    return this.moveTo(time) && this.controlBar.setIsPlaying(false);
  }

  pause(time) {
    return this.moveTo(time) && this.controlBar.setIsPlaying(false);
  }

  moveTo(time) {
    if (isNaN(time) || time < 0) {
      throw new Error('wrong input: time is ' + time);
    }

    this.controlBar.moveTo(time);

    return true;
  }
}
