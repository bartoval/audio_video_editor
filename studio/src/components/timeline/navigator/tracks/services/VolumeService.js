import { clamp, lerp, getTimeFromPosX, Signals } from '../../../../../lib';
import BezierLine from '../utils/BezierLine';

// ============================================================================
// Bezier Math
// ============================================================================

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

// ============================================================================
// Path Initialization
// ============================================================================

const initPaths = (endPosX, startValue) => {
  const list = [];
  const newLine = new BezierLine(0, startValue);
  newLine.saveEndPoint(endPosX, startValue);
  list.push(newLine);

  return list;
};

const restorePaths = savedPaths => {
  return savedPaths.map(data => {
    const line = new BezierLine(data.startX, data.startValue);
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

// ============================================================================
// VolumeService
// ============================================================================

/**
 * VolumeService - Handles volume envelope bezier curve logic
 * Manages paths, drawing state, and volume calculations
 */
export default class VolumeService {
  #lastDrawX = 0;
  #lastDrawY = 0;
  #isDrawing = false;
  #pendingRedraw = null;

  constructor(config, maxPosX, maxValue) {
    this.maxPosX = maxPosX;
    this.maxValue = maxValue;
    this.scale = 1;

    this.startPoints = config.volumePaths
      ? config.volumePaths.startPoints
      : 'M0,' + maxValue / 2 + ',';
    this.endPoints = config.volumePaths
      ? config.volumePaths.endPoints
      : maxPosX + ',' + maxValue / 2;
    this.paths = config.volumePaths
      ? restorePaths(config.volumePaths.paths)
      : initPaths(maxPosX, maxValue / 2);

    this.selectedPath = null;
    this.enabled = false;

    this.#lastDrawY = maxValue / 2;

    this.onChangeVolume = new Signals.Signal();
  }

  /** Update scale when track is resized */
  resize(width) {
    // Update scale for coordinate conversion
    // scale converts from track coordinates to SVG coordinates (maxPosX space)
    this.scale = this.maxPosX / width;

    // Paths are stored in maxPosX coordinate space (SVG viewBox space)
    // They don't need scaling because the SVG viewBox stays the same
    // The SVG element itself is stretched by CSS to match the track width

    // Recalculate and dispatch volume times for the new scale
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

  /** Start drawing at position */
  drawStart(posX, posY) {
    posX = posX * this.scale;
    this.#lastDrawX = posX;
    this.#lastDrawY = posY;
    this.#isDrawing = true;

    const selected = this.#selectPath(posX);

    if (selected.length === 0) {
      this.#addPath(this.paths[this.paths.length - 1], posX, posY);
    } else {
      this.selectedPath = selected[0];
    }

    return {
      posX: posX / this.scale,
      posY
    };
  }

  /** Continue drawing at position */
  draw(posX, posY) {
    posY = clamp(posY, 0, this.maxValue);
    posX = posX * this.scale;

    const smoothFactor = 0.5;
    const smoothedX = lerp(this.#lastDrawX, posX, smoothFactor);
    const smoothedY = lerp(this.#lastDrawY, posY, smoothFactor);

    this.#lastDrawX = smoothedX;
    this.#lastDrawY = smoothedY;

    let selectedPath;

    if (this.selectedPath === null) {
      selectedPath = this.paths[this.paths.length - 1];
      this.paths[this.paths.length - 1].saveEndPoint(smoothedX, smoothedY);
      this.endPoints = this.maxPosX + ',' + smoothedY;
    } else {
      selectedPath = this.selectedPath;
      this.selectedPath.saveControlPoint(smoothedX, smoothedY);
    }

    const finalX =
      smoothedX >= selectedPath.getStartPosX() ? smoothedX : selectedPath.getStartPosX();

    return {
      posX: finalX / this.scale,
      posY: smoothedY
    };
  }

  /** End drawing and calculate volume array */
  drawEnd() {
    this.#isDrawing = false;
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
      // Clamp to non-negative values to prevent errors in getTimeFromPosX
      const startPosX = Math.max(0, curve.getStartPosX() / this.scale);
      const width = Math.max(0, curve.getWidth() / this.scale);
      const startTime = getTimeFromPosX(startPosX);
      const durationTime = getTimeFromPosX(width);
      const curveParams = this.#setCurveParams(this.#getCurvePoints(curve));
      volumeArray.push({ startTime, durationTime, data: curveParams });
    }

    this.onChangeVolume.dispatch(volumeArray);
  }

  /** Get paths data for serialization */
  getPaths() {
    return {
      startPoints: this.startPoints,
      paths: this.paths,
      endPoints: this.endPoints
    };
  }

  /** Build SVG path data string */
  buildPathData() {
    const { paths } = this;
    const { length } = paths;

    // If no user curves yet, show default horizontal line at 50% volume
    if (length <= 1) {
      const midValue = this.maxValue / 2;

      return 'M0,' + midValue + ' L' + this.maxPosX + ',' + midValue;
    }

    // Get the starting value from paths[0] (base path at 50% volume)
    const baseValue = paths[0].startValue;
    const firstCurve = paths[1];

    // Start from 0 with a horizontal line to the first curve's start point
    let d = 'M0,' + baseValue + ' L' + firstCurve.startX + ',' + firstCurve.startValue + ',';

    for (let i = 1; i < length; i++) {
      let elem = paths[i];

      if (!(elem instanceof BezierLine)) {
        elem = Object.assign(new BezierLine(), elem);
        paths[i] = elem;
      }

      d += elem.drawLine();
    }

    d += this.endPoints;

    return d;
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

  // ============================================================================
  // Private Methods
  // ============================================================================

  #selectPath(posX) {
    const getPath = () => {
      return this.paths.filter((elem, index) => {
        return elem.getStartPosX() < posX && elem.getEndPosX() > posX && index > 0;
      });
    };

    const getPreviousPaths = () => {
      this.paths = this.paths.filter((elem, index) => {
        return (elem.getStartPosX() < posX && elem.getEndPosX() < posX) || index === 0;
      });
    };

    const selected = getPath();

    if (selected.length === 0) {
      getPreviousPaths();
    }

    return selected;
  }

  #addPath(previousLine, posX, value) {
    const previousValue = previousLine.getEndValue();
    const newLine = new BezierLine(posX, value);
    newLine.saveStartPoint(posX, previousValue);
    this.paths.push(newLine);
    this.endPoints = this.maxPosX + ',' + value;
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
