import { clamp } from '../../../../../lib';

/**
 * PanService - Handles pan state and calculations
 * Manages gain value and position state
 */
export default class PanService {
  #onChangePan = null;

  constructor(config, maxPosY, callbacks = {}) {
    this.#onChangePan = callbacks.onChangePan || (() => {});

    this.gain = config.panValue || 0;
    this.maxPosY = maxPosY;
    this.posY = 0;
    this.posX = 0;
    this.enabled = false;
  }

  /** Enable pan editing */
  enable() {
    this.enabled = true;

    return true;
  }

  /** Disable pan editing */
  disable() {
    this.enabled = false;

    return true;
  }

  /** Check if pan editing is enabled */
  isEnabled() {
    return this.enabled;
  }

  /** Start setting pan value */
  setValueStart(posX, posY) {
    posY = clamp(posY, 0, this.maxPosY);
    this.gain = (posY * 2) / this.maxPosY - 1;
    this.posX = posX;
    this.posY = posY;
    this.#onChangePan(this.gain);

    return { posX, posY, gain: this.gain };
  }

  /** Update pan value during drag */
  setValue(posX, posY) {
    posY = clamp(posY, 0, this.maxPosY);
    this.gain = (posY * 2) / this.maxPosY - 1;
    this.posX = posX;
    this.posY = posY;

    return { posX, posY, gain: this.gain };
  }

  /** End setting pan value */
  setValueEnd() {
    this.#onChangePan(this.gain);

    return true;
  }

  /** Get initial position from gain */
  getInitialPosY() {
    return ((this.gain + 1) / 2) * this.maxPosY;
  }
}
