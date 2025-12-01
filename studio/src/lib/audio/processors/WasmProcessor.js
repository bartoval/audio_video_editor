import AudioWorker from '../AudioWorker';
import IndexedDB from '../../../services/offline/IndexedDB';
import { getUuid as defaultGetUuid } from '../../../services/workspace';
import { audioBufferToWavBlob as defaultSerialize } from '../utils/AudioBufferSerializer';

/** No-op progress callback */
const noop = () => {};

/** Generate local derivedId for WASM-processed audio */
const generateDerivedId = (idTrack, stretchFactor, pitchValue) => {
  const stretchStr = stretchFactor.toFixed(1).replace('.', '_');
  const pitchStr = pitchValue >= 0 ? `p${pitchValue}` : `m${Math.abs(pitchValue)}`;

  return `${idTrack}-s${stretchStr}-${pitchStr}-local`;
};

/**
 * Create a WASM processor with injectable dependencies.
 * Default deps use workspace UUID, AudioBufferSerializer, and IndexedDB.
 */
export function createWasmProcessor({
  getUuid: injGetUuid,
  serializeBuffer: injSerialize,
  saveAudioBlob = (uuid, id, blob, opts) => IndexedDB.saveAudioBlob(uuid, id, blob, opts)
} = {}) {
  /** Time-stretch via WASM */
  const stretch = async (sourceBuffer, idTrack, stretchFactor, pitchValue) => {
    const getUuid = injGetUuid || defaultGetUuid;
    const serializeBuffer = injSerialize || defaultSerialize;

    const buffer = await AudioWorker.stretch(sourceBuffer, stretchFactor, pitchValue, noop);
    const derivedId = generateDerivedId(idTrack, stretchFactor, pitchValue);

    // Save to IndexedDB for persistence
    const uuid = getUuid();
    Promise.resolve(serializeBuffer(buffer))
      .then(blob => {
        saveAudioBlob(uuid, derivedId, blob, {
          isDerived: true,
          mimeType: 'audio/wav'
        });
      })
      .catch(err => {
        console.warn('[WasmProcessor] Failed to save derived to IDB:', err?.message || err);
      });

    return { buffer, duration: buffer.duration, derivedId };
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

  return { stretch, applyVolume, applyPan, applyVolumeAndPan };
}

export default createWasmProcessor();
