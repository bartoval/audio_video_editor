import { CANVAS_UP_BOUND, MARGIN } from '../../../../config/ui';
import { getScaleMap, applyTransform3d, setScale, setScaleFactor, View } from '../../../../lib';

/** SVG ruler rendering and scroll handling */
export default class RulerView extends View {
  #$svgContainer = null;
  #$svg = null;
  #duration = 0;
  #maxWidth = CANVAS_UP_BOUND * 5;
  #zoomMap = getScaleMap();
  #scaleList = [];
  #scale = getScaleMap()[0];
  #posX = 0;
  #margin = MARGIN;
  #width = null;

  constructor($parent) {
    super($parent);
    this.mount();
  }

  template() {
    return `
      <div class="ruler">
        <div data-ref="svgContainer" id="rulerDiv" class="rulerDiv">
          <svg data-ref="svg" xmlns="http://www.w3.org/2000/svg" version="1.1" id="rulerImg" class="rulerImg"></svg>
        </div>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);

    this.#$svgContainer = this.$node.querySelector('[data-ref="svgContainer"]');
    this.#$svg = this.$node.querySelector('[data-ref="svg"]');
    this.#width = this.$node.offsetWidth;
  }

  init(duration) {
    if (duration * this.#scale > this.#maxWidth) {
      throw new Error('maxWidth ' + this.#maxWidth + ' exceeded: ' + duration * this.#scale);
    }

    this.#duration = duration;
    this.#scaleList = this.#getScaleList(duration, this.#maxWidth);

    // Content-aware initial zoom: show ~30-60 sec of context
    const defaultIndex = this.#getDefaultZoomIndex(duration);
    this.resize(defaultIndex);
    this.#moveTo(0);

    return { scaleList: this.#scaleList, initialZoom: defaultIndex };
  }

  #getDefaultZoomIndex(duration) {
    const maxIndex = this.#scaleList.length - 1;

    // Very short (< 30s): fit to window
    if (duration < 30) {
      return 0;
    }

    // Short (< 2 min): show ~30 sec context
    if (duration < 120) {
      return Math.min(2, maxIndex);
    }

    // Medium (< 10 min): show ~1 min context
    if (duration < 600) {
      return Math.min(3, maxIndex);
    }

    // Long (>= 10 min): show ~2 min context
    return Math.min(4, maxIndex);
  }

  resize(scaleIndex) {
    if (isNaN(scaleIndex) || scaleIndex < 0 || scaleIndex > this.#scaleList.length - 1) {
      throw new Error('wrong scale index: ' + scaleIndex);
    }

    const scale = this.#scaleList[scaleIndex];
    const width = this.#duration / scale;

    this.#scale = scale;
    const scaleFactorX = width / this.#duration;
    setScale(this.#scale);
    setScaleFactor(scaleFactorX);
    this.#redraw(width, scale);
    this.#moveTo(this.#posX);

    return parseFloat(this.#scale);
  }

  moveTo(posX) {
    if (isNaN(posX)) {
      throw new Error('Position is not a number');
    }

    const firstHalf = this.$node.offsetWidth / 2;
    const lastHalf = this.#$svg.getAttribute('width') - firstHalf - this.#margin;
    let realPosX = posX - firstHalf;

    if (realPosX < 0) {
      realPosX = 0;
    } else if (posX > lastHalf && this.#$svg.getAttribute('width') - this.$node.offsetWidth > 0) {
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

  getRange() {
    const width = this.getWidth();
    const left = width / 2;
    const realWidth = this.#$svg.getAttribute('width');
    const right = realWidth - left - this.#margin;

    return { left, right, width };
  }

  // ============================================================================
  // Private
  // ============================================================================

  #moveTo(posX) {
    const leftMargin = this.#margin;
    const maxPosXRuler = this.#$svg.getAttribute('width') - this.#width;

    posX = posX < 0 ? 0 : posX;

    if (maxPosXRuler > 0 && posX > maxPosXRuler - leftMargin) {
      posX = maxPosXRuler - leftMargin;
    }

    applyTransform3d(this.#$svgContainer, -posX, 0, 0);
    this.#posX = posX;

    return true;
  }

  #getScaleList(duration, maxWidth) {
    const scaleList = [];
    let isMax = false;

    this.#zoomMap.forEach((line, index) => {
      const width = ~~(duration / line.scale);

      if (width <= maxWidth && isMax === false) {
        scaleList.push(this.#zoomMap[index].scale);
      }

      isMax = width < this.$node.offsetWidth;
    });

    return scaleList;
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

    for (let x = 0; x <= width + 10; x += 100) {
      const time = x * scale;
      const minutes = ~~(time / 60);
      const secs = time % 60;
      const t = (minutes < 10 ? '0' : '') + minutes + ':' + (secs < 10 ? '0' : '') + secs;

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
}
