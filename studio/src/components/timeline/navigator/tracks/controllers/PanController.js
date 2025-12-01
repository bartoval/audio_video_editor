import PanView from '../views/PanView';
import PanService from '../services/PanService';

/**
 * PanController - Coordinates PanView and PanService
 * Acts as a facade, delegating to view and service
 */
export default class PanController {
  #view;
  #service;

  constructor(config, $parent, callbacks = {}) {
    const viewCallbacks = {
      onDragStart: (posX, posY) => {
        this.#service.setValueStart(posX, posY);
      },
      onDragMove: posY => {
        const { posX, posY: newPosY } = this.#service.setValue(0, posY);
        this.#view.moveTo(posX, newPosY);
      },
      onDragEnd: () => {
        this.#service.setValueEnd();
      }
    };

    this.#view = new PanView(config, $parent, viewCallbacks);
    this.#service = new PanService(config, this.#view.getMaxPosY(), callbacks);

    const initialPosY = this.#service.getInitialPosY();
    this.#view.moveTo(0, initialPosY);
  }

  /** Get root DOM element */
  getRoot() {
    return this.#view.getRoot();
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

  /** Update pan from external value (-1 to 1) */
  updateFromValue(pan) {
    this.#service.gain = pan;
    const posY = this.#service.getInitialPosY();
    this.#view.moveTo(0, posY);
  }
}
