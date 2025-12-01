import { drawTimeOnCanvas, getTimeFromPosX, View } from '../../../../lib';

/** Time tooltip popup shown during scrubbing */
export default class TimeTooltip extends View {
  #$canvas = null;

  constructor($parent) {
    super($parent);
    this.mount();
  }

  template() {
    return `
      <div class="scrubber-time hide-with-animation">
        <div class="arrow-down"></div>
        <div class="body">
          <canvas class="time-canvas" width="100" height="16"></canvas>
        </div>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);

    this.#$canvas = this.$node.querySelector('canvas');
    this.#$canvas.getContext('2d').fillStyle = 'black';
    this.#$canvas.getContext('2d').font = 'normal normal 12px Roboto';
  }

  show(posX) {
    drawTimeOnCanvas(this.#$canvas, getTimeFromPosX(posX));
    this.$node.classList.remove('hide-with-animation');
  }

  hide() {
    this.$node.classList.add('hide-with-animation');
  }

  setPosition(posX) {
    this.$node.style.transform = `translate3d(${posX}px, 0, 0)`;
  }

  getElement() {
    return this.$node;
  }
}
