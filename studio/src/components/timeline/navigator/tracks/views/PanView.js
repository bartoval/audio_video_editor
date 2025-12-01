import { TRACKS } from '../../../../../constants';
import { applyTransform3d, setTransition, show, hide, setEnabled, View } from '../../../../../lib';

const { ENVELOPE_HEIGHT_PERCENT } = TRACKS;

/**
 * PanView - Handles DOM rendering for pan control
 * Pure view component, no business logic
 */
export default class PanView extends View {
  constructor(config, $parent) {
    super($parent);
    this.id = config.id;
    this.$panLine = null;
    this.$panContainer = null;
    this.$panInfo = null;
    this.$panArea = null;

    this.maxPosY = ~~(($parent.offsetHeight * ENVELOPE_HEIGHT_PERCENT) / 100);

    this.mount();
  }

  template() {
    return `
      <div class="pan-zone hide" data-zone-id="${this.id}">
        <div class="pan-area" data-zone-id="${this.id}"></div>
        <div class="pan-line"></div>
        <div class="pan-container">
          <div class="pan-info hide-animated"></div>
        </div>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);

    this.$panArea = this.$node.querySelector('.pan-area');
    this.$panLine = this.$node.querySelector('.pan-line');
    this.$panContainer = this.$node.querySelector('.pan-container');
    this.$panInfo = this.$node.querySelector('.pan-info');
  }

  onMount() {
    this.$node.addEventListener('contextmenu', this.#handleContextMenu);
    this.$panInfo.addEventListener('contextmenu', this.#handleContextMenu);
  }

  #handleContextMenu = e => {
    e.preventDefault();

    return false;
  };

  /** Get max Y position */
  getMaxPosY() {
    return this.maxPosY;
  }

  /** Get the pan area element */
  getPanArea() {
    return this.$panArea;
  }

  /** Enable pan editing */
  enable() {
    show(this.$node, 'hide');
    setEnabled(this.$panArea, true);
  }

  /** Disable pan editing */
  disable() {
    hide(this.$node, 'hide');
    setEnabled(this.$panArea, false);
  }

  /** Show pan info tooltip */
  showInfo() {
    show(this.$panInfo);
  }

  /** Hide pan info tooltip */
  hideInfo() {
    hide(this.$panInfo);
  }

  /** Move pan indicator to position */
  moveTo(posX, posY, gain, animated = false) {
    if (isNaN(posY)) {
      throw new Error('Position is not a number');
    }

    setTransition(this.$panContainer, animated);
    setTransition(this.$panLine, animated);

    applyTransform3d(this.$panContainer, posX, posY, 0);
    applyTransform3d(this.$panLine, 0, posY, 0);

    this.$panInfo.innerText = (gain * 100).toFixed(0) + '%';

    return true;
  }
}
