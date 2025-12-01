// @ts-check

import VolumeView from '../views/VolumeView';
import VolumeService from '../services/VolumeService';
import FadeHandles from '../views/FadeHandles';
import { getScale } from '../../../../../lib';

/**
 * @typedef {import('@types').ControllerConfig} ControllerConfig
 * @typedef {import('@types').VolumeControllerCallbacks} VolumeControllerCallbacks
 */

/**
 * VolumeController - Coordinates VolumeView and VolumeService
 */
export default class VolumeController {
  /** @type {VolumeView} */
  #view;
  /** @type {VolumeService} */
  #service;
  /** @type {FadeHandles | null} */
  #fadeHandles;
  /** @type {number} Track duration in seconds - required for fade calculations */
  #trackDuration = 0;

  /**
   * @param {ControllerConfig} config
   * @param {HTMLElement} $parent
   * @param {VolumeControllerCallbacks} [callbacks]
   */
  constructor(config, $parent, callbacks = {}) {
    const viewCallbacks = {
      onDrawStart: (posX, posY) => {
        this.#service.drawStart(posX, posY);
        this.#redraw();
      },
      onDraw: (posX, posY) => {
        this.#service.draw(posX, posY);
        this.#redraw();
      },
      onDrawEnd: () => {
        this.#service.drawEnd();
        this.#redrawImmediate();
      },
      onInsertKeyframe: posX => {
        this.insertKeyframe(posX);
      },
      onMoveKeyframe: (pathIndex, isStart, posX, posY) => {
        this.moveKeyframe(pathIndex, isStart, posX, posY);
      },
      onRemoveKeyframe: (pathIndex, isStart) => {
        this.removeKeyframe(pathIndex, isStart);
      },
      onKeyframeDragEnd: () => {
        this.#redrawImmediate();
      }
    };

    this.#view = new VolumeView(config, $parent, viewCallbacks);
    this.#service = new VolumeService(
      config,
      this.#view.getMaxPosX(),
      this.#view.getMaxValue(),
      callbacks
    );
    this.#fadeHandles = new FadeHandles(config, this.#view.getRoot(), {
      onFadeChange: fadeData => this.#handleFadeChange(fadeData)
    });
    this.#redraw();
  }

  #handleFadeChange = fadeData => {
    const scale = getScale();
    const fadeInPosX = fadeData.fadeIn / scale;
    const fadeOutPosX = fadeData.fadeOut / scale;
    this.applyFades(fadeInPosX, fadeOutPosX);
  };

  getRoot() {
    return this.#view.getRoot();
  }

  /**
   * @param {number} width - Track width in pixels
   * @param {number} [duration=0] - Track duration (REQUIRED for fade handles)
   */
  resize(width, duration = 0) {
    this.#view.resize(width);
    this.#service.resize(width);

    if (duration > 0) {
      this.#trackDuration = duration;
    }

    this.#fadeHandles?.updateLayout(width, this.#trackDuration);
    this.#redrawImmediate();

    return true;
  }

  setDuration(duration) {
    this.#trackDuration = duration;
    this.#fadeHandles?.updateLayout(this.#view.getMaxPosX(), duration);
  }

  enable() {
    this.#service.enable();
    this.#view.enable();
    this.#redrawImmediate();

    return true;
  }

  disable() {
    this.#service.disable();
    this.#view.disable();

    return true;
  }

  isEnabled() {
    return this.#service.isEnabled();
  }

  getPaths() {
    return this.#service.getPaths();
  }

  getKeyframePoints() {
    return this.#service.getKeyframePoints();
  }

  insertKeyframe(posX) {
    const result = this.#service.insertKeyframe(posX);
    this.#redraw();

    return result;
  }

  moveKeyframe(pathIndex, isStart, newPosX, newPosY) {
    this.#service.moveKeyframe(pathIndex, isStart, newPosX, newPosY);
    this.#redrawImmediate();
  }

  removeKeyframe(pathIndex, isStart) {
    const result = this.#service.removeKeyframe(pathIndex, isStart);

    if (result) {
      this.#redrawImmediate();
    }

    return result;
  }

  applyFadeIn(durationPosX) {
    this.#service.applyFadeIn(durationPosX);
    this.#redrawImmediate();

    return true;
  }

  applyFadeOut(durationPosX) {
    this.#service.applyFadeOut(durationPosX);
    this.#redrawImmediate();

    return true;
  }

  applyFades(fadeInPosX, fadeOutPosX) {
    this.#service.applyFades(fadeInPosX, fadeOutPosX);
    this.#redrawImmediate();

    return true;
  }

  #redraw() {
    this.#service.requestRedraw(pathData => {
      this.#view.updatePath(pathData);
      this.#view.updateKeyframes(this.#service.getKeyframePoints());
    });
  }

  #redrawImmediate() {
    this.#view.updatePath(this.#service.buildPathData());
    this.#view.updateKeyframes(this.#service.getKeyframePoints());
  }
}
