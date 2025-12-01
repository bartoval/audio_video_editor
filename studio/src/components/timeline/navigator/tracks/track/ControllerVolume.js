import Component from 'Component';
import Line from './Line';
import Signals from 'signals';
import { applyTransform3d, setTransition, clamp, lerp } from 'utils/animation';
import { show, hide, setEnabled } from 'utils/dom';

let _pendingRedraw = null;

const initPaths = (endPosX, startValue) => {
  const list = [];
  const newLine = new Line(0, startValue);
  newLine.saveEndPoint(endPosX, startValue);
  list.push(newLine);

  return list;
};

const restorePaths = (savedPaths) => {
  return savedPaths.map(data => {
    const line = new Line(data.startX, data.startValue);
    line.endX = data.endX;
    line.endControlX = data.endControlX;
    line.endValue = data.endValue;
    line.endControlValue = data.endControlValue;
    line.startControlX = data.startControlX;
    line.startControlValue = data.startControlValue;
    line.controlX = data.controlX;
    line.controlValue = data.controlValue;

    return line;
  });
};

const bezierCubic = (t, p0, p1, p2, p3, maxValue) => {
  const cX = 3 * (p1.x - p0.x);
  const bX = 3 * (p2.x - p1.x) - cX;
  const aX = p3.x - p0.x - cX - bX;

  const cY = 3 * (p1.y - p0.y);
  const bY = 3 * (p2.y - p1.y) - cY;
  const aY = p3.y - p0.y - cY - bY;

  const x = aX * Math.pow(t, 3) + bX * Math.pow(t, 2) + cX * t + p0.x;
  const y = aY * Math.pow(t, 3) + bY * Math.pow(t, 2) + cY * t + p0.y;

  return { x, y: 1 - y / maxValue };
};

export default class ControllerVolume {
  constructor(config, $parent) {
    this.$node = null;
    this.$path = null;
    this.$volumeInfo = null;
    this.$volumeArea = null;
    this.$volumeContainer = null;

    this.maxPosX = $parent.offsetWidth;
    this.maxValue = ~~($parent.offsetHeight * 70 / 100);
    this.scale = 1;
    this.startPoints = config.volumePaths ? config.volumePaths.startPoints : 'M0,' + this.maxValue / 2 + ',';
    this.endPoints = config.volumePaths ? config.volumePaths.endPoints : this.maxPosX + ',' + this.maxValue / 2;
    this.paths = config.volumePaths ? restorePaths(config.volumePaths.paths) : initPaths(this.maxPosX, this.maxValue / 2);
    this.selectedPath = null;
    this.enabled = false;
    this.onChangeVolume = new Signals.Signal();
    this.animation = false;

    this._lastDrawX = 0;
    this._lastDrawY = this.maxValue / 2;
    this._isDrawing = false;

    this.render($parent, config.id);
  }

  resize(width) {
    this.scale = this.maxPosX / width;

    return true;
  }

  enable() {
    this.enabled = true;
    setEnabled(this.$volumeArea, true);

    return true;
  }

  disable() {
    this.enabled = false;
    setEnabled(this.$volumeArea, false);

    return true;
  }

  isEnabled() {
    return this.enabled;
  }

  drawStart(posX, posY, stretchFactor) {
    posX = posX * this.scale;
    this.animation = true;
    this._lastDrawX = posX;
    this._lastDrawY = posY;
    this._isDrawing = true;

    const selectPath = () => {
      const getPath = () => {
        return this.paths.filter((elem, index) => {
          return elem.getStartPosX() < posX && elem.getEndPosX() > posX && index > 0;
        });
      };

      const getPreviousPaths = () => {
        this.paths = this.paths.filter((elem, index) => {
          return elem.getStartPosX() < posX && elem.getEndPosX() < posX || index === 0;
        });
      };

      const selected = getPath();

      if (selected.length === 0) {
        getPreviousPaths();
      }

      return selected;
    };

    const addPath = (previousLine, value) => {
      const previousValue = previousLine.getEndValue();
      const newLine = new Line(posX, value);
      newLine.saveStartPoint(posX, previousValue);
      this.paths.push(newLine);
      this.endPoints = this.maxPosX + ',' + value;
    };

    const editPath = path => {
      this.selectedPath = path ? path : null;
    };

    const selected = selectPath();

    if (selected.length === 0) {
      addPath(this.paths[this.paths.length - 1], posY);
    } else {
      editPath(selected[0]);
    }

    this._redraw();
    this._moveTo(posX / this.scale * stretchFactor, posY);
    show(this.$volumeInfo);
    this.animation = false;
  }

  draw(posX, posY, stretchFactor) {
    posY = clamp(posY, 0, this.maxValue);
    posX = posX * this.scale;

    const smoothFactor = 0.5;
    const smoothedX = lerp(this._lastDrawX, posX, smoothFactor);
    const smoothedY = lerp(this._lastDrawY, posY, smoothFactor);

    this._lastDrawX = smoothedX;
    this._lastDrawY = smoothedY;

    let selectedPath;

    if (this.selectedPath === null) {
      selectedPath = this.paths[this.paths.length - 1];
      this.paths[this.paths.length - 1].saveEndPoint(smoothedX, smoothedY);
      this.endPoints = this.maxPosX + ',' + smoothedY;
    } else {
      selectedPath = this.selectedPath;
      this.selectedPath.saveControlPoint(smoothedX, smoothedY);
    }

    this._redraw();
    const finalX = smoothedX >= selectedPath.getStartPosX() ? smoothedX : selectedPath.getStartPosX();
    this._moveTo(finalX / this.scale * stretchFactor, smoothedY);
  }

  drawEnd() {
    this._isDrawing = false;

    const volumeArray = [];
    const { length } = this.paths;

    for (let i = 1; i < length; i++) {
      if (this.paths[i].endX - this.paths[i].startX < 1) {
        this.paths[i].endX = this.paths[i].startX + 1;
      }

      const curve = this.paths[i];
      const startTime = Component.getTimeFromPosX(curve.getStartPosX() / this.scale);
      const durationTime = Component.getTimeFromPosX(curve.getWidth() / this.scale);
      const curveParams = this._setCurveParams(this._getCurvePoints(curve, this.maxValue));
      volumeArray.push({ startTime, durationTime, data: curveParams });
    }

    this.selectedPath = null;
    this.onChangeVolume.dispatch(volumeArray);
    hide(this.$volumeInfo);

    return true;
  }

  getPaths() {
    return { startPoints: this.startPoints, paths: this.paths, endPoints: this.endPoints };
  }

  _redraw() {
    if (_pendingRedraw) {
      return;
    }

    _pendingRedraw = requestAnimationFrame(() => {
      _pendingRedraw = null;
      let d = this.startPoints;
      const { paths } = this;
      const { length } = paths;

      for (let i = 0; i < length; i++) {
        let elem = paths[i];

        if (!(elem instanceof Line)) {
          elem = Object.assign(new Line(), elem);
          paths[i] = elem;
        }

        if (i > 0) {
          d += elem.drawLine();
        }
      }

      d += this.endPoints;
      this.$path.setAttribute('d', d);
    });
  }

  _moveTo(posX, posY) {
    if (isNaN(posY)) {
      throw new Error('Position is not a number');
    }

    const value = clamp(1 - posY / this.maxValue, 0, 1);

    setTransition(this.$volumeContainer, this.animation);
    applyTransform3d(this.$volumeContainer, posX, posY, 0);
    this.$volumeInfo.textContent = (value * 100).toFixed(0) + '%';
  }

  _getCurvePoints(curve, maxValue) {
    const points = [];
    const startX = curve.startX / this.scale;
    const startValue = curve.startValue;
    const endX = curve.endX / this.scale;
    const endValue = curve.endValue;
    const controlStartX = curve.startControlX / this.scale;
    const controlStartValue = curve.startControlValue;
    const width = endX - startX;
    const sampleRate = 100;
    const sampleSize = Component.getTimeFromPosX(width) * sampleRate;
    const steps = 1 / sampleSize;
    const p0 = { x: startX, y: startValue };
    const p1 = { x: controlStartX, y: controlStartValue };
    const p2 = { x: endX, y: endValue };
    const p3 = { x: endX, y: endValue };

    for (let t = 0; t <= 1; t += steps) {
      points.push(bezierCubic(t, p0, p1, p2, p3, maxValue));
    }

    return points;
  }

  _setCurveParams(points) {
    const numRect = Math.round(points.length);
    const curveValues = new Float32Array(numRect);
    const timesValues = [];

    points.forEach((point, index) => {
      curveValues[index] = point.y;
      timesValues[index] = Component.getTimeFromPosX(point.x);
    });

    return { values: curveValues, times: timesValues };
  }

  render($parent, id) {
    const { maxValue, maxPosX } = this;
    const listeners = {
      contextmenu: e => {
        e.preventDefault();

        return false;
      }
    };

    this.$node = Component.render($parent, 'div', [{ class: 'volume-zone hide', 'data-zone-id': id }]);
    this.$volumeArea = Component.render(this.$node, 'svg', [{
      class: 'volume-area',
      width: maxPosX,
      viewBox: '0 0 ' + maxPosX + ' ' + maxValue,
      preserveAspectRatio: 'none',
      'data-zone-id': id
    }], listeners);
    this.$path = Component.render(this.$volumeArea, 'path', [{ class: 'volume-line', d: '' }]);
    this.$volumeContainer = Component.render(this.$node, 'div', [{ class: 'volume-container' }]);
    this.$volumeInfo = Component.render(this.$volumeContainer, 'div', [{ class: 'volume-info hide-animated' }]);

    this._redraw();
    this._moveTo(0, maxValue / 2);
  }
}
