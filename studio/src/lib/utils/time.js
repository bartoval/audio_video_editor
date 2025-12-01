let scaleFactorX = -1;
let scale = -1;
let preciseFrame;

export const setScale = (newScale) => {
  scale = newScale;
};

export const getScale = () => scale;

export const setScaleFactor = (newScaleFactor) => {
  scaleFactorX = newScaleFactor;
};

export const getScaleFactor = () => scaleFactorX;

export const getPosXFromTime = (seconds) => {
  if (isNaN(seconds) || seconds < 0) {
    throw new Error(`Invalid time value: ${seconds}`);
  }

  return scaleFactorX * seconds;
};

export const getTimeFromPosX = (posX) => {
  if (isNaN(posX) || posX < 0) {
    throw new Error(`Invalid position value: ${posX}`);
  }

  return posX / scaleFactorX;
};

export const formatTime = (seconds) => {
  const sec = ~~seconds % 60;
  const min = ~~(seconds / 60) % 60;
  const ms = ~~(seconds * 100) % 100;

  const pad = (num) => num.toString().padStart(2, '0');

  return `${pad(min)}:${pad(sec)}.${pad(ms)}`;
};

export const setFrames = (deltaTime) => {
  const fps = 1 / deltaTime;
  preciseFrame = 1 / (scale * fps);
};

export const getFrames = () => ({
  frame: Math.ceil(preciseFrame),
  preciseFrame: parseFloat(preciseFrame)
});
