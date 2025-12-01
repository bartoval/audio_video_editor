/**
 * Audio time utilities for sample calculations
 */

/**
 * Calculate sample position from time
 * @param {number} seconds - Time in seconds
 * @param {number} sampleRate - Sample rate (e.g., 48000)
 * @returns {number} - Sample position (0-indexed)
 */
export const calculateSample = (seconds, sampleRate = 48000) => {
  if (!sampleRate || sampleRate <= 0) {
    return 0;
  }

  return Math.floor(seconds * sampleRate);
};

/**
 * Format sample position for display
 * @param {number} sample - Sample number
 * @returns {string} - Formatted string "S0123456"
 */
export const formatSample = sample => {
  return `S${sample.toString().padStart(7, '0')}`;
};

/**
 * Calculate time from sample position
 * @param {number} sample - Sample position
 * @param {number} sampleRate - Sample rate
 * @returns {number} - Time in seconds
 */
export const sampleToSeconds = (sample, sampleRate = 48000) => {
  if (!sampleRate || sampleRate <= 0) {
    return 0;
  }

  return sample / sampleRate;
};
