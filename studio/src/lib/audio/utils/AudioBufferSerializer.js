/**
 * AudioBufferSerializer - serialize/deserialize AudioBuffer for IDB storage
 *
 * Two approaches:
 * 1. serializeAudioBuffer/deserializeAudioBuffer: For processed AudioBuffers (stretched, etc)
 *    Stores raw Float32Array channel data
 * 2. blobToAudioBuffer: For server-fetched blobs (WAV/MP3/OGG)
 *    Decodes on-demand, more efficient for original files
 */

import { extractChannels, createFromChannels, decode } from './BufferUtils';

/**
 * Serialize AudioBuffer to a storable object
 * Use this for derived/processed buffers that need to be restored exactly
 *
 * @param {AudioBuffer} audioBuffer - The AudioBuffer to serialize
 * @returns {Object} Serializable object with channel data
 */
export const serializeAudioBuffer = audioBuffer => {
  if (!audioBuffer) {
    return null;
  }

  const { sampleRate, length, numberOfChannels, duration } = audioBuffer;
  const channels = extractChannels(audioBuffer);

  return {
    sampleRate,
    length,
    numberOfChannels,
    duration,
    channels // Array of Float32Array
  };
};

/**
 * Deserialize object back to AudioBuffer
 *
 * @param {Object} data - Serialized audio data
 * @param {AudioContext} audioContext - AudioContext to create buffer (optional, uses global)
 * @returns {AudioBuffer} Reconstructed AudioBuffer
 */
export const deserializeAudioBuffer = (data, audioContext = null) => {
  if (!data || !data.channels || !data.length || !data.sampleRate) {
    return null;
  }

  const ctx = audioContext || window.audioContextInstance;

  if (!ctx) {
    throw new Error('No AudioContext available for deserialization');
  }

  return createFromChannels(data.channels, data.length, data.sampleRate);
};

/**
 * Convert Blob to AudioBuffer by decoding
 * Use this for server-fetched audio files (WAV/MP3/OGG)
 *
 * @param {Blob} blob - Audio blob
 * @returns {Promise<AudioBuffer>} Decoded AudioBuffer
 */
export const blobToAudioBuffer = async blob => {
  if (!blob) {
    return null;
  }

  const arrayBuffer = await blob.arrayBuffer();

  return decode(arrayBuffer);
};

/**
 * Convert AudioBuffer to WAV Blob for storage
 * Useful when you need to store a processed buffer as a standard audio file
 *
 * @param {AudioBuffer} audioBuffer - The AudioBuffer to convert
 * @returns {Blob} WAV format Blob
 */
export const audioBufferToWavBlob = audioBuffer => {
  if (!audioBuffer) {
    return null;
  }

  const { numberOfChannels, sampleRate, length } = audioBuffer;

  // Interleave channels
  const interleaved = new Float32Array(length * numberOfChannels);

  for (let channel = 0; channel < numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);

    for (let i = 0; i < length; i++) {
      interleaved[i * numberOfChannels + channel] = channelData[i];
    }
  }

  // Convert to 16-bit PCM
  const pcmData = new Int16Array(interleaved.length);

  for (let i = 0; i < interleaved.length; i++) {
    const sample = Math.max(-1, Math.min(1, interleaved[i]));
    pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  // Build WAV file
  const wavBuffer = createWavBuffer(pcmData, numberOfChannels, sampleRate);

  return new Blob([wavBuffer], { type: 'audio/wav' });
};

/**
 * Create WAV file buffer from PCM data
 * @private
 */
const createWavBuffer = (pcmData, numChannels, sampleRate) => {
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length * bytesPerSample;
  const bufferSize = 44 + dataSize;

  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM data
  const pcmOffset = 44;

  for (let i = 0; i < pcmData.length; i++) {
    view.setInt16(pcmOffset + i * 2, pcmData[i], true);
  }

  return buffer;
};

/**
 * Write string to DataView
 * @private
 */
const writeString = (view, offset, string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

export default {
  serializeAudioBuffer,
  deserializeAudioBuffer,
  blobToAudioBuffer,
  audioBufferToWavBlob
};
