// @ts-check

/**
 * SplitModeService - Split mode workflow management
 *
 * Manages the split mode state machine:
 * 1. User enters split mode for a specific zone
 * 2. Click on waveform triggers split at that position
 * 3. Service validates and returns split info
 * 4. TracksController executes the actual split
 *
 * ESC or clicking outside exits split mode.
 */

import { TRACKS } from '../config/constants.js';
import { getTimeFromPosX } from '../lib/utils/scale.js';

/** @type {boolean} */
let isActive = false;
/** @type {any} */
let targetZone = null;
/** @type {Set<(data: { active: boolean, zone: any }) => void>} */
let listeners = new Set();

/**
 * Enter split mode for a zone
 * @param {any} zone - The zone to split
 * @returns {boolean} Success
 */
export const enter = zone => {
  if (!zone) {
    return false;
  }

  isActive = true;
  targetZone = zone;
  zone.getRoot().classList.add('split-mode');
  document.body.classList.add('tool-split');
  notify();

  return true;
};

/**
 * Exit split mode
 */
export const exit = () => {
  if (targetZone) {
    targetZone.getRoot().classList.remove('split-mode');
  }

  isActive = false;
  targetZone = null;
  document.body.classList.remove('tool-split');
  notify();
};

/**
 * Check if split mode is active
 * @returns {boolean}
 */
export const isEnabled = () => isActive;

/**
 * Get the zone being split
 * @returns {any}
 */
export const getZone = () => targetZone;

/**
 * Validate and calculate split info from a click position
 * @param {any} clickedZone - The zone that was clicked
 * @param {number} posX - Click position in pixels
 * @returns {{ zone: any, splitTime: number } | null} Split info or null if invalid
 */
export const getSplitInfo = (clickedZone, posX) => {
  if (!isActive || !clickedZone || clickedZone !== targetZone) {
    return null;
  }

  const clickTime = getTimeFromPosX(posX);
  const trackStart = clickedZone.getStart();
  const trackEnd = clickedZone.getEnd();

  if (clickTime <= trackStart || clickTime >= trackEnd) {
    return null;
  }

  const splitTime = clickTime - trackStart;
  const { MIN_CUT_DURATION } = TRACKS;
  const duration = clickedZone.getDuration();

  const beforeDuration = splitTime;
  const afterDuration = duration - splitTime;

  if (beforeDuration < MIN_CUT_DURATION || afterDuration < MIN_CUT_DURATION) {
    return null;
  }

  return {
    zone: clickedZone,
    splitTime
  };
};

/**
 * Subscribe to state changes
 * @param {(data: { active: boolean, zone: any }) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export const onChange = callback => {
  listeners.add(callback);

  return () => listeners.delete(callback);
};

function notify() {
  const data = { active: isActive, zone: targetZone };

  listeners.forEach(cb => {
    try {
      cb(data);
    } catch (err) {
      console.error('[SplitModeService] Listener error:', err);
    }
  });
}

export const __resetForTesting = () => {
  isActive = false;
  targetZone = null;
  listeners.clear();
  document.body.classList.remove('tool-split');
};

export default {
  enter,
  exit,
  isEnabled,
  getZone,
  getSplitInfo,
  onChange
};
