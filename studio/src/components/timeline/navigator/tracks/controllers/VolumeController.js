import VolumeView from '../views/VolumeView';
import VolumeService from '../services/VolumeService';

/**
 * VolumeController - Coordinates VolumeView and VolumeService
 * Acts as a facade, delegating to view and service
 */
export default class VolumeController {
  #view;
  #service;

  constructor(config, $parent) {
    this.#view = new VolumeView(config, $parent);
    this.#service = new VolumeService(config, this.#view.getMaxPosX(), this.#view.getMaxValue());

    // Initial render
    this.#redraw();
    this.#view.moveTo(0, this.#view.getMaxValue() / 2);

    // Expose signal for external listeners
    this.onChangeVolume = this.#service.onChangeVolume;
  }

  /** Get root DOM element */
  getRoot() {
    return this.#view.getRoot();
  }

  /** Get volume SVG area */
  getVolumeArea() {
    return this.#view.getVolumeArea();
  }

  /** Resize volume envelope and redraw */
  resize(width) {
    this.#service.resize(width);
    // Force immediate redraw to update the visual representation
    this.#view.updatePath(this.#service.buildPathData());

    return true;
  }

  /** Enable volume editing */
  enable() {
    this.#service.enable();
    this.#view.enable();
    // Force immediate redraw (not RAF throttled)
    this.#view.updatePath(this.#service.buildPathData());

    return true;
  }

  /** Disable volume editing */
  disable() {
    this.#service.disable();
    this.#view.disable();

    return true;
  }

  /** Check if enabled */
  isEnabled() {
    return this.#service.isEnabled();
  }

  /** Start drawing volume envelope */
  drawStart(posX, posY) {
    const { posX: x, posY: y } = this.#service.drawStart(posX, posY);

    this.#redraw();
    // x is already in track coordinates (returned by service after scale conversion)
    this.#view.moveTo(x, y, false);
    this.#view.showInfo();

    return true;
  }

  /** Continue drawing */
  draw(posX, posY) {
    const { posX: x, posY: y } = this.#service.draw(posX, posY);

    this.#redraw();
    // x is already in track coordinates (returned by service after scale conversion)
    this.#view.moveTo(x, y);
  }

  /** End drawing */
  drawEnd() {
    this.#service.drawEnd();
    this.#view.hideInfo();

    return true;
  }

  /** Get paths for serialization */
  getPaths() {
    return this.#service.getPaths();
  }

  /** Request redraw with RAF throttling */
  #redraw() {
    this.#service.requestRedraw(pathData => {
      this.#view.updatePath(pathData);
    });
  }
}
