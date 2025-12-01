// @ts-check

/**
 * @typedef {import('../../types/types').WaveformPoint} WaveformPoint
 * @typedef {import('../../types/types').DrawWaveformOptions} DrawWaveformOptions
 * @typedef {import('../../types/types').DrawWaveformWindowOptions} DrawWaveformWindowOptions
 * @typedef {import('../../types/types').CreateWaveformSvgOptions} CreateWaveformSvgOptions
 * @typedef {import('../../types/types').GetWaveformPathDataOptions} GetWaveformPathDataOptions
 */

import { THEME } from '../../config/ui';
import { TRACKS } from '../../config/constants';

const { waveformColor } = THEME;
const { WAVEFORM_LINE_WIDTH } = TRACKS;
const Y_SCALE = 1.5;

/**
 * Draw waveform on canvas context
 * @param {CanvasRenderingContext2D} ctx
 * @param {WaveformPoint[]} data
 * @param {DrawWaveformOptions} options
 */
export const drawWaveform = (ctx, data, options) => {
  const {
    width,
    height,
    startIdx = 0,
    endIdx = data.length,
    offsetX = 0,
    color = waveformColor,
    lineWidth = WAVEFORM_LINE_WIDTH,
    yScale = Y_SCALE,
    clear = false
  } = options;

  if (clear) {
    ctx.clearRect(0, 0, width, height);
  }

  if (!data || data.length === 0 || endIdx <= startIdx) {
    return;
  }

  const halfHeight = height / 2;

  ctx.beginPath();
  ctx.moveTo(0, halfHeight);

  for (let idx = startIdx; idx < endIdx; idx++) {
    const point = data[idx];

    if (!point) {
      continue;
    }

    const xPos = point.x - offsetX;
    const yScaled = Math.max(-1, Math.min(1, point.y * yScale));
    const yPos = yScaled * halfHeight + halfHeight;

    ctx.lineTo(xPos, yPos);
  }

  ctx.lineTo(width, halfHeight);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
};

/**
 * Draw waveform for a time window (used by SuperZoom)
 * @param {CanvasRenderingContext2D} ctx
 * @param {WaveformPoint[]} data
 * @param {DrawWaveformWindowOptions} options
 */
export const drawWaveformWindow = (ctx, data, options) => {
  const {
    width,
    height,
    windowStart,
    windowEnd,
    dataStart = 0,
    dataEnd,
    duration,
    color = waveformColor,
    lineWidth = WAVEFORM_LINE_WIDTH,
    yScale = Y_SCALE
  } = options;

  ctx.clearRect(0, 0, width, height);

  if (!data || data.length === 0) {
    return;
  }

  const totalPoints = data.length;
  const actualDataEnd = dataEnd ?? duration;
  const dataDuration = actualDataEnd - dataStart;
  const pointsPerSecond = totalPoints / dataDuration;
  const windowDuration = windowEnd - windowStart;

  const startIdx = Math.max(0, Math.floor((windowStart - dataStart) * pointsPerSecond));
  const endIdx = Math.min(totalPoints, Math.ceil((windowEnd - dataStart) * pointsPerSecond));

  if (endIdx <= startIdx) {
    return;
  }

  const halfHeight = height / 2;

  ctx.beginPath();
  ctx.moveTo(0, halfHeight);

  for (let idx = startIdx; idx < endIdx; idx++) {
    const point = data[idx];

    if (!point) {
      continue;
    }

    const pointTime = dataStart + idx / pointsPerSecond;
    const xPos = ((pointTime - windowStart) / windowDuration) * width;
    const yScaled = Math.max(-1, Math.min(1, point.y * yScale));
    const yPos = yScaled * halfHeight + halfHeight;

    ctx.lineTo(xPos, yPos);
  }

  ctx.lineTo(width, halfHeight);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
};

/**
 * Create SVG waveform element
 * @param {WaveformPoint[]} data
 * @param {CreateWaveformSvgOptions} options
 * @returns {SVGSVGElement}
 */
