import { Signals, View } from '../../lib';
import PlaybackButtons from './PlaybackButtons';
import Scrubber from './Scrubber';
import Timer from './Timer';

export default class ControlBar extends View {
  #$controlsRow = null;
  #$infoRow = null;
  #buttons = null;
  #scrubber = null;
  #timer = null;

  onMove = new Signals.Signal();
  onPlay = new Signals.Signal();
  onPause = new Signals.Signal();
  onStop = new Signals.Signal();
  onRewind = new Signals.Signal();
  onSkipBack = new Signals.Signal();
  onSkipForward = new Signals.Signal();
  onFastForward = new Signals.Signal();

  constructor($parent) {
    super($parent);
    this.mount();
  }

  template() {
    return `
      <div class="d-flex flex-column gap-4 w-100">
        <div data-ref="controls" class="d-flex align-items-center gap-3"></div>
        <div data-ref="info" class="d-flex align-items-center"></div>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);

    this.#$controlsRow = this.$node.querySelector('[data-ref="controls"]');
    this.#$infoRow = this.$node.querySelector('[data-ref="info"]');

    this.#buttons = new PlaybackButtons(this.#$controlsRow);
    this.#scrubber = new Scrubber(this.#$controlsRow);
    this.#timer = new Timer(this.#$infoRow);
  }

  onMount() {
    this.#scrubber.onMove.add(time => {
      this.#timer.update(time);
      this.setIsPlaying(false);
      this.onMove.dispatch(time);
    });

    this.#buttons.onPlay.add(() => this.onPlay.dispatch());
    this.#buttons.onPause.add(() => this.onPause.dispatch());
    this.#buttons.onStop.add(() => this.onStop.dispatch());
    this.#buttons.onRewind.add(() => this.onRewind.dispatch());
    this.#buttons.onSkipBack.add(seconds => this.onSkipBack.dispatch(seconds));
    this.#buttons.onSkipForward.add(seconds => this.onSkipForward.dispatch(seconds));
    this.#buttons.onFastForward.add(() => this.onFastForward.dispatch());
  }

  init(duration, metaInfo) {
    if (isNaN(duration) || duration < 0) {
      throw new Error('wrong input: duration is ' + duration);
    }

    this.#scrubber.init(duration);
    this.#timer.init(duration, metaInfo);
    this.#buttons.init();
  }

  resize() {
    return this.#scrubber.resize();
  }

  setIsPlaying(isPlaying) {
    if (typeof isPlaying !== 'boolean') {
      throw new Error('wrong input: isPlaying is ' + isPlaying);
    }

    return this.#buttons.setIsPlaying(isPlaying) && this.#scrubber.setIsScrolling(isPlaying);
  }

  moveTo(time) {
    if (isNaN(time) || time < 0) {
      throw new Error('wrong input: time is ' + time);
    }

    this.#scrubber.moveTo(time);
    this.#timer.update(time);

    return true;
  }

  play() {
    return this.setIsPlaying(true);
  }

  stop(time) {
    this.setIsPlaying(false);
    this.moveTo(time);

    return true;
  }

  pause(time) {
    this.setIsPlaying(false);
    this.moveTo(time);

    return true;
  }
}
