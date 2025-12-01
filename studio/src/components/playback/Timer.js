import { View } from '../../lib';

const getTimeFormatted = time => {
  let sec = ~~time % 60;
  let min = ~~(time / 60) % 60;
  let ms = ~~(time * 100) % 100;

  sec = sec < 10 ? '0' + sec.toFixed(0) : sec.toFixed(0);
  min = min < 10 ? '0' + min.toFixed(0) : min.toFixed(0);
  ms = ms < 10 ? '0' + ms.toFixed(0) : ms.toFixed(0);

  return min + ':' + sec + '.' + ms;
};

export default class Timer extends View {
  #$time = null;
  #$duration = null;
  #$displayRatio = null;
  #duration = 0;
  #displayRatio = '';
  #lastTimeFormatted = '';

  constructor($parent) {
    super($parent);
    this.mount();
  }

  template() {
    return `
      <div class="d-flex align-items-center">
        <span data-ref="ratio" class="badge text-bg-secondary fs-6 me-3"></span>
        <div class="d-flex align-items-center font-monospace">
          <span data-ref="time" class="text-body">00:00.00</span>
          <span data-ref="duration" class="text-body-tertiary ms-1">/ 00:00.00</span>
        </div>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);

    this.#$displayRatio = this.$node.querySelector('[data-ref="ratio"]');
    this.#$time = this.$node.querySelector('[data-ref="time"]');
    this.#$duration = this.$node.querySelector('[data-ref="duration"]');
  }

  init(duration, metaInfo) {
    this.#duration = duration;
    this.#displayRatio = metaInfo.displayAspectRatio;
    this.#$displayRatio.textContent = this.#displayRatio;
    this.#$time.textContent = getTimeFormatted(0);
    this.#$duration.textContent = '/ ' + getTimeFormatted(duration);

    return true;
  }

  update(time) {
    const formatted = getTimeFormatted(time);

    if (formatted === this.#lastTimeFormatted) {
      return false;
    }

    this.#lastTimeFormatted = formatted;
    this.#$time.textContent = formatted;

    return true;
  }
}
