let scaleFactorX = -1;
let scale = -1;
let preciseFrame;

/** Zoom level presets */
export const SCALE_MAP = [
  { scale: 0.01, unit: 'seconds', line: 10, subLine: 5 },
  { scale: 0.02, unit: 'seconds', line: 10, subLine: 5 },
  { scale: 0.05, unit: 'seconds', line: 10, subLine: 5 },
  { scale: 0.1, unit: 'seconds', line: 100, subLine: 5 },
  { scale: 0.2, unit: 'seconds', line: 100, subLine: 5 },
  { scale: 0.5, unit: 'seconds', line: 100, subLine: 5 },
  { scale: 1.0, unit: 'seconds', line: 100, subLine: 5 },
  { scale: 2.0, unit: 'seconds', line: 100, subLine: 5 },
  { scale: 5.0, unit: 'seconds', line: 100, subLine: 5 },
  { scale: 10.0, unit: 'seconds', line: 100, subLine: 5 },
  { scale: 30.0, unit: 'seconds', line: 100, subLine: 5 },
  { scale: 60.0, unit: 'minutes', line: 100, subLine: 5 },
  { scale: 120.0, unit: 'minutes', line: 100, subLine: 5 },
  { scale: 300.0, unit: 'minutes', line: 100, subLine: 5 },
  { scale: 600.0, unit: 'minutes', line: 100, subLine: 5 }
];

export const getScaleMap = () => SCALE_MAP;

/** Set timeline scale */
export const setScale = newScale => {
  scale = newScale;
};

/** Get timeline scale */
export const getScale = () => scale;

/** Set scale factor for time/position conversion */
export const setScaleFactor = newScaleFactor => {
  scaleFactorX = newScaleFactor;
};

/** Get scale factor */
export const getScaleFactor = () => scaleFactorX;

/** Convert time (seconds) to pixel position */
export const getPosXFromTime = sec => {
  if (isNaN(sec) || sec < 0) {
    throw new Error('wrong input: time is ' + sec);
  }

  return scaleFactorX * sec;
};

/** Convert pixel position to time (seconds) */
export const getTimeFromPosX = posX => {
  if (isNaN(posX) || posX < 0) {
    throw new Error('wrong input: posX is ' + posX);
  }

  return posX / scaleFactorX;
};

/** Format time as mm:ss.ms */
export const getTimeFormatted = seconds => {
  const sec = ~~seconds % 60;
  const min = ~~(seconds / 60) % 60;
  const ms = ~~(seconds * 100) % 100;

  const pad = num => num.toString().padStart(2, '0');

  return `${pad(min)}:${pad(sec)}.${pad(ms)}`;
};

/** Calculate frame rate from delta time */
export const setFrames = deltaTime => {
  const fps = 1 / deltaTime;
  preciseFrame = 1 / (scale * fps);
};

/** Get frame info */
export const getFrames = () => ({
  frame: Math.ceil(preciseFrame),
  preciseFrame: parseFloat(preciseFrame)
});

export default {
  SCALE_MAP,
  getScaleMap,
  setScale,
  getScale,
  setScaleFactor,
  getScaleFactor,
  getPosXFromTime,
  getTimeFromPosX,
  getTimeFormatted,
  setFrames,
  getFrames
};
