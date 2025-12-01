import Signals from 'signals';
import TimePopup from 'timePopup/TimePopup';
import { createElement } from 'utils/dom';
import { applyTransform3d, clamp } from 'utils/animation';

export default class Scrubber {
  constructor($parent) {
    this.$node = null;
    this.$scrubberHandle = null;

    this.duration = 0;
    this.width = 0;
    this.offset = 0;
    this.time = 0;
    this.posX = 0;
    this.scaleFactorX = 1;
    this.isScrolling = false;

    this.onMove = new Signals.Signal();

    this.render($parent);
  }

  init(duration) {
    this.duration = duration;
    this.time = 0;
    this._moveTo(0);
  }

  setIsScrolling(isScrolling) {
    this.isScrolling = isScrolling;

    return true;
  }

  resize() {
    this.width = this.$node.offsetWidth - 14;
    this.scaleFactorX = this.duration > 0 ? this.width / this.duration : 0;
    this.offset = this.$node.getBoundingClientRect().left;

    return true;
  }

  moveTo(time) {
    const posX = time * this.scaleFactorX;
    this._moveTo(posX);
    this.time = time;

    return true;
  }

  getTime() {
    return parseFloat(this.time);
  }

  _moveTo(posX) {
    posX = clamp(posX, 0, this.width);
    applyTransform3d(this.$scrubberHandle, posX, 0, 0);
    this.posX = posX;
  }

  render($parent) {
    let y = 0;

    const getMousePosX = e => {
      let posX = e.clientX - this.offset;
      posX = posX <= 0 ? 0 : posX;
      TimePopup.moveTo(posX + this.offset, y);
      TimePopup.update(posX / this.scaleFactorX);
      this._moveTo(posX);
    };

    const removeGetMousePosX = () => {
      const time = this.posX / this.scaleFactorX;
      this.moveTo(time);
      TimePopup.moveTo(-100, -100);
      this.onMove.dispatch(time);
      document.removeEventListener('mousemove', getMousePosX, false);
      document.removeEventListener('mouseup', removeGetMousePosX, false);
    };

    const move = e => {
      e.stopPropagation();
      e.preventDefault();
      const time = this.posX / this.scaleFactorX;
      y = this.$node.getBoundingClientRect().top;
      this.moveTo(time);
      this.onMove.dispatch(time);
      getMousePosX(e);
      document.addEventListener('mousemove', getMousePosX, false);
      document.addEventListener('mouseup', removeGetMousePosX, false);
    };

    this.$node = createElement('div', {
      className: 'scrubber-track flex-grow-1',
      parent: $parent
    });

    const $track = createElement('div', {
      className: 'scrubber-bar',
      listeners: { mousedown: move },
      parent: this.$node
    });

    this.$scrubberHandle = createElement('div', {
      className: 'scrubber-handle',
      listeners: { mousedown: move },
      parent: this.$node
    });
  }
}
