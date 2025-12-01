import { TRACKS } from '../../../../../constants';
import {
  applyTransform3d,
  setTransition,
  clamp,
  show,
  hide,
  setEnabled,
  View
} from '../../../../../lib';

const { ENVELOPE_HEIGHT_PERCENT } = TRACKS;

/**
 * VolumeView - Handles DOM rendering for volume envelope
 * Pure view component, no business logic
 */
export default class VolumeView extends View {
  constructor(config, $parent) {
    super($parent);
    this.id = config.id;
    this.$path = null;
    this.$volumeInfo = null;
    this.$volumeArea = null;
    this.$volumeContainer = null;

    this.maxPosX = $parent.offsetWidth;
    this.maxValue = ~~(($parent.offsetHeight * ENVELOPE_HEIGHT_PERCENT) / 100);
    this.animation = false;

    this.mount();
  }

  /** Create DOM */
  render() {
    const { maxValue, maxPosX } = this;

    // Main container
    this.$node = document.createElement('div');
    this.$node.className = 'volume-zone hide';
    this.$node.setAttribute('data-zone-id', this.id);
    this.$parent.appendChild(this.$node);

    // SVG area (must use createElementNS for SVG elements)
    this.$volumeArea = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.$volumeArea.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    this.$volumeArea.setAttribute('class', 'volume-area');
    this.$volumeArea.setAttribute('width', maxPosX);
    this.$volumeArea.setAttribute('viewBox', `0 0 ${maxPosX} ${maxValue}`);
    this.$volumeArea.setAttribute('preserveAspectRatio', 'none');
    this.$volumeArea.setAttribute('data-zone-id', this.id);
    this.$node.appendChild(this.$volumeArea);

    // Path element
    this.$path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.$path.setAttribute('class', 'volume-line');
    this.$path.setAttribute('d', '');
    this.$volumeArea.appendChild(this.$path);

    // Volume container and info
    this.$volumeContainer = document.createElement('div');
    this.$volumeContainer.className = 'volume-container';
    this.$node.appendChild(this.$volumeContainer);

    this.$volumeInfo = document.createElement('div');
    this.$volumeInfo.className = 'volume-info hide-animated';
    this.$volumeContainer.appendChild(this.$volumeInfo);
  }

  onMount() {
    this.$volumeArea.addEventListener('contextmenu', this.#handleContextMenu);
  }

  #handleContextMenu = e => {
    e.preventDefault();

    return false;
  };

  /** Get max position X */
  getMaxPosX() {
    return this.maxPosX;
  }

  /** Get max value (height) */
  getMaxValue() {
    return this.maxValue;
  }

  /** Get the SVG area element */
  getVolumeArea() {
    return this.$volumeArea;
  }

  /** Enable volume editing */
  enable() {
    show(this.$node, 'hide');
    setEnabled(this.$volumeArea, true);
  }

  /** Disable volume editing */
  disable() {
    hide(this.$node, 'hide');
    setEnabled(this.$volumeArea, false);
  }

  /** Show volume info tooltip */
  showInfo() {
    show(this.$volumeInfo);
  }

  /** Hide volume info tooltip */
  hideInfo() {
    hide(this.$volumeInfo);
  }

  /** Update the SVG path */
  updatePath(pathData) {
    this.$path.setAttribute('d', pathData);
  }

  /** Move the volume indicator to position */
  moveTo(posX, posY, animated = false) {
    if (isNaN(posY)) {
      throw new Error('Position is not a number');
    }

    const value = clamp(1 - posY / this.maxValue, 0, 1);

    setTransition(this.$volumeContainer, animated);
    applyTransform3d(this.$volumeContainer, posX, posY, 0);
    this.$volumeInfo.textContent = (value * 100).toFixed(0) + '%';
  }
}
