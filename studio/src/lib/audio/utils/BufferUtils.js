import { AudioError } from '../errors/AudioError';

/** Crop buffer to time range */
export const crop = (buffer, start, end) => {
  if (start <= -1 || end <= -1) {
    return buffer;
  }

  const { sampleRate, numberOfChannels, length } = buffer;
  const startSample = ~~(start * sampleRate);
  const endSample = Math.min(~~(end * sampleRate), length);
  const newLength = endSample - startSample;

  const cropped = window.audioContextInstance.createBuffer(numberOfChannels, newLength, sampleRate);

  for (let i = 0; i < numberOfChannels; i++) {
    cropped.getChannelData(i).set(buffer.getChannelData(i).subarray(startSample, endSample));
  }

  return cropped;
};

/** Decode ArrayBuffer to AudioBuffer */
export const decode = arrayBuffer => {
  return new Promise((resolve, reject) => {
    window.audioContextInstance.decodeAudioData(arrayBuffer, resolve, err =>
      reject(AudioError.decode(err))
    );
  });
};

/** Extract channel data from AudioBuffer */
export const extractChannels = buffer => {
  const { numberOfChannels } = buffer;
  const channels = [];

  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(new Float32Array(buffer.getChannelData(i)));
  }

  return channels;
};

/** Create AudioBuffer from channel data */
export const createFromChannels = (channels, length, sampleRate) => {
  const buffer = window.audioContextInstance.createBuffer(channels.length, length, sampleRate);

  channels.forEach((data, i) => buffer.getChannelData(i).set(data));

  return buffer;
};

export default { crop, decode, extractChannels, createFromChannels };
