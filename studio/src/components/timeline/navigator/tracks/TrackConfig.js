/**
 * TrackConfig - Structured configuration for Track components
 *
 * Converts flat config to structured format and vice versa.
 * Provides type safety and clear organization of track parameters.
 */

// ============================================================================
// Config Structure
// ============================================================================

/**
 * @typedef {Object} TrackConfig
 * @property {number} id - Unique track identifier
 * @property {TrackInfo} track - Track display info
 * @property {AudioInfo} audio - Audio buffer and effects
 * @property {CutInfo} cut - Cut/slice boundaries
 * @property {TransformInfo} transform - Time stretch and pitch
 * @property {WaveformInfo} waveform - Waveform display data
 */

/**
 * @typedef {Object} TrackInfo
 * @property {number} idTrack - Audio library reference
 * @property {string} label - Display name
 * @property {number} startTime - Start position in timeline
 * @property {number} durationTime - Duration in seconds
 * @property {string} [groupId] - Group identifier
 */

/**
 * @typedef {Object} AudioInfo
 * @property {AudioBuffer} [buffer] - Web Audio buffer
 * @property {number} panValue - Pan position (-1 to 1)
 * @property {Array} volumeValues - Volume envelope data
 * @property {Object} [volumePaths] - Volume bezier paths for display
 */

/**
 * @typedef {Object} CutInfo
 * @property {number} start - Cut start position
 * @property {number} end - Cut end position
 * @property {number} startTimeCut - Cut start in buffer
 * @property {number} durationTimeCut - Cut duration
 * @property {boolean} isCut - Whether track is cut
 * @property {boolean} [isCutBuffer] - Buffer cut flag
 * @property {number} [startTimeBuffer] - Buffer start
 * @property {number} [endTimeBuffer] - Buffer end
 */

/**
 * @typedef {Object} TransformInfo
 * @property {number} stretchFactor - Time stretch (0.5 to 2.0)
 * @property {number} pitch - Pitch shift value
 */

/**
 * @typedef {Object} WaveformInfo
 * @property {Object} [path] - Waveform image data
 * @property {number} [viewBox] - Waveform viewBox offset
 */

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert flat config to structured format
 */
export const fromFlat = flat => {
  const {
    id,
    idTrack = -1,
    label = '',
    startTime = 0,
    durationTime = 0,
    groupId,
    buffer,
    panValue = 0,
    volumeValues = [],
    volumePaths,
    start = -1,
    end = -1,
    startTimeCut = 0,
    durationTimeCut,
    isCut = false,
    isCutBuffer,
    startTimeBuffer = 0,
    endTimeBuffer,
    stretchFactor = 1,
    pitch = 0,
    path,
    viewBox = 0
  } = flat;

  return {
    id,
    track: { idTrack, label, startTime, durationTime, groupId },
    audio: { buffer, panValue, volumeValues, volumePaths },
    cut: {
      start,
      end,
      startTimeCut,
      durationTimeCut: durationTimeCut ?? durationTime,
      isCut,
      isCutBuffer,
      startTimeBuffer,
      endTimeBuffer: endTimeBuffer ?? durationTime
    },
    transform: { stretchFactor, pitch },
    waveform: { path, viewBox }
  };
};

/**
 * Convert structured config to flat format (for export/clone)
 */
export const toFlat = structured => {
  const { id, track, audio, cut, transform, waveform } = structured;

  return {
    id,
    ...track,
    ...audio,
    ...cut,
    ...transform,
    ...waveform
  };
};

/**
 * Create default config with minimal required fields
 */
export const createDefault = (id, idTrack, startTime, durationTime) => ({
  id,
  track: { idTrack, label: '', startTime, durationTime },
  audio: { buffer: null, panValue: 0, volumeValues: [], volumePaths: null },
  cut: {
    start: -1,
    end: -1,
    startTimeCut: 0,
    durationTimeCut: durationTime,
    isCut: false,
    isCutBuffer: false,
    startTimeBuffer: 0,
    endTimeBuffer: durationTime
  },
  transform: { stretchFactor: 1, pitch: 0 },
  waveform: { path: null, viewBox: 0 }
});
