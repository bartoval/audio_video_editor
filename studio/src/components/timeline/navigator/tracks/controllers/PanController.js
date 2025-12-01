import PanView from '../views/PanView';
import PanService from '../services/PanService';

/**
 * PanController - Coordinates PanView and PanService
 * Acts as a facade, delegating to view and service
 */
export default class PanController {
  #view;
  #service;

  constructor(config, $parent) {
    this.#view = new PanView(config, $parent);
    this.#service = new PanService(config, this.#view.getMaxPosY());

    // Initial position
    const initialPosY = this.#service.getInitialPosY();
    this.#view.moveTo(0, initialPosY, this.#service.gain);

    // Expose signal for external listeners
    this.onChangePan = this.#service.onChangePan;
  }

  /** Get root DOM element */
  getRoot() {
    return this.#view.getRoot();
  }

  /** Get pan area element */
  getPanArea() {
    return this.#view.getPanArea();
  }

  /** Enable pan editing */
  enable() {
    this.#service.enable();
    this.#view.enable();

    return true;
  }

  /** Disable pan editing */
  disable() {
    this.#service.disable();
    this.#view.disable();

    return true;
  }

  /** Check if enabled */
  isEnabled() {
    return this.#service.isEnabled();
  }

  /** Start setting pan value */
  setValueStart(posX, posY) {
    const { posX: x, posY: y, gain } = this.#service.setValueStart(posX, posY);

    this.#view.moveTo(x, y, gain, true);
    this.#view.showInfo();
  }

  /** Update pan value during drag */
  setValue(posX, posY) {
    const { posX: x, posY: y, gain } = this.#service.setValue(posX, posY);

    this.#view.moveTo(x, y, gain);

    return true;
  }

  /** End setting pan value */
  setValueEnd() {
    this.#service.setValueEnd();
    this.#view.hideInfo();
  }
}
