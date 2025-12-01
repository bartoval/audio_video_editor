import { Signals, applyTransform3d, clamp, drawTimeOnCanvas, View } from '../../lib';

export default class Scrubber extends View {
  #$scrubberBar = null;
  #$scrubberHandle = null;
  #$timePopup = null;
  #$canvas = null;
  #duration = 0;
  #width = 0;
  #handleSize = 0;
  #offset = 0;
  #time = 0;
  #posX = 0;
  #scaleFactorX = 1;
  #isScrolling = false;
  #isScrubbing = false;
  #dragY = 0;

  onMove = new Signals.Signal();

  constructor($parent) {
    super($parent);
    this.mount();
  }

  template() {
    return `
      <div class="scrubber-track flex-grow-1">
        <div data-ref="bar" class="scrubber-bar"></div>
        <div data-ref="handle" class="scrubber-handle"></div>
      </div>
    `;
  }

  popupTemplate() {
    return `
      <div class="scrubber-time">
        <div class="arrow-down"></div>
        <div class="body">
          <canvas data-ref="canvas" class="time-canvas" width="120" height="20"></canvas>
        </div>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);

    this.#$scrubberBar = this.$node.querySelector('[data-ref="bar"]');
    this.#$scrubberHandle = this.$node.querySelector('[data-ref="handle"]');

    // Time popup (positioned globally)
    const popupWrapper = document.createElement('div');
    popupWrapper.innerHTML = this.popupTemplate();
    this.#$timePopup = popupWrapper.firstElementChild;
    document.querySelector('.studio').appendChild(this.#$timePopup);

    this.#$canvas = this.#$timePopup.querySelector('[data-ref="canvas"]');
    this.#$canvas.getContext('2d').fillStyle = 'white';
    this.#$canvas.getContext('2d').font = 'normal normal 16px Roboto';

    this.#hidePopup();
  }

  onMount() {
    this.$node.addEventListener('mousedown', this.#handleMouseDown);
    this.$node.addEventListener('mousemove', this.#handleHoverMove);
    this.$node.addEventListener('mouseleave', this.#handleHoverLeave);
  }

  #showPopup = (posX, posY) => {
    // Position tooltip above the scrubber track, centered on cursor (60px width / 2 = 30)
    applyTransform3d(this.#$timePopup, posX - 30, posY - 32, 0);
  };

  #hidePopup = () => {
    applyTransform3d(this.#$timePopup, -100, -100, 0);
  };

  #handleHoverMove = e => {
    const posX = clamp(e.clientX - this.#offset, 0, this.#width);
    const hoverTime = posX / this.#scaleFactorX;
    const topY = this.$node.getBoundingClientRect().top;
    this.#showPopup(e.clientX, topY);
    drawTimeOnCanvas(this.#$canvas, hoverTime);
  };

  #handleHoverLeave = () => {
    this.#hidePopup();
  };

  #handleMouseDown = e => {
    e.stopPropagation();
    e.preventDefault();
    this.#isScrubbing = true;
    // Recalculate dimensions on mousedown to ensure accuracy
    this.#width = this.#$scrubberBar.offsetWidth;
    this.#handleSize = this.#$scrubberHandle.offsetWidth;
    this.#scaleFactorX = this.#duration > 0 ? this.#width / this.#duration : 0;
    this.#offset = this.#$scrubberBar.getBoundingClientRect().left;
    this.#dragY = this.$node.getBoundingClientRect().top;
    this.#handleMouseMove(e);
    document.addEventListener('mousemove', this.#handleMouseMove, false);
    document.addEventListener('mouseup', this.#handleMouseUp, false);
  };

  #handleMouseMove = e => {
    let posX = e.clientX - this.#offset;
    posX = clamp(posX, 0, this.#width);
    this.#showPopup(posX + this.#offset, this.#dragY);
    drawTimeOnCanvas(this.#$canvas, posX / this.#scaleFactorX);
    this.#moveTo(posX);
  };

  #handleMouseUp = () => {
    this.#isScrubbing = false;
    const time = this.#posX / this.#scaleFactorX;
    this.moveTo(time);
    this.#hidePopup();
    this.onMove.dispatch(time);
    document.removeEventListener('mousemove', this.#handleMouseMove, false);
    document.removeEventListener('mouseup', this.#handleMouseUp, false);
  };

  init(duration) {
    this.#duration = duration;
    this.#time = 0;
    this.#moveTo(0);
  }

  setIsScrolling(isScrolling) {
    this.#isScrolling = isScrolling;

    return true;
  }

  resize() {
    this.#width = this.#$scrubberBar.offsetWidth;
    this.#handleSize = this.#$scrubberHandle.offsetWidth;
    this.#scaleFactorX = this.#duration > 0 ? this.#width / this.#duration : 0;
    this.#offset = this.#$scrubberBar.getBoundingClientRect().left;

    return true;
  }

  moveTo(time) {
    if (this.#isScrubbing) {
      return false;
    }

    const posX = time * this.#scaleFactorX;
    this.#moveTo(posX);
    this.#time = time;

    return true;
  }

  getTime() {
    return parseFloat(this.#time);
  }

  #moveTo(posX) {
    posX = clamp(posX, 0, this.#width);
    const handlePos = this.#width > 0 ? (posX / this.#width) * (this.#width - this.#handleSize) : 0;
    applyTransform3d(this.#$scrubberHandle, handlePos, 0, 0);
    this.#posX = posX;
  }
}
