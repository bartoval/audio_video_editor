/**
 * Music time utilities for bar/beat calculations
 */

/**
 * Calculate bar and beat position from time
 * @param {number} seconds - Time in seconds
 * @param {number} bpm - Beats per minute
 * @param {string} timeSignature - Time signature (e.g., "4/4", "3/4")
 * @returns {{ bar: number, beat: number, fraction: number }}
 */
export const calculateBarBeat = (seconds, bpm = 120, timeSignature = '4/4') => {
  if (!bpm || bpm <= 0) {
    return { bar: 0, beat: 0, fraction: 0 };
  }

  const [beatsPerBar] = timeSignature.split('/').map(Number);
  const secondsPerBeat = 60 / bpm;
  const totalBeats = seconds / secondsPerBeat;

  const bar = Math.floor(totalBeats / beatsPerBar) + 1; // 1-indexed
  const beat = Math.floor(totalBeats % beatsPerBar) + 1; // 1-indexed
  const fraction = totalBeats % 1; // Fractional beat (0-1)

  return { bar, beat, fraction };
};

/**
 * Format bar/beat for display
 * @param {number} bar - Bar number (1-indexed)
 * @param {number} beat - Beat number (1-indexed)
 * @returns {string} - Formatted string "Bar.Beat"
 */
export const formatBarBeat = (bar, beat) => {
  return `${bar}.${beat}`;
};

/**
 * Parse time signature string
 * @param {string} timeSignature - e.g., "4/4", "3/4"
 * @returns {{ beatsPerBar: number, beatValue: number }}
 */
export const parseTimeSignature = (timeSignature = '4/4') => {
  const [beatsPerBar, beatValue] = timeSignature.split('/').map(Number);
  return { beatsPerBar, beatValue };
};

/**
 * Calculate time from bar/beat position
 * @param {number} bar - Bar number (1-indexed)
 * @param {number} beat - Beat number (1-indexed)
 * @param {number} bpm - Beats per minute
 * @param {string} timeSignature - Time signature
 * @returns {number} - Time in seconds
 */
export const barBeatToSeconds = (bar, beat, bpm = 120, timeSignature = '4/4') => {
  const [beatsPerBar] = timeSignature.split('/').map(Number);
  const secondsPerBeat = 60 / bpm;

  const totalBeats = (bar - 1) * beatsPerBar + (beat - 1);
  return totalBeats * secondsPerBeat;
};
