/**
 * Video time utilities for frame calculations
 */

/**
 * Calculate frame number from time
 * @param {number} seconds - Time in seconds
 * @param {number} fps - Frames per second
 * @returns {number} - Frame number (0-indexed)
 */
export const calculateFrame = (seconds, fps = 24) => {
  if (!fps || fps <= 0) {
    return 0;
  }

  return Math.floor(seconds * fps);
};

/**
 * Calculate SMPTE timecode from seconds
 * @param {number} seconds - Time in seconds
 * @param {number} fps - Frames per second
 * @returns {{ hours: number, minutes: number, seconds: number, frames: number }}
 */
export const calculateTimecode = (seconds, fps = 24) => {
  const totalFrames = Math.floor(seconds * fps);
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const secs = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  return { hours, minutes, seconds: secs, frames };
};

/**
 * Format frame number for display
 * @param {number} frame - Frame number
 * @param {number} fps - Frames per second
 * @returns {string} - Formatted string "F00123 @24fps"
 */
export const formatFrame = (frame, fps) => {
  return `F${frame.toString().padStart(5, '0')} @${fps}fps`;
};

/**
 * Format SMPTE timecode
 * @param {number} hours
 * @param {number} minutes
 * @param {number} seconds
 * @param {number} frames
 * @returns {string} - Formatted "HH:MM:SS:FF"
 */
export const formatTimecode = (hours, minutes, seconds, frames) => {
  const pad = num => num.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
};

/**
 * Calculate time from frame number
 * @param {number} frame - Frame number
 * @param {number} fps - Frames per second
 * @returns {number} - Time in seconds
 */
export const frameToSeconds = (frame, fps = 24) => {
  if (!fps || fps <= 0) {
    return 0;
  }

  return frame / fps;
};
