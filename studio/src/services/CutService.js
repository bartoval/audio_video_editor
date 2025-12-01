// @ts-check

/**
 * CutService - Two-step cut workflow management
 *
 * Uses ToolMode for activation (like other tools) but maintains
 * internal state machine for the two-step cut workflow:
 *
 * 1. User activates cut mode (via ToolMode)
 * 2. First click sets start point (PENDING)
 * 3. Drag updates end point (DRAGGING)
 * 4. Mouse up finalizes selection (READY)
 * 5. Click confirms and applies cut
 *
 * ESC cancels at any step.
 */

import { CUT_STATE, TRACKS, TRACK_ACTION } from '../config/constants.js';
import * as ToolMode from './ToolMode.js';
import { getTimeFromPosX } from '../lib/utils/scale.js';

/** @type {string} */
let workflowState = CUT_STATE.INACTIVE;
/** @type {number | null} */
let startPosX = null;
/** @type {number | null} */
let endPosX = null;
/** @type {number | null} */
let startClientX = null;
/** @type {number | null} */
let endClientX = null;
/** @type {number | null} */
let startTime = null;
/** @type {number | null} */
let endTime = null;
/** @type {any} */
let activeZone = null;
/** @type {Set<(data: { state: string, cutZone: any }) => void>} */
let listeners = new Set();

ToolMode.onModeChange(mode => {
  if (mode === TRACK_ACTION.CUT) {
    if (workflowState === CUT_STATE.INACTIVE) {
      workflowState = CUT_STATE.ACTIVE;
      notify();
    }
  } else {
    if (workflowState !== CUT_STATE.INACTIVE) {
      reset();
      notify();
    }
  }
});

/** Activate cut mode */
export const activate = () => {
  ToolMode.activate(TRACK_ACTION.CUT);
};

/**
 * Deactivate cut mode completely
 */
export const deactivate = () => {
  ToolMode.deactivate();
};

/**
 * Toggle cut mode on/off
 */
export const toggle = () => {
  ToolMode.toggle(TRACK_ACTION.CUT);
};

/**
 * Check if cut mode is active (any non-inactive state)
 */
export const isActive = () => {
  return ToolMode.isMode(TRACK_ACTION.CUT);
};

/**
 * Handle first click - set start point
 * @param {number} posX - X position in pixels
 * @param {Object} zone - The track zone being cut
 * @param {number} clientX - Client X position for relative positioning
 */
export const setStart = (posX, zone, clientX) => {
  if (workflowState !== CUT_STATE.ACTIVE) {
    return false;
  }

  startPosX = posX;
  startClientX = clientX;
  startTime = getTimeFromPosX(posX);
  endPosX = posX;
  endClientX = clientX;
  endTime = startTime;
  activeZone = zone;
  workflowState = CUT_STATE.PENDING;
  notify();

  return true;
};

/**
 * Handle drag or mouse move - update end point preview
 * @param {number} posX - Current X position
 * @param {number} clientX - Client X position
 */
export const updateEnd = (posX, clientX) => {
  if (workflowState !== CUT_STATE.PENDING && workflowState !== CUT_STATE.DRAGGING) {
    return false;
  }

  if (workflowState === CUT_STATE.PENDING) {
    workflowState = CUT_STATE.DRAGGING;
  }

  endPosX = posX;
  endClientX = clientX;
  endTime = getTimeFromPosX(posX);
  notify();

  return true;
};

/**
 * Handle mouseup - finalize selection
 * @param {number} posX - Final X position
 * @param {number} clientX - Client X position
 */
export const setEnd = (posX, clientX) => {
  if (workflowState !== CUT_STATE.PENDING && workflowState !== CUT_STATE.DRAGGING) {
    return false;
  }

  endPosX = posX;
  endClientX = clientX;
  endTime = getTimeFromPosX(posX);

  if (startTime > endTime) {
    [startTime, endTime] = [endTime, startTime];
    [startPosX, endPosX] = [endPosX, startPosX];
    [startClientX, endClientX] = [endClientX, startClientX];
  }

  const duration = endTime - startTime;

  if (duration < TRACKS.MIN_CUT_DURATION) {
    cancelWorkflow();

    return false;
  }

  workflowState = CUT_STATE.READY;
  notify();

  return true;
};

/**
 * Confirm and apply the cut
 * @returns {Object|null} Cut info { zone, startTime, endTime } or null if not ready
 */
export const confirm = () => {
  if (workflowState !== CUT_STATE.READY) {
    return null;
  }

  const cutInfo = {
    zone: activeZone,
    startTime,
    endTime,
    startPosX,
    endPosX
  };

  // Reset workflow but keep cut mode active for next cut
  resetWorkflow();
  workflowState = CUT_STATE.ACTIVE;
  notify();

  return cutInfo;
};

/**
 * Cancel current operation
 * - If in workflow (PENDING/DRAGGING/READY): reset to ACTIVE
 * - If just ACTIVE: deactivate completely
 */
export const cancel = () => {
  if (workflowState === CUT_STATE.INACTIVE) {
    return;
  }

  if (workflowState === CUT_STATE.ACTIVE) {
    deactivate();

    return;
  }

  cancelWorkflow();
};

/**
 * Get current workflow state
 */
export const getState = () => workflowState;

/**
 * Check if we're in the middle of a cut workflow
 */
export const isPending = () => {
  return workflowState === CUT_STATE.PENDING || workflowState === CUT_STATE.DRAGGING;
};

/**
 * Check if cut zone is ready for confirmation
 */
export const isReady = () => workflowState === CUT_STATE.READY;

/**
 * Get current cut zone info
 */
export const getCutZone = () => {
  if (workflowState === CUT_STATE.INACTIVE || workflowState === CUT_STATE.ACTIVE) {
    return null;
  }

  const displayStartTime = Math.min(startTime, endTime);
  const displayEndTime = Math.max(startTime, endTime);
  const displayStartPosX = Math.min(startPosX, endPosX);
  const displayEndPosX = Math.max(startPosX, endPosX);

  return {
    zone: activeZone,
    startTime: displayStartTime,
    endTime: displayEndTime,
    startPosX: displayStartPosX,
    endPosX: displayEndPosX,
    duration: displayEndTime - displayStartTime,
    state: workflowState
  };
};

/**
 * Validate cut region bounds
 * @param {Object} zone - Track zone to cut
 * @param {number} cutStartTime - Cut region start (absolute time)
 * @param {number} cutEndTime - Cut region end (absolute time)
 * @returns {{ valid: boolean, beforeDuration: number, afterDuration: number, relativeStart?: number, relativeEnd?: number, error?: string }}
 */
export const validateCutRegion = (zone, cutStartTime, cutEndTime) => {
  if (!zone) {
    return { valid: false, beforeDuration: 0, afterDuration: 0, error: 'No zone provided' };
  }

  const trackStart = zone.getStart();
  const trackEnd = zone.getEnd();
  const relativeStart = cutStartTime - trackStart;
  const relativeEnd = cutEndTime - trackStart;

  const beforeDuration = relativeStart;
  const afterDuration = trackEnd - cutEndTime;

  if (beforeDuration < TRACKS.MIN_CUT_DURATION && afterDuration < TRACKS.MIN_CUT_DURATION) {
    return {
      valid: false,
      beforeDuration,
      afterDuration,
      error: 'Cut would remove entire track'
    };
  }

  return {
    valid: true,
    beforeDuration,
    afterDuration,
    relativeStart,
    relativeEnd
  };
};

/**
 * Subscribe to state changes
 * @param {(data: { state: string, cutZone: any }) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export const onChange = callback => {
  listeners.add(callback);

  return () => listeners.delete(callback);
};

function reset() {
  workflowState = CUT_STATE.INACTIVE;
  resetWorkflow();
}

function resetWorkflow() {
  startPosX = null;
  endPosX = null;
  startTime = null;
  endTime = null;
  activeZone = null;
}

function cancelWorkflow() {
  resetWorkflow();
  workflowState = CUT_STATE.ACTIVE;
  notify();
}

function notify() {
  const data = {
    state: workflowState,
    cutZone: getCutZone()
  };

  listeners.forEach(cb => {
    try {
      cb(data);
    } catch (err) {
      console.error('[CutService] Listener error:', err);
    }
  });
}

export const __resetForTesting = () => {
  workflowState = CUT_STATE.INACTIVE;
  startPosX = null;
  endPosX = null;
  startTime = null;
  endTime = null;
  activeZone = null;
  listeners.clear();
};

export default {
  activate,
  deactivate,
  toggle,
  setStart,
  updateEnd,
  setEnd,
  confirm,
  cancel,
  getState,
  isActive,
  isPending,
  isReady,
  getCutZone,
  validateCutRegion,
  onChange
};
