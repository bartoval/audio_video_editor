// @ts-check

/**
 * WaveformPeaks - stores the min/max peaks of each audio file (original or derived),
 * so waveforms are drawn without decoding the file again.
 *
 * Peaks are derived data: when missing they are rebuilt from the audio, either from a
 * buffer that is already decoded (saveFromBuffer) or by decoding the file once (ensure).
 * Decoding for peaks runs one file at a time to bound memory.
 */

import IndexedDB, { STORES } from './IndexedDB';
import { computePeaksFromBuffer } from '../../lib/audio/peaks';

/** @typedef {import('../../lib/audio/peaks').Peaks} Peaks */

const MEMORY_LIMIT = 32;

/** @type {Map<string, Peaks>} recently used peaks, oldest first */
const memory = new Map();

/** @type {Map<string, Promise<Peaks | null>>} */
const inFlight = new Map();

/** @type {Promise<unknown>} serializes decoding */
let decodeQueue = Promise.resolve();

const keyFor = (uuid, id) => `${uuid}:${id}`;
const db = () => IndexedDB.getInstance();

/**
 * @param {string} key
 * @param {Peaks} peaks
 */
function remember(key, peaks) {
  memory.delete(key);
  memory.set(key, peaks);

  if (memory.size > MEMORY_LIMIT) {
    memory.delete(memory.keys().next().value);
  }
}

/**
 * @param {string} uuid
 * @param {string} id
 * @param {Peaks} peaks
 * @returns {Promise<Peaks>}
 */
async function persist(uuid, id, peaks) {
  const key = keyFor(uuid, id);
  remember(key, peaks);

  try {
    await db().put(STORES.WAVEFORM_PEAKS, {
      key,
      workspaceUuid: uuid,
      id,
      sampleRate: peaks.sampleRate,
      length: peaks.length,
      bucket: peaks.bucket,
      data: peaks.data,
      updatedAt: Date.now()
    });
  } catch (error) {
    console.warn('[WaveformPeaks] Failed to store peaks:', error?.message);
  }

  return peaks;
}

/**
 * @param {Blob} blob
 * @returns {Promise<AudioBuffer>}
 */
async function decode(blob) {
  const sampleRate = window.audioContextInstance?.sampleRate || 48000;
  const context = new OfflineAudioContext(1, 1, sampleRate);

  return context.decodeAudioData(await blob.arrayBuffer());
}

/**
 * Stored peaks of a file, or null.
 * @param {string} uuid
 * @param {string} id
 * @returns {Promise<Peaks | null>}
 */
export async function get(uuid, id) {
  const key = keyFor(uuid, id);
  const cached = memory.get(key);

  if (cached) {
    remember(key, cached);

    return cached;
  }

  try {
    const record = await db().get(STORES.WAVEFORM_PEAKS, key);

    if (!record?.data) {
      return null;
    }

    const peaks = {
      sampleRate: record.sampleRate,
      length: record.length,
      bucket: record.bucket,
      data: record.data
    };
    remember(key, peaks);

    return peaks;
  } catch {
    return null;
  }
}

/**
 * Store the peaks of an already decoded file, unless they are stored already.
 * @param {string} uuid
 * @param {string} id
 * @param {AudioBuffer} audioBuffer - the whole file, not a cropped part
 * @returns {Promise<Peaks | null>}
 */
export function saveFromBuffer(uuid, id, audioBuffer) {
  const key = keyFor(uuid, id);
  const running = inFlight.get(key);

  if (running) {
    return running;
  }

  const job = (async () => {
    const stored = await get(uuid, id);

    if (stored) {
      return stored;
    }

    return persist(uuid, id, await computePeaksFromBuffer(audioBuffer));
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, job);

  return job;
}

/**
 * Peaks of a file, decoding it once when they are missing.
 * @param {string} uuid
 * @param {string} id
 * @param {() => Blob | null | undefined | Promise<Blob | null | undefined>} getBlob
 * @returns {Promise<Peaks | null>}
 */
export function ensure(uuid, id, getBlob) {
  const key = keyFor(uuid, id);
  const running = inFlight.get(key);

  if (running) {
    return running;
  }

  const job = (async () => {
    const stored = await get(uuid, id);

    if (stored) {
      return stored;
    }

    const decoded = decodeQueue.then(async () => {
      const blob = await getBlob();

      if (!blob) {
        return null;
      }

      return persist(uuid, id, await computePeaksFromBuffer(await decode(blob)));
    });
    decodeQueue = decoded.catch(() => {});

    return decoded;
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, job);

  return job;
}

/**
 * Forget the peaks of a deleted file.
 * @param {string} uuid
 * @param {string} id
 */
export async function remove(uuid, id) {
  const key = keyFor(uuid, id);
  memory.delete(key);
  await db().delete(STORES.WAVEFORM_PEAKS, key);
}

/** Clear the in-memory cache (tests). */
export function clearMemory() {
  memory.clear();
  inFlight.clear();
  decodeQueue = Promise.resolve();
}
