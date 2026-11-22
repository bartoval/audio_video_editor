// @ts-check

/**
 * Waveform peaks: a compact min/max summary of a whole audio file, computed once and
 * stored, so a waveform can be drawn without decoding the file again.
 *
 * Layout: one bucket per BUCKET_FRAMES frames, all channels merged.
 * data[2 * i] is the bucket's max, data[2 * i + 1] its min (same order as the
 * waveform paths built from AudioBuffers).
 */

/** @typedef {{ x: number, y: number }} WaveformPoint */

/**
 * @typedef {Object} Peaks
 * @property {number} sampleRate - frames per second of the source the peaks were computed from
 * @property {number} length - total frames of the source
 * @property {number} bucket - frames summarized by one min/max pair
 * @property {Float32Array} data - interleaved max/min, 2 values per bucket
 */

export const BUCKET_FRAMES = 256;

/** Buckets reduced before yielding to the event loop (~2M frames) */
const BUCKETS_PER_SLICE = 8192;

/**
 * Reduce buckets [from, to) of the channels into `data`.
 * @param {Float32Array[]} channels
 * @param {number} length
 * @param {number} bucket
 * @param {Float32Array} data
 * @param {number} from
 * @param {number} to
 */
export function reduceBuckets(channels, length, bucket, data, from, to) {
  for (let b = from; b < to; b++) {
    const start = b * bucket;
    const end = Math.min(start + bucket, length);
    let max = 0;
    let min = 0;

    for (let c = 0; c < channels.length; c++) {
      const channel = channels[c];

      for (let i = start; i < end; i++) {
        const value = channel[i];

        if (value > max) max = value;
        if (value < min) min = value;
      }
    }

    data[b << 1] = max;
    data[(b << 1) + 1] = min;
  }
}

/**
 * Compute peaks synchronously.
 * @param {Float32Array[]} channels
 * @param {number} length
 * @param {number} sampleRate
 * @param {number} [bucket]
 * @returns {Peaks}
 */
export function computePeaks(channels, length, sampleRate, bucket = BUCKET_FRAMES) {
  const buckets = Math.ceil(length / bucket);
  const data = new Float32Array(buckets * 2);

  reduceBuckets(channels, length, bucket, data, 0, buckets);

  return { sampleRate, length, bucket, data };
}

/**
 * Compute peaks of an AudioBuffer in slices, yielding between them so a long file
 * never blocks the main thread for more than a few milliseconds.
 * @param {AudioBuffer} audioBuffer
 * @param {number} [bucket]
 * @returns {Promise<Peaks>}
 */
export async function computePeaksFromBuffer(audioBuffer, bucket = BUCKET_FRAMES) {
  const { length, sampleRate, numberOfChannels } = audioBuffer;
  const channels = [];

  for (let c = 0; c < numberOfChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  const buckets = Math.ceil(length / bucket);
  const data = new Float32Array(buckets * 2);

  for (let from = 0; from < buckets; from += BUCKETS_PER_SLICE) {
    reduceBuckets(
      channels,
      length,
      bucket,
      data,
      from,
      Math.min(from + BUCKETS_PER_SLICE, buckets)
    );

    if (from + BUCKETS_PER_SLICE < buckets) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return { sampleRate, length, bucket, data };
}

/**
 * Whether the peaks are fine enough to draw at this zoom (one pixel must cover at
 * least one bucket). Finer zooms need the decoded audio.
 * @param {Peaks} peaks
 * @param {number} secondsPerPixel
 */
export function canDrawAt(peaks, secondsPerPixel) {
  return secondsPerPixel * peaks.sampleRate >= peaks.bucket;
}

/**
 * Frame range of a time range in seconds. Negative bounds mean "from the start" /
 * "to the end", like the crop of the audio buffers.
 * @param {Peaks} peaks
 * @param {number} [start]
 * @param {number} [end]
 */
export function frameRange(peaks, start = -1, end = -1) {
  if (start <= -1 || end <= -1) {
    return { startFrame: 0, endFrame: peaks.length };
  }

  const startFrame = Math.max(0, Math.floor(start * peaks.sampleRate));
  const endFrame = Math.min(Math.floor(end * peaks.sampleRate), peaks.length);

  return { startFrame, endFrame: Math.max(startFrame, endFrame) };
}

/**
 * Build a waveform path of `pixels` columns over a time range, in the same
 * {x, y} max/min format the waveform views draw.
 * @param {Peaks} peaks
 * @param {{ pixels: number, start?: number, end?: number }} options
 * @returns {WaveformPoint[]}
 */
export function peaksToPath(peaks, { pixels, start = -1, end = -1 }) {
  const columns = Math.max(1, Math.floor(pixels));
  const { startFrame, endFrame } = frameRange(peaks, start, end);
  const framesPerPixel = (endFrame - startFrame) / columns;
  const { data, bucket } = peaks;
  const buckets = data.length >> 1;
  const path = new Array(columns * 2);

  for (let i = 0; i < columns; i++) {
    const from = Math.floor((startFrame + i * framesPerPixel) / bucket);
    const to = Math.min(
      buckets,
      Math.max(from + 1, Math.ceil((startFrame + (i + 1) * framesPerPixel) / bucket))
    );
    let max = 0;
    let min = 0;

    for (let b = from; b < to; b++) {
      const bucketMax = data[b << 1];
      const bucketMin = data[(b << 1) + 1];

      if (bucketMax > max) max = bucketMax;
      if (bucketMin < min) min = bucketMin;
    }

    path[i << 1] = { x: i, y: max };
    path[(i << 1) + 1] = { x: i, y: min };
  }

  return path;
}
