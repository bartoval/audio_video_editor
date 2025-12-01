/**
 * TrackConfig - Structured configuration for Track components
 *
 * Converts flat config to structured format and vice versa.
 * Provides type safety and clear organization of track parameters.
 */

/**
 * Convert flat config to structured format
 */
export const fromFlat = flat => {
  const {
    id,
    idTrack = -1,
    derivedId = null,
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
    gain = 1,
    path,
    viewBox = 0
  } = flat;

  return {
    id,
    track: { idTrack, derivedId, label, startTime, durationTime, groupId },
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
    transform: { stretchFactor, pitch, gain },
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
  transform: { stretchFactor: 1, pitch: 0, gain: 1 },
  waveform: { path: null, viewBox: 0 }
});
