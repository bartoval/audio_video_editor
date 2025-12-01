/**
 * MainThreadProcessor - WASM stretch on main thread (blocks UI)
 * Only for demo purposes to show the difference with worker
 */

import { extractChannels, createFromChannels } from '../utils/BufferUtils';

let rbApi = null;
let loadingPromise = null;

/** Load RubberBand WASM on main thread */
const loadWasm = async () => {
  if (rbApi) {
    return rbApi;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    console.log('[MainThread] Loading RubberBand WASM...');
    const startTime = performance.now();

    const wasmModule = await WebAssembly.compileStreaming(fetch('/rubberband.wasm'));

    // Load the UMD bundle
    if (!window.rubberband) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/rubberband.umd.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    rbApi = await window.rubberband.RubberBandInterface.initialize(wasmModule);

    const elapsed = performance.now() - startTime;
    console.log(`[MainThread] WASM loaded in ${elapsed.toFixed(0)}ms`);

    return rbApi;
  })();

  return loadingPromise;
};

/** Time-stretch on main thread (blocks UI!) */
const stretch = async (sourceBuffer, idTrack, stretchFactor, pitchValue) => {
  await loadWasm();

  const startTime = performance.now();
  const { sampleRate, numberOfChannels, length: originalLength } = sourceBuffer;
  const duration = originalLength / sampleRate;

  console.log(`[MainThread] Starting stretch | ${duration.toFixed(2)}s audio | UI WILL BLOCK`);

  const channelBuffers = extractChannels(sourceBuffer);

  // timeRatio and pitchScale
  const timeRatio = stretchFactor;
  const pitchScale = Math.pow(2, pitchValue / 12);

  // RubberBand options
  const RubberBandOptionProcessOffline = 0;
  const RubberBandOptionPitchHighQuality = 33554432;
  const RubberBandOptionTransientsSmooth = 512;
  const RubberBandOptionWindowLong = 2097152;
  const RubberBandOptionSmoothingOn = 8388608;

  const options =
    RubberBandOptionProcessOffline |
    RubberBandOptionPitchHighQuality |
    RubberBandOptionTransientsSmooth |
    RubberBandOptionWindowLong |
    RubberBandOptionSmoothingOn;

  const rbState = rbApi.rubberband_new(sampleRate, numberOfChannels, options, 1, 1);

  rbApi.rubberband_set_time_ratio(rbState, timeRatio);
  rbApi.rubberband_set_pitch_scale(rbState, pitchScale);

  const samplesRequired = rbApi.rubberband_get_samples_required(rbState);
  const preferredStartPad = rbApi.rubberband_get_preferred_start_pad(rbState);
  const startDelay = rbApi.rubberband_get_start_delay(rbState);

  // Add padding
  const paddedLength = originalLength + preferredStartPad;
  const paddedBuffers = channelBuffers.map(buf => {
    const padded = new Float32Array(paddedLength);
    padded.set(buf, preferredStartPad);

    return padded;
  });

  rbApi.rubberband_set_expected_input_duration(rbState, paddedLength);

  // Allocate memory
  const channelArrayPtr = rbApi.malloc(numberOfChannels * 4);
  const channelDataPtr = [];

  for (let channel = 0; channel < numberOfChannels; channel++) {
    const bufferPtr = rbApi.malloc(samplesRequired * 4);
    channelDataPtr.push(bufferPtr);
    rbApi.memWritePtr(channelArrayPtr + channel * 4, bufferPtr);
  }

  const expectedOutputLength = Math.ceil(originalLength * timeRatio);
  const outputBufferSize = Math.ceil(paddedLength * timeRatio) + samplesRequired;
  const outputBuffers = paddedBuffers.map(() => new Float32Array(outputBufferSize));

  // Study phase
  let read = 0;

  while (read < paddedLength) {
    const remaining = Math.min(samplesRequired, paddedLength - read);

    for (let i = 0; i < numberOfChannels; i++) {
      rbApi.memWrite(channelDataPtr[i], paddedBuffers[i].subarray(read, read + remaining));
    }

    read += remaining;
    const isFinal = read >= paddedLength ? 1 : 0;
    rbApi.rubberband_study(rbState, channelArrayPtr, remaining, isFinal);
  }

  // Process phase
  read = 0;
  let write = 0;

  const tryRetrieve = (final = false) => {
    while (true) {
      const available = rbApi.rubberband_available(rbState);

      if (available < 1) {
        break;
      }

      if (!final && available < samplesRequired) {
        break;
      }

      const toRetrieve = Math.min(samplesRequired, available);
      const recv = rbApi.rubberband_retrieve(rbState, channelArrayPtr, toRetrieve);

      for (let i = 0; i < numberOfChannels; i++) {
        const retrievedData = rbApi.memReadF32(channelDataPtr[i], recv);

        if (write + recv <= outputBuffers[i].length) {
          outputBuffers[i].set(retrievedData, write);
        }
      }

      write += recv;
    }
  };

  while (read < paddedLength) {
    const remaining = Math.min(samplesRequired, paddedLength - read);

    for (let i = 0; i < numberOfChannels; i++) {
      rbApi.memWrite(channelDataPtr[i], paddedBuffers[i].subarray(read, read + remaining));
    }

    read += remaining;
    const isFinal = read >= paddedLength ? 1 : 0;
    rbApi.rubberband_process(rbState, channelArrayPtr, remaining, isFinal);
    tryRetrieve(false);
  }

  tryRetrieve(true);

  // Cleanup
  for (const ptr of channelDataPtr) {
    rbApi.free(ptr);
  }

  rbApi.free(channelArrayPtr);
  rbApi.rubberband_delete(rbState);

  // Trim output
  const outputStartDelay = Math.ceil((preferredStartPad + startDelay) * timeRatio);
  const actualStart = Math.min(outputStartDelay, write);
  const actualLength = Math.min(expectedOutputLength, write - actualStart);

  // Normalize
  let maxAmplitude = 0;

  for (let i = 0; i < numberOfChannels; i++) {
    for (let j = actualStart; j < actualStart + actualLength; j++) {
      const abs = Math.abs(outputBuffers[i][j]);

      if (abs > maxAmplitude) {
        maxAmplitude = abs;
      }
    }
  }

  let originalMaxAmplitude = 0;

  for (let i = 0; i < numberOfChannels; i++) {
    for (let j = 0; j < originalLength; j++) {
      const abs = Math.abs(channelBuffers[i][j]);

      if (abs > originalMaxAmplitude) {
        originalMaxAmplitude = abs;
      }
    }
  }

  const gain =
    maxAmplitude > 0.001 && originalMaxAmplitude > 0.001
      ? Math.min(originalMaxAmplitude / maxAmplitude, 2.0)
      : 1.0;

  const trimmedBuffers = outputBuffers.map(buf => {
    const trimmed = new Float32Array(actualLength);
    const source = buf.subarray(actualStart, actualStart + actualLength);

    for (let i = 0; i < actualLength; i++) {
      trimmed[i] = Math.max(-1, Math.min(1, source[i] * gain));
    }

    return trimmed;
  });

  const buffer = createFromChannels(trimmedBuffers, actualLength, sampleRate);

  const elapsed = performance.now() - startTime;
  console.log(
    `[MainThread] Stretch complete | ${elapsed.toFixed(0)}ms | ` +
      `${duration.toFixed(2)}s audio | speedup: ~${((duration * 1000) / elapsed).toFixed(1)}x realtime`
  );

  return { buffer, duration: buffer.duration };
};

export default { stretch };
