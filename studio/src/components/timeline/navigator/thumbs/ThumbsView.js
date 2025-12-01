import { View, getScale, getPosXFromTime } from '../../../../lib';
import { getThumbsUrl } from '../../../../services/workspace';
import { THUMBS } from '../../../../config/ui';
import ThumbPreview from './ThumbPreview';

/** Thumbs timeline view with strip image and preview */
export default class ThumbsView extends View {
  #$container = null;
  #$image = null;
  #preview = null;
  #posX = 0;
  #duration = 0;

  constructor($parent) {
    super($parent);
    this.mount();
  }

  template() {
    return `
      <div class="thumbs">
        <ul class="list-unstyled">
          <li class="thumb">
            <img class="img" draggable="false" loading="lazy" decoding="async">
          </li>
        </ul>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.#$container = wrapper.firstElementChild;
    this.$parent.appendChild(this.#$container);

    this.$node = this.#$container.querySelector('ul');
    this.#$image = this.#$container.querySelector('img');
  }

  onMount() {
    this.#$container.addEventListener('mousemove', this.#handleMouseMove);
    this.#$container.addEventListener('mouseleave', this.#handleMouseLeave);
  }

  init(duration) {
    // Reset state for new video
    this.#posX = 0;
    this.$node.style.transform = 'translate3d(0, 0, 0)';

    this.#duration = duration;
    this.#preview = new ThumbPreview(duration);
    this.#$image.src = getThumbsUrl(`${getScale()}${THUMBS.EXTENSION}`);
    this.#redraw(getPosXFromTime(duration));

    return true;
  }

  zoom(width, posX) {
    this.#$image.src = getThumbsUrl(`${getScale()}${THUMBS.EXTENSION}`);
    this.#moveTo(posX);
    this.#redraw(width);

    return true;
  }

  moveTo(posX) {
    this.#moveTo(posX);

    return true;
  }

  updateFrame(posX) {
    this.#moveTo(posX);

    return true;
  }

  // ============================================================================
  // Private
  // ============================================================================

  #redraw(width) {
    this.$node.style.width = width + 'px';
    this.$node.classList.remove('hide');
  }

  #moveTo(posX) {
    const t = `translate3d(${-posX}px, 0, 0)`;
    this.$node.style.transform = t;
    this.#posX = parseFloat(posX);

    return true;
  }

  #handleMouseMove = e => {
    const rect = this.#$container.getBoundingClientRect();
    this.#preview?.show(e, rect, this.#posX);
  };

  #handleMouseLeave = () => {
    this.#preview?.hide();
  };
}
