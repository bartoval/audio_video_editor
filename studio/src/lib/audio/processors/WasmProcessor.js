import AudioWorker from '../AudioWorker';

/** No-op progress callback */
const noop = () => {};

/** Time-stretch via WASM */
const stretch = async (sourceBuffer, idTrack, stretchFactor, pitchValue) => {
  const buffer = await AudioWorker.stretch(sourceBuffer, stretchFactor, pitchValue, noop);

  return { buffer, duration: buffer.duration };
};

/** Apply volume envelope via WASM */
const applyVolume = async (sourceBuffer, volumeData, defaultVolume) => {
  const buffer = await AudioWorker.applyVolume(sourceBuffer, volumeData, defaultVolume, noop);

  return { buffer };
};

/** Apply stereo pan via WASM */
const applyPan = async (sourceBuffer, panValue) => {
  const buffer = await AudioWorker.applyPan(sourceBuffer, panValue, noop);

  return { buffer };
};

/** Apply volume and pan in single pass via WASM */
const applyVolumeAndPan = async (sourceBuffer, volumeData, defaultVolume, panValue) => {
  const buffer = await AudioWorker.applyVolumeAndPan(
    sourceBuffer,
    volumeData,
    defaultVolume,
    panValue,
    noop
  );

  return { buffer };
};

export default { stretch, applyVolume, applyPan, applyVolumeAndPan };
