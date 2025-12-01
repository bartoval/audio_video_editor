import { getFrames, getTimeFromPosX } from '../../../../lib';
import RulerView from './RulerView';
import ScrubberView from './ScrubberView';

/** Orchestrates ruler and scrubber components */
export default class RulerController {
  #rulerView = null;
  #scrubberView = null;
  #onMove = null;
  #onStart = null;
  #onStop = null;

  constructor($parent, callbacks = {}) {
    this.#onMove = callbacks.onMove || (() => {});
    this.#onStart = callbacks.onStart || (() => {});
    this.#onStop = callbacks.onStop || (() => {});

    this.#rulerView = new RulerView($parent, {
      onClick: posX => this.#handleRulerClick(posX)
    });
    this.#scrubberView = new ScrubberView($parent, this.#rulerView, {
      onMove: time => this.#onMove(time),
      onStart: () => this.#onStart(),
      onStop: () => this.#onStop()
    });
  }

  #handleRulerClick(posX) {
    this.#onStop();
    this.#scrubberView.moveTo(posX, false);
    this.#onMove(getTimeFromPosX(posX));
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

  zoomContinuous(scale) {
    this.#rulerView.resizeContinuous(scale);
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

  setDuration(duration) {
    this.#rulerView.setDuration(duration);
  }

  getPosX() {
    return this.#rulerView.getPosX();
  }

  getAbsolutePosX() {
    return this.#scrubberView.getAbsolutePosX();
  }

  showLoopRegion(startTime, endTime) {
    this.#rulerView.showLoopRegion(startTime, endTime);
  }

  hideLoopRegion() {
    this.#rulerView.hideLoopRegion();
  }

  destroy() {
    this.#scrubberView?.destroy();
    this.#rulerView?.destroy();
    this.#onMove = null;
    this.#onStart = null;
    this.#onStop = null;
  }
}
