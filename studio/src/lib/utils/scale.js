let scaleFactorX = -1;
let scale = -1;
let preciseFrame;

/** Epsilon for scale comparison (floating point tolerance) */
export const SCALE_EPSILON = 0.0000001;

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

/** Format time as mm:ss.mmm */
export const getTimeFormatted = seconds => {
  const totalSeconds = Math.floor(seconds);
  const sec = totalSeconds % 60;
  const min = Math.floor(totalSeconds / 60) % 60;
  const ms = Math.floor((seconds * 1000) % 1000);

  const pad2 = num => num.toString().padStart(2, '0');
  const pad3 = num => num.toString().padStart(3, '0');

  return `${pad2(min)}:${pad2(sec)}.${pad3(ms)}`;
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

/** Check if two scales are different (accounting for floating point precision) */
export const scaleChanged = (scale1, scale2) => Math.abs(scale1 - scale2) >= SCALE_EPSILON;

/** Check if two scales are equal (accounting for floating point precision) */
export const scalesEqual = (scale1, scale2) => Math.abs(scale1 - scale2) < SCALE_EPSILON;

export default {
  SCALE_EPSILON,
  setScale,
  getScale,
  setScaleFactor,
  getScaleFactor,
  getPosXFromTime,
  getTimeFromPosX,
  getTimeFormatted,
  setFrames,
  getFrames,
  scaleChanged,
  scalesEqual
};
