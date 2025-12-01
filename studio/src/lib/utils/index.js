/** Utils - re-export all utilities */

export * from './animation';
export * from './dom';
export * from './format';
export {
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
} from './scale';
export { generateUuid } from './uuid';
export { isOnline } from './network';
