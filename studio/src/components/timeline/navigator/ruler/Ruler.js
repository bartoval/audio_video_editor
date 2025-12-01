import Component from 'Component';
import Config from 'Config';
import { applyTransform3d } from 'utils/animation';

export default class Ruler {
  constructor() {
    this.$container = null;
    this.$svgContainer = null;
    this.$svg = null;
    this.duration = 0;
    this.maxWidth = Config.getCanvasUpBound() * 5;
    this.zoomMap = Config.getScaleMap();
    this.scaleList = [];
    this.scale = Config.getScaleMap()[0];
    this.posX = 0;
    this.margin = Config.getMargin();
    this.preciseFrame = null;
    this.frame = null;
    this.width = null;
    this.animation = false;
  }

  init(duration) {
    if (duration * this.scale > this.maxWidth) {
      throw new Error('maxWidth ' + this.maxWidth + ' exceeded: ' + duration * this.scale);
    }

    this.duration = duration;
    this.scaleList = this._getScaleList(duration, this.maxWidth);
    this.resize(0);
    this._moveTo(0);

    return this.scaleList;
  }

  resize(scaleIndex, isChange = false) {
    if (isNaN(scaleIndex) || scaleIndex < 0 || scaleIndex > this.scaleList.length - 1) {
      throw new Error('wrong scale index: ' + scaleIndex);
    }

    const scale = this.scaleList[scaleIndex];
    const width = this.duration / scale;
    this.scale = scale;
    this.scaleFactorX = width / this.duration;
    Component.setScale(this.scale);
    Component.setScaleFactor(this.scaleFactorX);
    this._redraw(width, scale, isChange);
    this._moveTo(this.posX);

    return parseFloat(this.scale);
  }

  moveTo(posX) {
    if (isNaN(posX)) {
      throw new Error('Position is not a number');
    }

    const firstHalf = this.$container.offsetWidth / 2;
    const lastHalf = this.$svg.getAttribute('width') - firstHalf - this.margin;
    let realPosX = posX - firstHalf;

    if (realPosX < 0) {
      realPosX = 0;
    } else if (posX > lastHalf && this.$svg.getAttribute('width') - this.$container.offsetWidth > 0) {
      realPosX = lastHalf - firstHalf;
    }

    this.animation = Math.abs(posX - this.posX) > 50;

    return this._moveTo(realPosX);
  }

  getPosX() {
    return parseFloat(this.posX);
  }

  getWidth() {
    return this.$container.offsetWidth;
  }

  getMaxWidth() {
    return this.$svg.getAttribute('width') - this.margin;
  }

  getDuration() {
    return this.duration;
  }

  getRange() {
    const width = this.getWidth();
    const left = width / 2;
    const realWidth = this.$svg.getAttribute('width');
    const right = realWidth - left - this.margin;

    return { left, right, width };
  }

  updateFrame(posX) {
    const rulerPosX = this.getPosX();
    this.animation = false;

    return this._moveTo(rulerPosX + posX);
  }

  _moveTo(posX) {
    const leftMargin = this.margin;
    const maxPosXRuler = this.$svg.getAttribute('width') - this.width;

    posX = posX < 0 ? 0 : posX;

    if (maxPosXRuler > 0 && posX > maxPosXRuler - leftMargin) {
      posX = maxPosXRuler - leftMargin;
    }

    applyTransform3d(this.$svgContainer, -posX, 0, 0);
    this.posX = posX;

    return true;
  }

  _getScaleList(duration, maxWidth) {
    const scaleList = [];
    let isMax = false;

    this.zoomMap.forEach((line, index) => {
      const width = ~~(duration / line.scale);

      if (width <= maxWidth && isMax === false) {
        scaleList.push(this.zoomMap[index].scale);
      }

      isMax = width < this.$container.offsetWidth;
    });

    return scaleList;
  }

  _redraw(width, scale, isChange) {
    const $node = this.$svg;
    const height = this.$container.offsetHeight;

    if (isChange) {
      this._updateText($node, width, scale);
    } else {
      this._updateDraw($node, width, scale, height);
    }
  }

  _updateText($node, width, scale) {
    for (let x = 0; x < width + 10; x += 100) {
      const time = x * scale;
      const minutes = ~~(time / 60);
      const secs = time % 60;
      const t = (minutes < 10 ? '0' : '') + minutes + ':' + (secs < 10 ? '0' : '') + secs;
      const textNode = $node.querySelector('#rulerImgText' + x);
      const textWidth = textNode.getBBox().width;
      const textPos = x < 100 ? x : x >= width ? x - ~~textWidth : x - ~~textWidth / 2;

      textNode.setAttributeNS(null, 'x', textPos);
      textNode.textContent = t;
    }

    $node.setAttributeNS(null, 'width', width + 6);
  }

  _updateDraw($node, width, scale, height) {
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

  render($parent) {
    this.$container = Component.render($parent, 'div', [{ class: 'ruler' }]);
    this.$svgContainer = Component.render(this.$container, 'div', [{ id: 'rulerDiv', class: 'rulerDiv' }]);
    this.$svg = Component.render(this.$svgContainer, 'svg', [{ version: '1.1', id: 'rulerImg', class: 'rulerImg' }]);
    this.width = this.$container.offsetWidth;
  }
}
