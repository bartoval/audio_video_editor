/**
 * RubberBand Web Worker
 * Runs audio time-stretching and pitch-shifting in a background thread
 */

let rbApi = null;

// Load RubberBand WASM
(async () => {
  try {
    const wasmModule = await WebAssembly.compileStreaming(fetch('/rubberband.wasm'));

    // Import the UMD bundle dynamically
    importScripts('/rubberband.umd.min.js');

    rbApi = await rubberband.RubberBandInterface.initialize(wasmModule);
    postMessage({ type: 'ready' });
  } catch (error) {
    postMessage({ type: 'error', error: error.message });
  }
})();

onmessage = async function(e) {
  const { type, data } = e.data;

  if (type !== 'stretch') {
    return;
  }

  if (!rbApi) {
    postMessage({ type: 'error', error: 'WASM not loaded yet' });

    return;
  }

  const { channelBuffers, sampleRate, stretchFactor, pitchValue } = data;
  const numberOfChannels = channelBuffers.length;
  const originalLength = channelBuffers[0].length;

  try {
    // timeRatio: same as rubberband CLI -t flag
    // stretchFactor > 1 = faster/shorter, stretchFactor < 1 = slower/longer
    const timeRatio = stretchFactor;

    // Convert semitones to pitch scale: 2^(semitones/12)
    const pitchScale = Math.pow(2, pitchValue / 12);

    postMessage({ type: 'progress', percent: 5 });

    // RubberBand options for high quality pitch shifting
    const RubberBandOptionProcessOffline = 0;
    const RubberBandOptionPitchHighQuality = 33554432;
    const RubberBandOptionTransientsSmooth = 512; // Smooth transients to avoid harsh sounds
    const RubberBandOptionWindowLong = 2097152; // Longer window for smoother output
    const RubberBandOptionSmoothingOn = 8388608; // Enable smoothing

    // Combine options for smooth, high quality output
    const options = RubberBandOptionProcessOffline
      | RubberBandOptionPitchHighQuality
      | RubberBandOptionTransientsSmooth
      | RubberBandOptionWindowLong
      | RubberBandOptionSmoothingOn;

    // Create RubberBand state with high quality options
    const rbState = rbApi.rubberband_new(
      sampleRate,
      numberOfChannels,
      options,
      1,
      1
    );

    rbApi.rubberband_set_time_ratio(rbState, timeRatio);
    rbApi.rubberband_set_pitch_scale(rbState, pitchScale);

    // Get processing parameters
    const samplesRequired = rbApi.rubberband_get_samples_required(rbState);
    const preferredStartPad = rbApi.rubberband_get_preferred_start_pad(rbState);
    const startDelay = rbApi.rubberband_get_start_delay(rbState);

    // Add padding to input to prevent losing audio at start/end
    const paddedLength = originalLength + preferredStartPad;
    const paddedBuffers = channelBuffers.map(buf => {
      const padded = new Float32Array(paddedLength);
      // Fill start padding with silence (or could mirror first samples)
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

    // Calculate output size with extra margin
    const expectedOutputLength = Math.ceil(originalLength * timeRatio);
    const outputBufferSize = Math.ceil(paddedLength * timeRatio) + samplesRequired;
    const outputBuffers = paddedBuffers.map(() => new Float32Array(outputBufferSize));

    // Study phase
    postMessage({ type: 'progress', percent: 10 });

    let read = 0;
    while (read < paddedLength) {
      const remaining = Math.min(samplesRequired, paddedLength - read);

      for (let i = 0; i < numberOfChannels; i++) {
        rbApi.memWrite(channelDataPtr[i], paddedBuffers[i].subarray(read, read + remaining));
      }

      read += remaining;
      const isFinal = read >= paddedLength ? 1 : 0;
      rbApi.rubberband_study(rbState, channelArrayPtr, remaining, isFinal);

      const studyProgress = 10 + (read / paddedLength) * 20;
      postMessage({ type: 'progress', percent: Math.round(studyProgress) });
    }

    // Process phase
    postMessage({ type: 'progress', percent: 30 });

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

      const processProgress = 30 + (read / paddedLength) * 60;
      postMessage({ type: 'progress', percent: Math.round(processProgress) });
    }

    // Retrieve all remaining samples
    tryRetrieve(true);

    // Cleanup WASM memory
    for (const ptr of channelDataPtr) {
      rbApi.free(ptr);
    }
    rbApi.free(channelArrayPtr);
    rbApi.rubberband_delete(rbState);

    postMessage({ type: 'progress', percent: 95 });

    // Calculate the start delay in output samples (scaled by timeRatio)
    const outputStartDelay = Math.ceil((preferredStartPad + startDelay) * timeRatio);

    // Trim output: skip the delay at start, and take expectedOutputLength samples
    const actualStart = Math.min(outputStartDelay, write);
    const actualLength = Math.min(expectedOutputLength, write - actualStart);

    // Find peak amplitude in output for normalization
    let maxAmplitude = 0;
    for (let i = 0; i < numberOfChannels; i++) {
      for (let j = actualStart; j < actualStart + actualLength; j++) {
        const abs = Math.abs(outputBuffers[i][j]);

        if (abs > maxAmplitude) {
          maxAmplitude = abs;
        }
      }
    }

    // Find peak amplitude in original input
    let originalMaxAmplitude = 0;
    for (let i = 0; i < numberOfChannels; i++) {
      for (let j = 0; j < originalLength; j++) {
        const abs = Math.abs(channelBuffers[i][j]);

        if (abs > originalMaxAmplitude) {
          originalMaxAmplitude = abs;
        }
      }
    }

    // Calculate gain to match original volume (with safety limit)
    const gain = (maxAmplitude > 0.001 && originalMaxAmplitude > 0.001)
      ? Math.min(originalMaxAmplitude / maxAmplitude, 2.0)
      : 1.0;

    const trimmedBuffers = outputBuffers.map(buf => {
      const trimmed = new Float32Array(actualLength);
      const source = buf.subarray(actualStart, actualStart + actualLength);

      // Apply gain normalization
      for (let i = 0; i < actualLength; i++) {
        trimmed[i] = Math.max(-1, Math.min(1, source[i] * gain));
      }

      return trimmed;
    });

    // Transfer buffers back (zero-copy)
    postMessage(
      {
        type: 'complete',
        channelBuffers: trimmedBuffers,
        sampleRate,
        actualLength
      },
      trimmedBuffers.map(buf => buf.buffer)
    );

  } catch (error) {
    postMessage({ type: 'error', error: error.message });
  }
};
