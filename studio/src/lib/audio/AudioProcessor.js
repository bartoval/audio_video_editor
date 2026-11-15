import { isWasmEnabled, isWorkerEnabled } from './wasm';
import WasmProcessor from './processors/WasmProcessor';
import { AUDIO } from '../../config/constants';

const { MAX_DURATION_WASM } = AUDIO;

/** Processing remains local; never silently fall back to a server request. */
const getProcessor = buffer => {
  if (!isWasmEnabled() || !isWorkerEnabled()) {
    throw new Error('Local audio processing requires WASM and Worker support.');
  }
  if (buffer?.duration > MAX_DURATION_WASM) {
    throw new Error(
      `Local audio processing supports clips up to ${MAX_DURATION_WASM / 60} minutes. Split the clip first.`
    );
  }
  return WasmProcessor;
};

/** Time-stretch audio */
export const stretch = async (buffer, idTrack, stretchFactor, pitchValue, context) => {
  const sourceBuffer = context.originalBuffer || (await buffer);

  if (!context.originalBuffer) {
    context.originalBuffer = sourceBuffer;
  }

  const processor = getProcessor(sourceBuffer);
  const processorName = 'WASM (Worker)';
  console.log(
    `[AudioProcessor] stretch via ${processorName} | factor: ${stretchFactor} | pitch: ${pitchValue}`
  );

  return processor.stretch(sourceBuffer, idTrack, stretchFactor, pitchValue, context);
};

/** Apply volume envelope */
export const applyVolume = async (buffer, volumeData, defaultVolume) => {
  const sourceBuffer = await buffer;

  return getProcessor(sourceBuffer).applyVolume(sourceBuffer, volumeData, defaultVolume);
};

/** Apply stereo pan */
export const applyPan = async (buffer, panValue) => {
  const sourceBuffer = await buffer;

  return getProcessor(sourceBuffer).applyPan(sourceBuffer, panValue);
};

/** Apply volume and pan in single pass */
export const applyVolumeAndPan = async (buffer, volumeData, defaultVolume, panValue) => {
  const sourceBuffer = await buffer;

  return getProcessor(sourceBuffer).applyVolumeAndPan(
    sourceBuffer,
    volumeData,
    defaultVolume,
    panValue
  );
};

/** Get processed buffer for export */
export const getProcessedBuffer = async (buffer, volumeData, defaultVolume, panValue) => {
  const sourceBuffer = await buffer;
  const hasVolume = volumeData?.length > 0;
  const hasPan = panValue !== 0;

  if (!hasVolume && !hasPan) {
    return sourceBuffer;
  }

  const processor = getProcessor(sourceBuffer);

  if (hasVolume && hasPan) {
    return processor.applyVolumeAndPan(sourceBuffer, volumeData, defaultVolume, panValue);
  }

  if (hasVolume) {
    return processor.applyVolume(sourceBuffer, volumeData, defaultVolume);
  }

  return processor.applyPan(sourceBuffer, panValue);
};

export default { stretch, applyVolume, applyPan, applyVolumeAndPan, getProcessedBuffer };
