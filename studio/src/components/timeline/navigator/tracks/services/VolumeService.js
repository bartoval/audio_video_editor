import { clamp, lerp, getTimeFromPosX } from '../../../../../lib';
import BezierLine from '../utils/BezierLine';

// DAW style: top=200%, center=100%, bottom=0%
const bezierCubic = (t, p0, p1, p2, p3, maxValue) => {
  const cX = 3 * (p1.x - p0.x);
  const bX = 3 * (p2.x - p1.x) - cX;
  const aX = p3.x - p0.x - cX - bX;

  const cY = 3 * (p1.y - p0.y);
  const bY = 3 * (p2.y - p1.y) - cY;
  const aY = p3.y - p0.y - cY - bY;

  const x = aX * Math.pow(t, 3) + bX * Math.pow(t, 2) + cX * t + p0.x;
  const y = aY * Math.pow(t, 3) + bY * Math.pow(t, 2) + cY * t + p0.y;

  // Output range 0-2: y=0 (top) → 2 (200%), y=mid → 1 (100%), y=max → 0 (0%)
  return { x, y: 2 * (1 - y / maxValue) };
};

const initPaths = (endPosX, startValue) => {
  const list = [];
  const newLine = new BezierLine(0, startValue);
  newLine.saveEndPoint(endPosX, startValue);
  list.push(newLine);

  return list;
};

const restorePaths = (savedPaths, maxValue) => {
  const defaultY = maxValue / 2;

  return savedPaths.map(data => {
    const isValidY = val => typeof val === 'number' && val >= 0 && val <= maxValue;

    const startValue = isValidY(data.startValue) ? data.startValue : defaultY;
    const endValue = isValidY(data.endValue) ? data.endValue : defaultY;
    const startControlValue = isValidY(data.startControlValue)
      ? data.startControlValue
      : startValue;
    const endControlValue = isValidY(data.endControlValue) ? data.endControlValue : endValue;
    const controlValue = isValidY(data.controlValue) ? data.controlValue : defaultY;

    const line = new BezierLine(data.startX, startValue);
    line.endX = data.endX;
    line.endControlX = data.endControlX;
    line.endValue = endValue;
    line.endControlValue = endControlValue;
    line.startControlX = data.startControlX;
    line.startControlValue = startControlValue;
    line.controlX = data.controlX;
    line.controlValue = controlValue;

    return line;
  });
};

export default class VolumeService {
  #lastDrawX = 0;
  #lastDrawY = 0;
  #pendingRedraw = null;
  #onChangeVolume = null;

  constructor(config, maxPosX, maxValue, callbacks = {}) {
    this.#onChangeVolume = callbacks.onChangeVolume || (() => {});

    this.maxPosX = maxPosX;
    this.maxValue = maxValue;
    this.scale = 1;

    // Default at center = 100% volume (DAW style: top=200%, center=100%, bottom=0%)
    const defaultY = maxValue / 2;

    this.startPoints = config.volumePaths ? config.volumePaths.startPoints : 'M0,' + defaultY + ',';
    this.endPoints = config.volumePaths ? config.volumePaths.endPoints : maxPosX + ',' + defaultY;
    this.paths = config.volumePaths
      ? restorePaths(config.volumePaths.paths, maxValue)
      : initPaths(maxPosX, defaultY);

    this.selectedPath = null;
    this.enabled = false;

    this.#lastDrawY = defaultY;
  }

  /** Update scale when track is resized */
  resize(width) {
    this.scale = this.maxPosX / width;
    this.#recalculateAndDispatchVolume();

    return true;
  }

  /** Enable volume editing */
  enable() {
    this.enabled = true;

    return true;
  }

  /** Disable volume editing */
  disable() {
    this.enabled = false;

    return true;
  }

  /** Check if volume editing is enabled */
  isEnabled() {
    return this.enabled;
  }

  /** Start drawing at position - prepares for potential keyframe insert or curve edit */
  drawStart(posX, posY) {
    posX = posX * this.scale;
    this.#lastDrawX = posX;
    this.#lastDrawY = posY;

    const selected = this.#selectPath(posX);

    if (selected.length > 0) {
      this.selectedPath = selected[0];
    } else {
      this.selectedPath = null;
    }

    return {
      posX: posX / this.scale,
      posY
    };
  }

  /** Continue drawing - if dragging on segment, modify bezier curve */
  draw(posX, posY) {
    if (!this.selectedPath) {
      return { posX, posY };
    }

    posY = clamp(posY, 0, this.maxValue);
    posX = posX * this.scale;

    const smoothFactor = 0.5;
    const smoothedX = lerp(this.#lastDrawX, posX, smoothFactor);
    const smoothedY = lerp(this.#lastDrawY, posY, smoothFactor);

    this.#lastDrawX = smoothedX;
    this.#lastDrawY = smoothedY;

    this.selectedPath.saveControlPoint(smoothedX, smoothedY);

    const finalX =
      smoothedX >= this.selectedPath.getStartPosX() ? smoothedX : this.selectedPath.getStartPosX();

    return {
      posX: finalX / this.scale,
      posY: smoothedY
    };
  }

  /** End drawing */
  drawEnd() {
    this.selectedPath = null;
    this.#recalculateAndDispatchVolume();

    return true;
  }

  /** Recalculate volume array from paths and dispatch to audio */
  #recalculateAndDispatchVolume() {
    const volumeArray = [];
    const { length } = this.paths;

    for (let i = 1; i < length; i++) {
      if (this.paths[i].endX - this.paths[i].startX < 1) {
        this.paths[i].endX = this.paths[i].startX + 1;
      }

      const curve = this.paths[i];
      const startPosX = Math.max(0, curve.getStartPosX() / this.scale);
      const width = Math.max(0, curve.getWidth() / this.scale);
      const startTime = getTimeFromPosX(startPosX);
      const durationTime = getTimeFromPosX(width);
      const curveParams = this.#setCurveParams(this.#getCurvePoints(curve));
      volumeArray.push({ startTime, durationTime, data: curveParams });
    }

    this.#onChangeVolume(volumeArray);
  }

  /** Get paths data for serialization */
  getPaths() {
    return {
      startPoints: this.startPoints,
      paths: this.paths,
      endPoints: this.endPoints
    };
  }

  /** Get all keyframe points for rendering (in screen coordinates) */
  getKeyframePoints() {
    const keyframes = [];
    const { paths, scale } = this;

    for (let i = 1; i < paths.length; i++) {
      const path = paths[i];

      keyframes.push({
        pathIndex: i,
        isStart: true,
        posX: path.getStartPosX() / scale,
        posY: path.startValue
      });
    }

    if (paths.length > 1) {
      const lastPath = paths[paths.length - 1];
      keyframes.push({
        pathIndex: paths.length - 1,
        isStart: false,
        posX: lastPath.getEndPosX() / scale,
        posY: lastPath.endValue
      });
    }

    return keyframes;
  }

  /** Insert a new keyframe at position, splitting the segment */
  insertKeyframe(posX) {
    posX = posX * this.scale;

    let insertIndex = this.paths.length;
    let containingPath = this.paths[this.paths.length - 1];

    for (let i = 0; i < this.paths.length; i++) {
      if (this.paths[i].getStartPosX() <= posX && this.paths[i].getEndPosX() >= posX) {
        containingPath = this.paths[i];
        insertIndex = i + 1;
        break;
      }
    }

    const startX = containingPath.getStartPosX();
    const endX = containingPath.getEndPosX();
    const startY = containingPath.startValue;
    const endY = containingPath.endValue;

    const t = (posX - startX) / (endX - startX);
    const posY = startY + t * (endY - startY);

    const prevPath = this.paths[insertIndex - 1];
    const prevEndX = prevPath.getEndPosX();
    const prevEndValue = prevPath.getEndValue();

    prevPath.saveEndPoint(posX, posY);

    const newPath = new BezierLine(posX, posY);
    newPath.saveEndPoint(prevEndX, prevEndValue);

    this.paths.splice(insertIndex, 0, newPath);

    this.#recalculateAndDispatchVolume();

    return { pathIndex: insertIndex, isStart: true };
  }

  /** Move a keyframe to new position */
  moveKeyframe(pathIndex, isStart, newPosX, newPosY) {
    newPosX = newPosX * this.scale;
    newPosY = clamp(newPosY, 0, this.maxValue);

    const path = this.paths[pathIndex];
    const minGap = 5;

    if (isStart) {
      const prevPrevPath = this.paths[pathIndex - 2];
      const minX = prevPrevPath ? prevPrevPath.getEndPosX() + minGap : minGap;
      const maxX = path.getEndPosX() - minGap;

      newPosX = clamp(newPosX, minX, maxX);

      const prevPath = this.paths[pathIndex - 1];

      if (prevPath) {
        prevPath.saveEndPoint(newPosX, newPosY);
      }

      path.saveStartPoint(newPosX, newPosY);
    } else {
      const nextPath = this.paths[pathIndex + 1];
      const minX = path.getStartPosX() + minGap;
      const maxX = nextPath ? nextPath.getEndPosX() - minGap : this.maxPosX;

      newPosX = clamp(newPosX, minX, maxX);

      path.saveEndPoint(newPosX, newPosY);

      if (nextPath) {
        nextPath.saveStartPoint(newPosX, newPosY);
      }

      if (pathIndex === this.paths.length - 1) {
        this.endPoints = this.maxPosX + ',' + newPosY;
      }
    }

    this.#recalculateAndDispatchVolume();
  }

  /** Check if there are user keyframes */
  hasKeyframes() {
    return this.paths.length > 1;
  }

  /** Apply fade in effect - modifies start, preserves middle keyframes */
  applyFadeIn(durationPosX) {
    durationPosX = durationPosX * this.scale;

    const zeroVolume = this.maxValue;
    const fullVolume = this.maxValue / 2;

    const preservedPaths = [];
    for (let i = 1; i < this.paths.length; i++) {
      const path = this.paths[i];
      if (path.getStartPosX() >= durationPosX) {
        preservedPaths.push(path);
      }
    }

    this.paths = [];

    const fadeInPath = new BezierLine(0, zeroVolume);
    fadeInPath.saveEndPoint(durationPosX, fullVolume);
    this.paths.push(fadeInPath);

    if (preservedPaths.length > 0) {
      const firstPreserved = preservedPaths[0];
      const connectPath = new BezierLine(durationPosX, fullVolume);
      connectPath.saveEndPoint(firstPreserved.getStartPosX(), firstPreserved.startValue);
      this.paths.push(connectPath);

      preservedPaths.forEach(path => this.paths.push(path));
    } else {
      const continuePath = new BezierLine(durationPosX, fullVolume);
      continuePath.saveEndPoint(this.maxPosX, fullVolume);
      this.paths.push(continuePath);
    }

    this.startPoints = 'M0,' + zeroVolume + ',';
    const lastPath = this.paths[this.paths.length - 1];
    this.endPoints = this.maxPosX + ',' + lastPath.endValue;

    this.#recalculateAndDispatchVolume();

    return true;
  }

  /** Apply fade out effect - modifies end, preserves middle keyframes */
  applyFadeOut(durationPosX) {
    durationPosX = durationPosX * this.scale;

    const zeroVolume = this.maxValue;
    const fullVolume = this.maxValue / 2;
    const fadeStartPosX = this.maxPosX - durationPosX;

    const preservedPaths = [];
    for (let i = 0; i < this.paths.length; i++) {
      const path = this.paths[i];
      if (path.getEndPosX() <= fadeStartPosX) {
        preservedPaths.push(path);
      }
    }

    this.paths = [];

    if (preservedPaths.length > 0) {
      preservedPaths.forEach(path => this.paths.push(path));

      const lastPreserved = preservedPaths[preservedPaths.length - 1];
      const connectPath = new BezierLine(lastPreserved.getEndPosX(), lastPreserved.endValue);
      connectPath.saveEndPoint(fadeStartPosX, fullVolume);
      this.paths.push(connectPath);
    } else {
      const basePath = new BezierLine(0, fullVolume);
      basePath.saveEndPoint(fadeStartPosX, fullVolume);
      this.paths.push(basePath);
    }

    const fadeOutPath = new BezierLine(fadeStartPosX, fullVolume);
    fadeOutPath.saveEndPoint(this.maxPosX, zeroVolume);
    this.paths.push(fadeOutPath);

    const firstPath = this.paths[0];
    this.startPoints = 'M0,' + firstPath.startValue + ',';
    this.endPoints = this.maxPosX + ',' + zeroVolume;

    this.#recalculateAndDispatchVolume();

    return true;
  }

  /** Apply both fade in and fade out effects - preserves middle keyframes */
  applyFades(fadeInDurationPosX, fadeOutDurationPosX) {
    fadeInDurationPosX = fadeInDurationPosX * this.scale;
    fadeOutDurationPosX = fadeOutDurationPosX * this.scale;

    const zeroVolume = this.maxValue;
    const fullVolume = this.maxValue / 2;
    const fadeOutStartPosX = this.maxPosX - fadeOutDurationPosX;

    const preservedPaths = [];
    for (let i = 1; i < this.paths.length; i++) {
      const path = this.paths[i];
      if (path.getStartPosX() >= fadeInDurationPosX && path.getEndPosX() <= fadeOutStartPosX) {
        preservedPaths.push(path);
      }
    }

    this.paths = [];

    const fadeInPath = new BezierLine(0, zeroVolume);
    fadeInPath.saveEndPoint(fadeInDurationPosX, fullVolume);
    this.paths.push(fadeInPath);

    if (preservedPaths.length > 0) {
      const firstPreserved = preservedPaths[0];
      const connectToMiddle = new BezierLine(fadeInDurationPosX, fullVolume);
      connectToMiddle.saveEndPoint(firstPreserved.getStartPosX(), firstPreserved.startValue);
      this.paths.push(connectToMiddle);

      preservedPaths.forEach(path => this.paths.push(path));

      const lastPreserved = preservedPaths[preservedPaths.length - 1];
      const connectToFadeOut = new BezierLine(lastPreserved.getEndPosX(), lastPreserved.endValue);
      connectToFadeOut.saveEndPoint(fadeOutStartPosX, fullVolume);
      this.paths.push(connectToFadeOut);
    } else {
      const middlePath = new BezierLine(fadeInDurationPosX, fullVolume);
      middlePath.saveEndPoint(fadeOutStartPosX, fullVolume);
      this.paths.push(middlePath);
    }

    const fadeOutPath = new BezierLine(fadeOutStartPosX, fullVolume);
    fadeOutPath.saveEndPoint(this.maxPosX, zeroVolume);
    this.paths.push(fadeOutPath);

    this.startPoints = 'M0,' + zeroVolume + ',';
    this.endPoints = this.maxPosX + ',' + zeroVolume;

    this.#recalculateAndDispatchVolume();

    return true;
  }

  /** Remove a keyframe, merging adjacent segments */
  removeKeyframe(pathIndex, isStart) {
    if (this.paths.length < 2) {
      return false;
    }

    let deleted = false;

    if (isStart && pathIndex >= 1) {
      const prevPath = this.paths[pathIndex - 1];
      const currentPath = this.paths[pathIndex];

      prevPath.saveEndPoint(currentPath.getEndPosX(), currentPath.getEndValue());
      this.paths.splice(pathIndex, 1);
      deleted = true;
    } else if (!isStart && pathIndex < this.paths.length - 1) {
      const currentPath = this.paths[pathIndex];
      const nextPath = this.paths[pathIndex + 1];

      currentPath.saveEndPoint(nextPath.getEndPosX(), nextPath.getEndValue());
      this.paths.splice(pathIndex + 1, 1);
      deleted = true;
    } else if (!isStart && pathIndex === this.paths.length - 1) {
      if (this.paths.length > 2) {
        const prevPath = this.paths[pathIndex - 1];
        this.endPoints = this.maxPosX + ',' + prevPath.getEndValue();
        this.paths.splice(pathIndex, 1);
        deleted = true;
      } else if (this.paths.length === 2) {
        this.paths.splice(1, 1);
        deleted = true;
      }
    }

    if (deleted) {
      this.#recalculateAndDispatchVolume();
    }

    return deleted;
  }

  /** Build SVG path data string (in screen coordinates) */
  buildPathData() {
    const { paths, scale } = this;
    const { length } = paths;
    const scaleFactor = 1 / scale;

    if (length <= 1) {
      const defaultY = this.maxValue / 2;
      const screenWidth = this.maxPosX * scaleFactor;

      return 'M0,' + defaultY + ' L' + screenWidth + ',' + defaultY;
    }

    const baseValue = paths[0].startValue;
    const firstCurve = paths[1];

    let d =
      'M0,' +
      baseValue +
      ' L' +
      firstCurve.startX * scaleFactor +
      ',' +
      firstCurve.startValue +
      ',';

    for (let i = 1; i < length; i++) {
      let elem = paths[i];

      if (!(elem instanceof BezierLine)) {
        elem = Object.assign(new BezierLine(), elem);
        paths[i] = elem;
      }

      d += this.#drawLineScaled(elem, scaleFactor);
    }

    const [endX, endY] = this.endPoints.split(',');
    d += parseFloat(endX) * scaleFactor + ',' + endY;

    return d;
  }

  /** Draw a bezier line with scaled X coordinates */
  #drawLineScaled(line, scaleFactor) {
    const lineTo = (posX, posY) => 'L' + posX * scaleFactor + ',' + posY;
    const curveTo = (sx, sy, ex, ey, cx, cy) =>
      'C' +
      sx * scaleFactor +
      ',' +
      sy +
      ',' +
      cx * scaleFactor +
      ',' +
      cy +
      ',' +
      ex * scaleFactor +
      ',' +
      ey;

    return (
      lineTo(line.startX, line.startValue) +
      ',' +
      curveTo(
        line.startControlX,
        line.startControlValue,
        line.endControlX,
        line.endControlValue,
        line.controlX,
        line.controlValue
      ) +
      ',' +
      lineTo(line.endX, line.endValue) +
      ','
    );
  }

  /** Request a redraw with RAF throttling */
  requestRedraw(callback) {
    if (this.#pendingRedraw) {
      return;
    }

    this.#pendingRedraw = requestAnimationFrame(() => {
      this.#pendingRedraw = null;
      callback(this.buildPathData());
    });
  }

  #selectPath(posX) {
    for (let i = 1; i < this.paths.length; i++) {
      const path = this.paths[i];
      if (path.getStartPosX() <= posX && path.getEndPosX() >= posX) {
        return [path];
      }
    }

    return [];
  }

  #getCurvePoints(curve) {
    const points = [];
    const startX = curve.startX / this.scale;
    const startValue = curve.startValue;
    const endX = curve.endX / this.scale;
    const endValue = curve.endValue;
    const controlStartX = curve.startControlX / this.scale;
    const controlStartValue = curve.startControlValue;
    const width = endX - startX;
    const sampleRate = 100;
    const sampleSize = getTimeFromPosX(width) * sampleRate;
    const steps = 1 / sampleSize;
    const p0 = { x: startX, y: startValue };
    const p1 = { x: controlStartX, y: controlStartValue };
    const p2 = { x: endX, y: endValue };
    const p3 = { x: endX, y: endValue };

    for (let t = 0; t <= 1; t += steps) {
      points.push(bezierCubic(t, p0, p1, p2, p3, this.maxValue));
    }

    return points;
  }

  #setCurveParams(points) {
    const numRect = Math.round(points.length);
    const curveValues = new Float32Array(numRect);
    const timesValues = [];

    points.forEach((point, index) => {
      curveValues[index] = point.y;
      timesValues[index] = getTimeFromPosX(point.x);
    });

    return { values: curveValues, times: timesValues };
  }
}
