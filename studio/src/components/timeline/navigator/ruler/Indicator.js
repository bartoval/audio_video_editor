import Component from 'Component';
import Signals from 'signals';
import Config from 'Config';
import { applyTransform3d } from 'utils/animation';

export default class Indicator {
  constructor(rulerToBeDecorated) {
    this.$node = null;
    this.$scrubberContainer = null;
    this.$scrubberButton = null;
    this.$scrubberLine = null;
    this.$scrubberTimer = null;
    this.$scrubberTime = null;
    this.$scrubberTimeCanvas = null;

    this.posX = 0;
    this.isScrolling = false;
    this.validLeft = null;
    this.validRight = null;
    this.rulerWithIndicator = rulerToBeDecorated;
    this.animation = false;
    this.isPlaying = false;

    this.onMove = new Signals.Signal();
    this.onStart = new Signals.Signal();
    this.onStop = new Signals.Signal();
  }

  init(duration) {
    const scaleList = this.rulerWithIndicator.init(duration);
    const range = this.rulerWithIndicator.getRange();
    this.validLeft = range.left;
    this.validRight = range.right;
    this._redraw();
    this._moveTo(0);

    return scaleList;
  }

  resize() {
    this._redraw();
  }

  zoom(scaleIndex) {
    this.rulerWithIndicator.resize(scaleIndex, true);
    this._redraw();
    const range = this.rulerWithIndicator.getRange();
    this.validLeft = range.left;
    this.validRight = range.right;

    return true;
  }

  getRange() {
    return this.rulerWithIndicator.getRange();
  }

  getMaxWidth() {
    return this.rulerWithIndicator.getMaxWidth();
  }

  getDuration() {
    return this.rulerWithIndicator.getDuration();
  }

  getPosX() {
    return this.rulerWithIndicator.getPosX();
  }

  getAbsolutePosX() {
    return parseFloat(this.posX + this.rulerWithIndicator.getPosX());
  }

  moveTo(posX, moveAll = true) {
    if (isNaN(posX) || posX < 0) {
      throw new Error('wrong input: posX is ' + posX);
    }

    this.isPlaying = false;
    this.animation = Math.abs(posX - this.posX) > 30;

    if (moveAll) {
      this.rulerWithIndicator.moveTo(posX - (this.posX - this.validLeft));
    }

    this._moveTo(posX);
    this.animation = false;

    return true;
  }

  updateFrame(posX) {
    this.animation = false;
    this.isPlaying = true;
    let isMoved = false;
    const leftLimit = this.validLeft;
    const rightLimit = this.validRight;

    if (this.posX - leftLimit <= 1 && this.posX - leftLimit >= -1 && posX <= rightLimit) {
      isMoved = this.rulerWithIndicator.updateFrame(Component.getFrames().preciseFrame);
    } else {
      const leftPosX = this.rulerWithIndicator.getPosX();

      if (this.posX - leftLimit > 0 && this.rulerWithIndicator.getMaxWidth() - this.rulerWithIndicator.getWidth() > 0) {
        this.rulerWithIndicator.updateFrame(Component.getFrames().frame);
      }

      isMoved = this._moveTo(this.posX + leftPosX + Component.getFrames().preciseFrame);
    }

    return isMoved;
  }

  _redraw() {
    const maxWidth = this.rulerWithIndicator.getMaxWidth();
    this.$node.setAttribute('max', maxWidth);
    this.$node.style.width = maxWidth + Config.getMargin() + 'px';
    this.$node.querySelector('.line').style.height = document.querySelector('.timeline').offsetHeight - 50 + 'px';
  }

  _moveTo(posX) {
    posX = posX - this.rulerWithIndicator.getPosX();
    const max = this.$node.getAttribute('max');
    posX = max < posX ? max : posX;

    applyTransform3d(this.$scrubberButton, posX, 0, 0);
    applyTransform3d(this.$scrubberLine, posX, 0, 0);
    applyTransform3d(this.$scrubberTimer, posX, 0, 0);

    this.posX = parseFloat(posX);

    return true;
  }

  render($parent) {
    const parentLeft = $parent.offsetLeft + Config.getSliderThumbWidth() / 2;

    const updateTimer = posX => {
      const ctx = this.$scrubberTimeCanvas.getContext('2d');
      ctx.clearRect(0, 0, this.$scrubberTimeCanvas.width, this.$scrubberTimeCanvas.height);
      ctx.fillText(Component.getTimeFormatted(Component.getTimeFromPosX(posX)), 0, this.$scrubberTimeCanvas.height - 3);

      return true;
    };

    const showTimer = () => {
      this.$scrubberTimer.classList.remove('hide-with-animation');

      return true;
    };

    const hideTimer = () => {
      this.$scrubberTimer.classList.add('hide-with-animation');

      return true;
    };

    const scrollTo = posX => {
      const width = this.rulerWithIndicator.getWidth();

      const scroll = () => {
        if (this.isScrolling === true && posX > 0 && posX < this.validRight + this.validLeft && Math.round(this.posX) % width === 0) {
          window.requestAnimationFrame(scroll);

          if (Math.round(this.posX) - width === 0) {
            this.rulerWithIndicator.updateFrame(3);
            posX = this.rulerWithIndicator.getPosX() + width;
          } else {
            this.rulerWithIndicator.updateFrame(-3);
            posX = this.rulerWithIndicator.getPosX();
          }

          this.posX = posX - this.rulerWithIndicator.getPosX();
          this.onMove.dispatch(Component.getTimeFromPosX(posX));
          updateTimer(posX);
        }

        this._moveTo(posX);
      };

      window.requestAnimationFrame(scroll);
    };

    const getMousePosX = e => {
      let posRel = e.clientX - parentLeft;
      const leftPosX = this.rulerWithIndicator.getPosX();
      const maxWidth = this.rulerWithIndicator.getWidth();
      posRel = posRel <= 0 ? 0 : posRel;
      posRel = posRel >= maxWidth ? maxWidth : posRel;
      let posX = posRel + leftPosX;

      if (this.isScrolling === false && posRel % maxWidth === 0) {
        this.isScrolling = true;
        this.posX = posX - this.rulerWithIndicator.getPosX();
        scrollTo(posX);
      } else {
        if (this.posX % maxWidth !== 0) {
          this.isScrolling = false;
        }

        this._moveTo(posX);
      }

      posX = this.$node.getAttribute('max') < posX ? this.$node.getAttribute('max') : posX;
      updateTimer(posX);
    };

    const removeGetMousePosX = e => {
      document.removeEventListener('mousemove', getMousePosX, false);
      document.removeEventListener('mouseup', removeGetMousePosX, false);
      let posRel = e.clientX - parentLeft;
      const leftPosX = this.rulerWithIndicator.getPosX();
      const maxWidth = this.rulerWithIndicator.getWidth();
      posRel = posRel <= 0 ? 0 : posRel;
      posRel = posRel >= maxWidth ? maxWidth : posRel;
      const posX = posRel + leftPosX;
      this.isScrolling = false;
      this.onMove.dispatch(Component.getTimeFromPosX(posX));

      if (this.isPlaying) {
        this.onStart.dispatch();
      }

      hideTimer();
    };

    const startGetMousePosX = e => {
      e.preventDefault();
      e.stopPropagation();
      this.onStop.dispatch();
      getMousePosX(e);
      document.addEventListener('mousemove', getMousePosX, false);
      document.addEventListener('mouseup', removeGetMousePosX, false);
      showTimer();
    };

    const listeners = {
      contextmenu: e => {
        e.preventDefault();

        return false;
      },
      mousedown: startGetMousePosX
    };

    this.$node = Component.render($parent, 'div', [{ class: 'progress-bar-container' }]);
    this.$scrubberContainer = Component.render(this.$node, 'div', [{ class: 'scrubber-container' }]);
    this.$scrubberTimer = Component.render(this.$scrubberContainer, 'div', [{ class: 'scrubber-time hide-with-animation' }]);
    Component.render(this.$scrubberTimer, 'div', [{ class: 'arrow-down' }]);
    this.$scrubberTime = Component.render(this.$scrubberTimer, 'div', [{ class: 'body' }]);
    this.$scrubberTimeCanvas = Component.render(this.$scrubberTime, 'canvas', [{ class: 'time-canvas', height: 16, width: 100 }], {});
    this.$scrubberTimeCanvas.getContext('2d').fillStyle = 'black';
    this.$scrubberTimeCanvas.getContext('2d').font = 'normal normal 12px Roboto';
    this.$scrubberButton = Component.render(this.$scrubberContainer, 'div', [{ class: 'scrubber-button' }], listeners);
    this.$scrubberLine = Component.render(this.$scrubberContainer, 'div', [{ class: 'line' }]);
    this.rulerWithIndicator.render($parent);
  }
}
