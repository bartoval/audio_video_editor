import { TRACKS } from '../../../../../config/constants';
import {
  applyTransform3d,
  setTransition,
  clamp,
  show,
  hide,
  View,
  getRelativePos
} from '../../../../../lib';

const { ENVELOPE_HEIGHT_PERCENT } = TRACKS;

/**
 * PanView - Handles DOM rendering for pan control
 * Pure view component, no business logic
 */
export default class PanView extends View {
  #currentPosY = 0;
  #currentLabel = 'C';
  #isDragging = false;
  #lastMouseX = 0;
  #callbacks = {};

  constructor(config, $parent, callbacks = {}) {
    super($parent);
    this.id = config.id;
    this.$panContainer = null;
    this.$refLine = null;
    this.$tooltip = null;

    this.#callbacks = callbacks;

    this.maxPosY = ~~(($parent.offsetHeight * ENVELOPE_HEIGHT_PERCENT) / 100);
    this.#currentPosY = this.maxPosY / 2;

    this.mount();
  }

  template() {
    return `
      <div class="pan-zone hide" data-zone-id="${this.id}">
        <div class="pan-area" data-zone-id="${this.id}"></div>
        <div class="pan-ref-line"></div>
        <div class="pan-line-container">
          <div class="pan-line-hit"></div>
          <div class="pan-line"></div>
        </div>
        <div class="pan-container"></div>
        <div class="glass-tooltip pan-tooltip"></div>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);

    this.$panLineContainer = this.$node.querySelector('.pan-line-container');
    this.$panContainer = this.$node.querySelector('.pan-container');
    this.$refLine = this.$node.querySelector('.pan-ref-line');
    this.$tooltip = this.$node.querySelector('.pan-tooltip');
  }

  onMount() {
    this.$node.addEventListener('contextmenu', this.#handleContextMenu);
    this.$node.addEventListener('mousemove', this.#handleMouseMove);
    this.$node.addEventListener('mouseleave', this.#handleMouseLeave);
    this.$panLineContainer.addEventListener('mousedown', this.#handleLineMouseDown);
  }

  #handleLineMouseDown = event => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const { x: posX, y: posY } = getRelativePos(event, this.$node);

    this.#isDragging = true;
    this.#callbacks.onDragStart?.(posX, posY);

    document.addEventListener('mousemove', this.#handleDragMove);
    document.addEventListener('mouseup', this.#handleDragEnd);
  };

  #handleDragMove = event => {
    const { y: posY } = getRelativePos(event, this.$node);

    this.#callbacks.onDragMove?.(posY);
  };

  #handleDragEnd = () => {
    this.#isDragging = false;
    document.removeEventListener('mousemove', this.#handleDragMove);
    document.removeEventListener('mouseup', this.#handleDragEnd);

    this.#callbacks.onDragEnd?.();
  };

  #handleMouseMove = event => {
    const { x: posX, y: posY } = getRelativePos(event, this.$node);
    const clampedY = clamp(posY, 0, this.maxPosY);

    this.#lastMouseX = posX;

    if (this.#isDragging) {
      this.#showTooltipAt(posX, this.#currentPosY, this.#currentLabel);

      return;
    }

    this.$refLine.style.display = 'block';
    this.$refLine.style.top = `${clampedY}px`;

    const label = this.#calcPanLabel(clampedY);
    this.#showTooltipAt(posX, clampedY, label);
  };

  #handleMouseLeave = () => {
    this.$refLine.style.display = 'none';

    if (!this.#isDragging) {
      this.$tooltip.style.display = 'none';
    }
  };

  #showTooltipAt(posX, posY, label) {
    if (label === 'C') {
      this.$tooltip.style.display = 'none';

      return;
    }

    this.$tooltip.textContent = label;
    this.$tooltip.style.left = `${posX}px`;
    this.$tooltip.style.top = `${posY}px`;
    this.$tooltip.style.display = 'block';
  }

  #calcPanLabel(posY) {
    const normalizedY = posY / this.maxPosY;
    const panPercent = Math.round((0.5 - normalizedY) * 200);

    return panPercent === 0 ? 'C' : panPercent > 0 ? `L${panPercent}` : `R${Math.abs(panPercent)}`;
  }

  #handleContextMenu = event => {
    event.preventDefault();

    return false;
  };

  getMaxPosY() {
    return this.maxPosY;
  }

  /** Enable pan editing */
  enable() {
    show(this.$node, 'hide');
    this.$tooltip.style.display = 'none';
  }

  /** Disable pan editing */
  disable() {
    hide(this.$node, 'hide');
  }

  /** Move pan indicator to position */
  moveTo(posX, posY, animated = false) {
    if (isNaN(posY)) {
      throw new Error('Position is not a number');
    }

    setTransition(this.$panContainer, animated);
    setTransition(this.$panLineContainer, animated);

    applyTransform3d(this.$panContainer, posX, posY, 0);
    applyTransform3d(this.$panLineContainer, 0, posY, 0);

    this.#currentPosY = posY;
    this.#currentLabel = this.#calcPanLabel(posY);
    this.#showTooltipAt(this.#lastMouseX, posY, this.#currentLabel);

    return true;
  }
}
