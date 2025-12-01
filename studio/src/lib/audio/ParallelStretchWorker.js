/**
 * ParallelStretchWorker - Manages parallel audio stretching using multiple workers
 *
 * Splits audio into chunks with overlap, processes in parallel, then crossfades
 * to merge results without artifacts.
 */

import { ASSETS } from '../../config/routes';
import { getParallelWorkerCount } from './wasm';
import { extractChannels, createFromChannels } from './utils/BufferUtils';

// Overlap duration in seconds for crossfade between chunks
const OVERLAP_SECONDS = 0.5;

// Minimum chunk duration in seconds (don't parallelize very short audio)
const MIN_CHUNK_SECONDS = 2;

const WORKER_TIMEOUT = 30000;

// ============================================================================
// Worker Pool Management
// ============================================================================

let workerPool = [];
let poolReady = false;
let poolPromise = null;

/** Initialize a single worker */
const initWorker = () =>
  new Promise((resolve, reject) => {
    const worker = new Worker(ASSETS.stretchWorker);

    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('[ParallelStretch] Worker timeout'));
    }, WORKER_TIMEOUT);

    worker.onmessage = ({ data: { type, error } }) => {
      if (type === 'ready') {
        clearTimeout(timeout);
        resolve(worker);
      } else if (type === 'error') {
        clearTimeout(timeout);
        reject(new Error(error));
      }
    };

    worker.onerror = event => {
      clearTimeout(timeout);
      reject(event);
    };
  });

/** Initialize worker pool */
const initPool = async () => {
  if (poolReady) {
    return workerPool;
  }

  if (poolPromise) {
    return poolPromise;
  }

  poolPromise = (async () => {
    const count = getParallelWorkerCount();
    console.log(`[ParallelStretch] Initializing ${count} workers...`);

    const workers = await Promise.all(Array.from({ length: count }, () => initWorker()));

    workerPool = workers;
    poolReady = true;
    console.log(`[ParallelStretch] Pool ready with ${workers.length} workers`);

    return workers;
  })();

  return poolPromise;
};

/** Terminate all workers in pool */
const terminatePool = () => {
  workerPool.forEach(w => w.terminate());
  workerPool = [];
  poolReady = false;
  poolPromise = null;
};

// ============================================================================
// Chunk Processing
// ============================================================================

/** Process a single chunk with a worker */
const processChunk = (worker, chunkChannels, sampleRate, stretchFactor, pitchValue) =>
  new Promise((resolve, reject) => {
    const handler = ({ data: { type, error, channelBuffers, actualLength } }) => {
      if (type === 'complete') {
        worker.removeEventListener('message', handler);
        resolve({ channelBuffers, actualLength });

        return;
      }

      if (type === 'error') {
        worker.removeEventListener('message', handler);
        reject(new Error(error));
      }
      // Ignore progress messages for chunks
    };

    worker.addEventListener('message', handler);

    // Send chunk to worker
    worker.postMessage(
      {
        type: 'stretch',
        data: {
          channelBuffers: chunkChannels,
          sampleRate,
          stretchFactor,
          pitchValue
        }
      },
      chunkChannels.map(ch => ch.buffer)
    );
  });

// ============================================================================
// Crossfade Logic
// ============================================================================

/** Apply crossfade between two overlapping regions */
const crossfade = (chunk1, chunk2, overlapSamples) => {
  const result = new Float32Array(chunk1.length + chunk2.length - overlapSamples);

  // Copy non-overlapping part of chunk1
  const chunk1NonOverlap = chunk1.length - overlapSamples;
  result.set(chunk1.subarray(0, chunk1NonOverlap), 0);

  // Crossfade in overlap region
  for (let i = 0; i < overlapSamples; i++) {
    const fadeOut = 1 - i / overlapSamples; // 1 → 0
    const fadeIn = i / overlapSamples; // 0 → 1

    const sample1 = chunk1[chunk1NonOverlap + i] * fadeOut;
    const sample2 = chunk2[i] * fadeIn;

    result[chunk1NonOverlap + i] = sample1 + sample2;
  }

  // Copy non-overlapping part of chunk2
  result.set(chunk2.subarray(overlapSamples), chunk1.length);

  return result;
};

/** Merge all processed chunks with crossfade */
const mergeChunks = (processedChunks, overlapSamples, numberOfChannels) => {
  if (processedChunks.length === 1) {
    return processedChunks[0].channelBuffers;
  }

  const mergedChannels = [];

  for (let ch = 0; ch < numberOfChannels; ch++) {
    let merged = processedChunks[0].channelBuffers[ch];

    for (let i = 1; i < processedChunks.length; i++) {
      const nextChunk = processedChunks[i].channelBuffers[ch];
      merged = crossfade(merged, nextChunk, overlapSamples);
    }

    mergedChannels.push(merged);
  }

  return mergedChannels;
};

// ============================================================================
// Main Parallel Stretch Function
// ============================================================================

/**
 * Stretch audio using parallel workers
 * @param {AudioBuffer} audioBuffer - Input audio
 * @param {number} stretchFactor - Time ratio (>1 = faster, <1 = slower)
 * @param {number} pitchValue - Pitch shift in semitones
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<AudioBuffer>} Stretched audio
 */
const stretchParallel = async (audioBuffer, stretchFactor, pitchValue = 0, onProgress = null) => {
  const startTime = performance.now();
  const { sampleRate, numberOfChannels, length } = audioBuffer;
  const duration = length / sampleRate;

  // For short audio, don't parallelize (overhead not worth it)
  const workerCount = getParallelWorkerCount();

  if (duration < MIN_CHUNK_SECONDS * workerCount) {
    console.log('[ParallelStretch] Audio too short, falling back to single worker');

    return null; // Signal to use single worker
  }

  await initPool();

  const overlapSamples = Math.floor(OVERLAP_SECONDS * sampleRate);
  const channels = extractChannels(audioBuffer);

  // Calculate chunk boundaries with overlap
  const chunkDuration = duration / workerCount;
  const chunkSamples = Math.floor(chunkDuration * sampleRate);

  const chunks = [];

  for (let i = 0; i < workerPool.length; i++) {
    const startSample = Math.max(0, i * chunkSamples - (i > 0 ? overlapSamples : 0));
    const endSample = Math.min(
      length,
      (i + 1) * chunkSamples + (i < workerPool.length - 1 ? overlapSamples : 0)
    );

    const chunkChannels = channels.map(ch => {
      const chunk = new Float32Array(endSample - startSample);
      chunk.set(ch.subarray(startSample, endSample));

      return chunk;
    });

    chunks.push({
      index: i,
      channels: chunkChannels,
      startSample,
      endSample
    });
  }

  console.log(
    `[ParallelStretch] Processing ${chunks.length} chunks | ` +
      `duration: ${duration.toFixed(2)}s | overlap: ${OVERLAP_SECONDS}s`
  );

  onProgress?.(10);

  // Process all chunks in parallel
  const processPromises = chunks.map((chunk, i) =>
    processChunk(workerPool[i], chunk.channels, sampleRate, stretchFactor, pitchValue).then(
      result => {
        onProgress?.(10 + ((i + 1) / chunks.length) * 80);

        return { ...result, index: chunk.index };
      }
    )
  );

  const processedChunks = await Promise.all(processPromises);

  // Sort by index (in case they complete out of order)
  processedChunks.sort((a, b) => a.index - b.index);

  onProgress?.(90);

  // Calculate overlap in output (scaled by stretch factor)
  const outputOverlapSamples = Math.floor(overlapSamples * stretchFactor);

  // Merge chunks with crossfade
  const mergedChannels = mergeChunks(processedChunks, outputOverlapSamples, numberOfChannels);

  const totalLength = mergedChannels[0].length;
  const result = createFromChannels(mergedChannels, totalLength, sampleRate);

  const elapsed = performance.now() - startTime;
  console.log(
    `[ParallelStretch] Complete | ${workerPool.length} workers | ` +
      `${elapsed.toFixed(0)}ms | speedup: ~${((duration * 1000) / elapsed).toFixed(1)}x realtime`
  );

  onProgress?.(100);

  return result;
};

/** Check if pool is ready */
const isReady = () => poolReady;

/** Get current pool size */
const getPoolSize = () => workerPool.length;

export default {
  stretchParallel,
  initPool,
  terminatePool,
  isReady,
  getPoolSize
};
