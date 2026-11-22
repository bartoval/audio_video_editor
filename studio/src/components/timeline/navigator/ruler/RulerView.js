import { CANVAS_UP_BOUND, MARGIN } from '../../../../config/ui';
import { applyTransform3d, View, getPosXFromTime, getNavigatorX } from '../../../../lib';
import { getDefaultScale, getScales } from '../../../../services/ConfigStore';
import scaleManager from '../../../../services/ScaleManager';

/** SVG ruler rendering and scroll handling */
const LABEL_SPACING_PX = 100;

/**
 * Ruler label for a time. When labels are less than a second apart (deep zoom),
 * show hundredths, otherwise neighbouring labels would all read the same second.
 * @param {number} time - seconds
 * @param {number} step - seconds between two labels
 * @returns {string} mm:ss or mm:ss.cc
 */
export function formatRulerLabel(time, step) {
  const pad = n => String(n).padStart(2, '0');

  // Before the scale is known (NaN), keep showing 00:00 as before
  if (!Number.isFinite(time)) {
    time = 0;
  }

  if (!(step < 1)) {
    const totalSeconds = Math.floor(time);

    return `${pad(Math.floor(totalSeconds / 60))}:${pad(totalSeconds % 60)}`;
  }

  // Round once, on the whole time, so 59.996 s becomes 01:00.00 and not 00:60.00
  const totalHundredths = Math.round(time * 100);
  const totalSeconds = Math.floor(totalHundredths / 100);

  return `${pad(Math.floor(totalSeconds / 60))}:${pad(totalSeconds % 60)}.${pad(totalHundredths % 100)}`;
}

export default class RulerView extends View {
  #$svgContainer = null;
  #$svg = null;
  #$loopRegion = null;
  #$navigatorEl = null;
  #duration = 0;
  #maxWidth = CANVAS_UP_BOUND * 5;
  #scaleList = [];
  #scale = null;
  #posX = 0;
  #margin = MARGIN;
  #loopBounds = null;
  #onClick = null;

  constructor($parent, callbacks = {}) {
    super($parent);
    this.#onClick = callbacks.onClick || null;
    this.mount();
  }

  render() {
    this.$node = document.createElement('div');
    this.$node.className = 'ruler';
    this.$node.dataset.testid = 'ruler';

    this.#$svgContainer = document.createElement('div');
    this.#$svgContainer.id = 'rulerDiv';
    this.#$svgContainer.className = 'rulerDiv';

    this.#$svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.#$svg.id = 'rulerImg';
    this.#$svg.classList.add('rulerImg');

    this.#$loopRegion = document.createElement('div');
    this.#$loopRegion.className = 'loop-region';

    this.#$svgContainer.appendChild(this.#$svg);
    this.#$svgContainer.appendChild(this.#$loopRegion);
    this.$node.appendChild(this.#$svgContainer);
    this.$parent.appendChild(this.$node);
  }

  onMount() {
    this.#$navigatorEl = this.$parent.closest('.navigator');
    this.$node.addEventListener('click', this.#handleClick);
  }

  init(duration) {
    const availableScales = getScales();

    if (!availableScales) {
      throw new Error('Scales not available from backend');
    }

    this.#duration = duration;
    const viewportWidth = this.$node.offsetWidth;

    scaleManager.init({
      duration,
      availableScales,
      maxWidth: this.#maxWidth,
      viewportWidth
    });

    this.#scaleList = scaleManager.getScaleList();
    const defaultIndex = this.#getDefaultZoomIndex();
    const initialScale = this.#scaleList[defaultIndex];

    scaleManager.setInitialScale(initialScale);
    this.resize(defaultIndex);
    this.#moveTo(0);

    return { scaleList: this.#scaleList, initialZoom: defaultIndex };
  }

  /** Initialize as minimap ruler (fixed scale to show entire timeline) */
  initMinimap(duration) {
    this.#duration = duration;

    const width = this.$node.offsetWidth;
    const scale = duration / width;

    this.#scale = scale;
    this.#redraw(width, scale);
  }

  #getDefaultZoomIndex() {
    const defaultScale = parseFloat(getDefaultScale());
    const index = this.#scaleList.findIndex(scale => scale === defaultScale);

    if (index >= 0) {
      return index;
    }

    if (this.#scaleList.length === 0) {
      const limits = scaleManager.getLimits();

      throw new Error(
        '[RulerView] Empty scaleList. Limits: min=' + limits.min + ', max=' + limits.max
      );
    }

    return 0;
  }

  resize(scaleIndex) {
    if (isNaN(scaleIndex) || scaleIndex < 0 || scaleIndex > this.#scaleList.length - 1) {
      throw new Error('wrong scale index: ' + scaleIndex);
    }

    const scale = this.#scaleList[scaleIndex];

    return this.resizeContinuous(scale);
  }

  resizeContinuous(scale) {
    if (!this.#duration || this.#duration <= 0) {
      return this.#scale;
    }

    const clampedScale = scaleManager.setScale(scale);
    const width = this.#duration / clampedScale;

    this.#scale = clampedScale;
    this.#redraw(width, clampedScale);
    this.#moveTo(this.#posX);
    this.#updateLoopRegion();

    return parseFloat(this.#scale);
  }

  moveTo(posX) {
    if (isNaN(posX)) {
      throw new Error('Position is not a number');
    }

    const viewportWidth = this.$node.offsetWidth;
    const svgWidth = parseFloat(this.#$svg.getAttribute('width'));
    const firstHalf = viewportWidth / 2;
    const lastHalf = svgWidth - firstHalf - this.#margin;
    let realPosX = posX - firstHalf;

    if (realPosX < 0) {
      realPosX = 0;
    } else if (posX > lastHalf && svgWidth - viewportWidth > 0) {
      realPosX = lastHalf - firstHalf;
    }

    return this.#moveTo(realPosX);
  }

  updateFrame(posX) {
    const rulerPosX = this.getPosX();

    return this.#moveTo(rulerPosX + posX);
  }

  getPosX() {
    return parseFloat(this.#posX);
  }

  getWidth() {
    return this.$node.offsetWidth;
  }

  getMaxWidth() {
    return this.#$svg.getAttribute('width') - this.#margin;
  }

  getDuration() {
    return this.#duration;
  }

  setDuration(duration) {
    this.#duration = duration;
    const width = duration / this.#scale;
    this.#redraw(width, this.#scale);
    this.#updateLoopRegion();
  }

  getRange() {
    const width = this.getWidth();
    const left = width / 2;
    const realWidth = this.#$svg.getAttribute('width');
    const right = realWidth - left - this.#margin;

    return { left, right, width };
  }

  showLoopRegion(startTime, endTime) {
    this.#loopBounds = { start: startTime, end: endTime };
    this.#updateLoopRegion();
    this.#$loopRegion.classList.add('visible');
  }

  hideLoopRegion() {
    this.#loopBounds = null;
    this.#$loopRegion.classList.remove('visible');
  }

  #updateLoopRegion() {
    if (!this.#loopBounds) {
      return;
    }

    const startPosX = getPosXFromTime(this.#loopBounds.start);
    const endPosX = getPosXFromTime(this.#loopBounds.end);
    const width = endPosX - startPosX;

    this.#$loopRegion.style.left = `${startPosX}px`;
    this.#$loopRegion.style.width = `${width}px`;
  }

  #moveTo(posX) {
    const leftMargin = this.#margin;
    const svgWidth = parseFloat(this.#$svg.getAttribute('width'));
    const currentWidth = this.$node.offsetWidth;
    const maxPosXRuler = svgWidth - currentWidth;

    posX = posX < 0 ? 0 : posX;

    if (maxPosXRuler > 0 && posX > maxPosXRuler - leftMargin) {
      posX = maxPosXRuler - leftMargin;
    }

    applyTransform3d(this.#$svgContainer, -posX, 0, 0);
    this.#posX = posX;

    return true;
  }

  #redraw(width, scale) {
    const $node = this.#$svg;
    const height = this.$node.offsetHeight;

    this.#updateDraw($node, width, scale, height);
  }

  #updateDraw($node, width, scale, height) {
    $node.innerHTML = '';
    $node.setAttributeNS(null, 'width', width + 6);
    $node.setAttributeNS(null, 'height', height);

    const labelStep = LABEL_SPACING_PX * scale;

    for (let x = 0; x <= width + 10; x += LABEL_SPACING_PX) {
      const t = formatRulerLabel(x * scale, labelStep);

      const newLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      newLine.setAttributeNS(null, 'x1', x);
      newLine.setAttributeNS(null, 'y1', 0);
      newLine.setAttributeNS(null, 'x2', x);
      newLine.setAttributeNS(null, 'y2', 10);

      const newText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      newText.textContent = t;
      newText.setAttributeNS(null, 'id', 'rulerImgText' + x);
      newText.setAttributeNS(null, 'y', 20);

      for (let xx = 10; xx !== 100; xx += 10) {
        const newLine2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        newLine2.setAttributeNS(null, 'x1', x + xx);
        newLine2.setAttributeNS(null, 'y1', 0);
        newLine2.setAttributeNS(null, 'x2', x + xx);
        newLine2.setAttributeNS(null, 'y2', 5);
        $node.appendChild(newLine2);
      }

      $node.appendChild(newLine);
      $node.appendChild(newText);

      const textWidth = newText.getBBox().width;
      const textPos = x < 100 ? x : x >= width ? x - ~~textWidth : x - ~~textWidth / 2;
      newText.setAttributeNS(null, 'x', textPos);
    }
  }

  #handleClick = event => {
    if (!this.#onClick || !this.#$navigatorEl) {
      return;
    }

    event.stopPropagation();

    const clickX = getNavigatorX(event, this.#$navigatorEl);
    const posX = clickX + this.#posX;

    this.#onClick(posX);
  };

  onDestroy() {
    this.$node?.removeEventListener('click', this.#handleClick);
    scaleManager.reset();
    super.onDestroy();
  }
}
