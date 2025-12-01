/**
 * RubberBand WASM Singleton Manager (Web Worker version)
 * Runs audio time-stretching and pitch-shifting in a background thread
 *
 * Created by Valerio Bartolini
 */
import Config from 'Config';

export default (() => {
  let worker = null;
  let workerReady = false;
  let loading = false;

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Initializes the Web Worker
   * @returns {Promise<Worker>}
   */
  const _load = async () => {
    if (worker && workerReady && Config.isWasmLoaded()) {
      return worker;
    }

    if (loading) {
      while (loading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return worker;
    }

    loading = true;

    try {
      console.log('[RubberBandWasm] Loading Web Worker...');

      worker = new Worker('/studio/rubberband-worker.js');

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Worker initialization timeout'));
        }, 30000);

        worker.onmessage = (e) => {
          if (e.data.type === 'ready') {
            clearTimeout(timeout);
            workerReady = true;
            resolve();
          } else if (e.data.type === 'error') {
            clearTimeout(timeout);
            reject(new Error(e.data.error));
          }
        };

        worker.onerror = (e) => {
          clearTimeout(timeout);
          reject(e);
        };
      });

      Config.setWasmLoaded(true);
      console.log('[RubberBandWasm] Web Worker ready');

      return worker;
    } catch (error) {
      console.error('[RubberBandWasm] Worker load failed:', error);
      Config.setWasmLoaded(false);
      throw error;
    } finally {
      loading = false;
    }
  };

  /**
   * Time-stretch and pitch-shift using RubberBand WASM in Web Worker
   * @param {AudioBuffer} audioBuffer - Original audio buffer
   * @param {number} stretchFactor - Time-stretch factor (0.5 = half speed, 2.0 = double speed)
   * @param {number} pitchValue - Pitch shift in semitones
   * @param {function} onProgress - Progress callback (percent, time)
   * @returns {Promise<AudioBuffer>} - Processed audio as AudioBuffer
   */
  const _stretch = async (audioBuffer, stretchFactor, pitchValue = 0, onProgress = null) => {
    await _load();

    const { sampleRate, numberOfChannels, length } = audioBuffer;

    console.log(`[RubberBandWasm] Stretch via Worker: factor=${stretchFactor}, pitch=${pitchValue} semitones`);

    // Extract channel data
    const channelBuffers = [];
    for (let i = 0; i < numberOfChannels; i++) {
      // Copy data since we'll transfer it
      channelBuffers.push(new Float32Array(audioBuffer.getChannelData(i)));
    }

    return new Promise((resolve, reject) => {
      const messageHandler = (e) => {
        const { type } = e.data;

        if (type === 'progress') {
          if (onProgress) {
            onProgress(e.data.percent, 0);
          }
        } else if (type === 'complete') {
          worker.removeEventListener('message', messageHandler);

          const { channelBuffers: outputBuffers, actualLength } = e.data;

          // Create output AudioBuffer
          const outputBuffer = window.audioContextInstance.createBuffer(
            numberOfChannels,
            actualLength,
            sampleRate
          );

          for (let i = 0; i < numberOfChannels; i++) {
            outputBuffer.getChannelData(i).set(outputBuffers[i]);
          }

          console.log(`[RubberBandWasm] Done: input=${length} samples, output=${actualLength} samples`);

          if (onProgress) {
            onProgress(100, 0);
          }

          resolve(outputBuffer);
        } else if (type === 'error') {
          worker.removeEventListener('message', messageHandler);
          reject(new Error(e.data.error));
        }
      };

      worker.addEventListener('message', messageHandler);

      // Send data to worker (transfer buffers for zero-copy)
      worker.postMessage(
        {
          type: 'stretch',
          data: {
            channelBuffers,
            sampleRate,
            stretchFactor,
            pitchValue
          }
        },
        channelBuffers.map(buf => buf.buffer)
      );
    });
  };

  /**
   * Releases Web Worker resources
   */
  const _terminate = () => {
    if (worker) {
      worker.terminate();
      worker = null;
    }

    workerReady = false;
    Config.setWasmLoaded(false);
  };

  /**
   * Converts AudioBuffer to WAV ArrayBuffer (kept for compatibility)
   * @param {AudioBuffer} audioBuffer
   * @returns {ArrayBuffer}
   */
  const _audioBufferToWav = audioBuffer => {
    const { numberOfChannels: numChannels, sampleRate, length } = audioBuffer;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const bufferSize = 44 + dataSize;

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // WAV Header
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Interleave channels and write samples
    const channels = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, channels[ch][i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return buffer;
  };

  // ============================================================================
  // Public API
  // ============================================================================

  return {
    load: _load,
    stretch: _stretch,
    terminate: _terminate,
    audioBufferToWav: _audioBufferToWav
  };
})();
