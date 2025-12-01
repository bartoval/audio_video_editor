import { setWasmLoaded, isParallelStretchEnabled } from './wasm';
import { AudioError } from './errors/AudioError';
import { extractChannels, createFromChannels } from './utils/BufferUtils';
import { ASSETS } from '../../config/routes';
import ParallelStretchWorker from './ParallelStretchWorker';

const WORKER_TIMEOUT = 10000;

export default (() => {
  let stretchWorker = null;
  let processorWorker = null;
  let stretchPromise = null;
  let processorPromise = null;

  /** Initialize worker with ready signal */
  const initWorker = path =>
    new Promise((resolve, reject) => {
      const worker = new Worker(path);
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(AudioError.workerTimeout(path));
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

  /** Load stretch worker (rubberband WASM) */
  const loadStretch = () => {
    if (stretchWorker) {
      return Promise.resolve(stretchWorker);
    }

    if (!stretchPromise) {
      stretchPromise = initWorker(ASSETS.stretchWorker)
        .then(worker => {
          stretchWorker = worker;
          setWasmLoaded(true);

          return worker;
        })
        .catch(error => {
          stretchPromise = null;
          setWasmLoaded(false);
          console.error('[AudioWorker] Stretch worker failed:', error);
          throw error;
        });
    }

    return stretchPromise;
  };

  /** Load processor worker (volume/pan) */
  const loadProcessor = () => {
    if (processorWorker) {
      return Promise.resolve(processorWorker);
    }

    if (!processorPromise) {
      processorPromise = initWorker(ASSETS.processorWorker)
        .then(worker => {
          processorWorker = worker;

          return worker;
        })
        .catch(error => {
          processorPromise = null;
          console.error('[AudioWorker] Processor worker failed:', error);
          throw error;
        });
    }

    return processorPromise;
  };

  /** Handle worker message and resolve with AudioBuffer */
  const handleWorkerMessage = (worker, { sampleRate }, resolve, reject, onProgress) => {
    const handler = ({ data: { type, error, percent, channelBuffers, actualLength } }) => {
      if (type === 'progress' && onProgress) {
        onProgress(percent);

        return;
      }

      if (type === 'complete') {
        worker.removeEventListener('message', handler);
        onProgress?.(100);
        resolve(createFromChannels(channelBuffers, actualLength, sampleRate));

        return;
      }

      if (type === 'error') {
        worker.removeEventListener('message', handler);
        reject(new Error(error));
      }
    };

    worker.addEventListener('message', handler);
  };

  /** Send message to worker with transferable buffers */
  const postToWorker = (worker, type, data, channelBuffers) => {
    worker.postMessage(
      { type, data: { ...data, channelBuffers } },
      channelBuffers.map(buf => buf.buffer)
    );
  };

  /** Time-stretch and pitch-shift (single worker) */
  const stretchSingle = async (audioBuffer, stretchFactor, pitchValue = 0, onProgress = null) => {
    await loadStretch();

    const startTime = performance.now();
    const { sampleRate, length } = audioBuffer;
    const duration = length / sampleRate;
    const channelBuffers = extractChannels(audioBuffer);

    return new Promise((resolve, reject) => {
      const wrappedResolve = result => {
        const elapsed = performance.now() - startTime;
        console.log(
          `[AudioWorker] Single worker stretch | ${elapsed.toFixed(0)}ms | ` +
            `${duration.toFixed(2)}s audio | speedup: ~${((duration * 1000) / elapsed).toFixed(1)}x realtime`
        );
        resolve(result);
      };

      handleWorkerMessage(stretchWorker, audioBuffer, wrappedResolve, reject, onProgress);
      postToWorker(
        stretchWorker,
        'stretch',
        { sampleRate, stretchFactor, pitchValue },
        channelBuffers
      );
    });
  };

  /** Time-stretch and pitch-shift (auto-select single or parallel) */
  const stretch = async (audioBuffer, stretchFactor, pitchValue = 0, onProgress = null) => {
    // Try parallel if enabled
    if (isParallelStretchEnabled()) {
      try {
        const result = await ParallelStretchWorker.stretchParallel(
          audioBuffer,
          stretchFactor,
          pitchValue,
          onProgress
        );

        // If parallel returned null, it means audio was too short
        if (result !== null) {
          return result;
        }

        console.log('[AudioWorker] Parallel returned null, using single worker');
      } catch (error) {
        console.warn('[AudioWorker] Parallel stretch failed, falling back to single:', error);
      }
    }

    // Fallback to single worker
    return stretchSingle(audioBuffer, stretchFactor, pitchValue, onProgress);
  };

  /** Apply volume envelope */
  const applyVolume = async (audioBuffer, volumeData, defaultVolume = 1, onProgress = null) => {
    await loadProcessor();

    const { sampleRate } = audioBuffer;
    const channelBuffers = extractChannels(audioBuffer);

    return new Promise((resolve, reject) => {
      handleWorkerMessage(processorWorker, audioBuffer, resolve, reject, onProgress);
      postToWorker(
        processorWorker,
        'applyVolume',
        { sampleRate, volumeData, defaultVolume },
        channelBuffers
      );
    });
  };

  /** Apply stereo pan */
  const applyPan = async (audioBuffer, panValue, onProgress = null) => {
    await loadProcessor();

    const { sampleRate } = audioBuffer;
    const channelBuffers = extractChannels(audioBuffer);

    return new Promise((resolve, reject) => {
      handleWorkerMessage(processorWorker, audioBuffer, resolve, reject, onProgress);
      postToWorker(processorWorker, 'applyPan', { sampleRate, panValue }, channelBuffers);
    });
  };

  /** Apply volume and pan in single pass */
  const applyVolumeAndPan = async (
    audioBuffer,
    volumeData,
    defaultVolume,
    panValue,
    onProgress = null
  ) => {
    await loadProcessor();

    const { sampleRate } = audioBuffer;
    const channelBuffers = extractChannels(audioBuffer);

    return new Promise((resolve, reject) => {
      handleWorkerMessage(processorWorker, audioBuffer, resolve, reject, onProgress);
      postToWorker(
        processorWorker,
        'applyVolumeAndPan',
        { sampleRate, volumeData, defaultVolume, panValue },
        channelBuffers
      );
    });
  };

  /** Terminate all workers */
  const terminate = () => {
    if (stretchWorker) {
      stretchWorker.terminate();
      stretchWorker = null;
      stretchPromise = null;
    }

    if (processorWorker) {
      processorWorker.terminate();
      processorWorker = null;
      processorPromise = null;
    }

    setWasmLoaded(false);
  };

  /** Convert AudioBuffer to WAV format */
  const audioBufferToWav = audioBuffer => {
    const { numberOfChannels: numChannels, sampleRate, length } = audioBuffer;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = length * blockAlign;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    // RIFF header
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');

    // fmt chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);

    // data chunk
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    const channels = Array.from({ length: numChannels }, (_, i) => audioBuffer.getChannelData(i));

    let offset = 44;

    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, channels[ch][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }

    return buffer;
  };

  return {
    stretch,
    applyVolume,
    applyPan,
    applyVolumeAndPan,
    terminate,
    audioBufferToWav,
    isStretchReady: () => !!stretchWorker,
    isProcessorReady: () => !!processorWorker
  };
})();
