import Component from 'Component';
import Signals from 'signals';
import { applyTransform3d, setTransition, clamp } from 'utils/animation';
import { show, hide, setEnabled } from 'utils/dom';

export default class ControllerPan {
  constructor(config, $parent) {
    this.$node = null;
    this.$panLine = null;
    this.$panContainer = null;
    this.$panInfo = null;
    this.$panArea = null;

    this.gain = config.panValue || 0;
    this.minPosY = 0;
    this.maxPosY = ~~($parent.offsetHeight * 70 / 100);
    this.posY = 0;
    this.posX = 0;
    this.enabled = false;
    this.isDragging = false;
    this.animation = false;

    this.render($parent, config.id);
    this.onChangePan = new Signals.Signal();
  }

  enable() {
    this.enabled = true;
    setEnabled(this.$panArea, true);

    return true;
  }

  disable() {
    this.enabled = false;
    setEnabled(this.$panArea, false);

    return true;
  }

  isEnabled() {
    return this.enabled;
  }

  setValueStart(posX, posY) {
    posY = clamp(posY, this.minPosY, this.maxPosY);
    this.gain = posY * 2 / this.maxPosY - 1;
    this.animation = true;
    this._moveTo(posX, posY);
    this.animation = false;
    this.isDragging = true;
    show(this.$panInfo);
  }

  setValue(posX, posY) {
    posY = clamp(posY, this.minPosY, this.maxPosY);
    this.gain = posY * 2 / this.maxPosY - 1;
    this._moveTo(posX, posY);

    return true;
  }

  setValueEnd() {
    this.isDragging = false;
    this.onChangePan.dispatch(this.gain);
    hide(this.$panInfo);
  }

  _moveTo(posX = 0, posY = this.maxPosY / 2) {
    if (isNaN(posY)) {
      throw new Error('Position is not a number');
    }

    setTransition(this.$panContainer, this.animation);
    setTransition(this.$panLine, this.animation);

    applyTransform3d(this.$panContainer, posX, posY, 0);
    applyTransform3d(this.$panLine, 0, posY, 0);

    this.$panInfo.innerText = (this.gain * 100).toFixed(0) + '%';
    this.posY = posY;
    this.posX = posX;

    return true;
  }

  render($parent, id) {
    const listeners = {
      contextmenu: e => {
        e.preventDefault();

        return false;
      }
    };

    this.$node = Component.render($parent, 'div', [{class: 'pan-zone hide', 'data-zone-id': id}], listeners);
    this.$panArea = Component.render(this.$node, 'div', [{class: 'pan-area', 'data-zone-id': id}]);
    this.$panLine = Component.render(this.$node, 'div', [{class: 'pan-line'}]);
    this.$panContainer = Component.render(this.$node, 'div', [{class: 'pan-container'}]);
    this.$panInfo = Component.render(this.$panContainer, 'div', [{class: 'pan-info hide-animated'}], listeners);

    this._moveTo(0, (this.gain + 1) / 2 * this.maxPosY);
  }
}
