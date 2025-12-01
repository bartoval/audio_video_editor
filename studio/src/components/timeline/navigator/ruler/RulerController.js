import { Signals, getFrames, getTimeFromPosX } from '../../../../lib';
import RulerView from './RulerView';
import ScrubberView from './ScrubberView';

/** Orchestrates ruler and scrubber components */
export default class RulerController {
  #rulerView = null;
  #scrubberView = null;

  onMove = new Signals.Signal();
  onStart = new Signals.Signal();
  onStop = new Signals.Signal();

  constructor($parent) {
    this.#rulerView = new RulerView($parent);
    this.#scrubberView = new ScrubberView($parent, this.#rulerView);
    this.#bindEvents();
  }

  init(duration) {
    const result = this.#rulerView.init(duration);
    this.#scrubberView.init();

    return result;
  }

  resize() {
    this.#scrubberView.resize();
  }

  zoom(scaleIndex) {
    this.#rulerView.resize(scaleIndex);
    this.#scrubberView.zoom();

    return true;
  }

  moveTo(posX, moveAll = true) {
    if (isNaN(posX) || posX < 0) {
      throw new Error('wrong input: posX is ' + posX);
    }

    return this.#scrubberView.moveTo(posX, moveAll);
  }

  updateFrame(posX) {
    const { preciseFrame, frame } = getFrames();

    return this.#scrubberView.updateFrame(posX, preciseFrame, frame);
  }

  getRange() {
    return this.#rulerView.getRange();
  }

  getMaxWidth() {
    return this.#rulerView.getMaxWidth();
  }

  getDuration() {
    return this.#rulerView.getDuration();
  }

  getPosX() {
    return this.#rulerView.getPosX();
  }

  getAbsolutePosX() {
    return this.#scrubberView.getAbsolutePosX();
  }

  // ============================================================================
  // Private
  // ============================================================================

  #bindEvents() {
    this.#scrubberView.onMove.add(time => this.onMove.dispatch(time));
    this.#scrubberView.onStart.add(() => this.onStart.dispatch());
    this.#scrubberView.onStop.add(() => this.onStop.dispatch());
  }
}
