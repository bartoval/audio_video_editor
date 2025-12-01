postMessage({ type: 'ready' });

/** Interpolate volume at given time from envelope curves */
function getVolumeAtTime(time, volumeData, defaultVolume) {
  if (!volumeData || volumeData.length === 0) {
    return defaultVolume;
  }

  for (const curve of volumeData) {
    const curveStart = curve.startTime;
    const curveEnd = curve.startTime + curve.durationTime;

    if (time >= curveStart && time <= curveEnd) {
      const { times, values } = curve.data;

      if (!times || !values || times.length === 0) {
        return defaultVolume;
      }

      const localTime = time - curveStart;
      const normalizedTime = localTime / curve.durationTime;

      for (let i = 0; i < times.length - 1; i++) {
        const t1 = times[i];
        const t2 = times[i + 1];

        if (normalizedTime >= t1 && normalizedTime <= t2) {
          const ratio = (normalizedTime - t1) / (t2 - t1);

          return values[i] + (values[i + 1] - values[i]) * ratio;
        }
      }

      return values[values.length - 1];
    }
  }

  let lastValue = defaultVolume;
  let lastEndTime = -1;

  for (const curve of volumeData) {
    const curveEnd = curve.startTime + curve.durationTime;

    if (curveEnd <= time && curveEnd > lastEndTime) {
      lastEndTime = curveEnd;
      const { values } = curve.data;

      if (values && values.length > 0) {
        lastValue = values[values.length - 1];
      }
    }
  }

  return lastValue;
}

/** Apply volume envelope to samples */
function applyVolume(channelBuffers, sampleRate, volumeData, defaultVolume) {
  const numberOfChannels = channelBuffers.length;
  const length = channelBuffers[0].length;
  const outputBuffers = channelBuffers.map(buf => new Float32Array(buf.length));

  const chunkSize = Math.max(1, Math.floor(length / 20));
  let processed = 0;

  for (let i = 0; i < length; i++) {
    const time = i / sampleRate;
    const volume = getVolumeAtTime(time, volumeData, defaultVolume);

    for (let ch = 0; ch < numberOfChannels; ch++) {
      outputBuffers[ch][i] = channelBuffers[ch][i] * volume;
    }

    processed++;

    if (processed % chunkSize === 0) {
      postMessage({ type: 'progress', percent: Math.round((processed / length) * 100) });
    }
  }

  return { outputBuffers, actualLength: length };
}

/** Calculate equal-power panning gains */
function calculatePanGains(panValue) {
  const angle = (panValue + 1) * Math.PI / 4;

  return {
    leftGain: Math.cos(angle),
    rightGain: Math.sin(angle)
  };
}

/** Apply stereo pan (converts mono to stereo if needed) */
function applyPan(channelBuffers, sampleRate, panValue) {
  const numberOfChannels = channelBuffers.length;
  const length = channelBuffers[0].length;

  const leftOutput = new Float32Array(length);
  const rightOutput = new Float32Array(length);

  const { leftGain, rightGain } = calculatePanGains(panValue);

  const chunkSize = Math.max(1, Math.floor(length / 20));
  let processed = 0;

  if (numberOfChannels === 1) {
    const mono = channelBuffers[0];

    for (let i = 0; i < length; i++) {
      leftOutput[i] = mono[i] * leftGain;
      rightOutput[i] = mono[i] * rightGain;
      processed++;

      if (processed % chunkSize === 0) {
        postMessage({ type: 'progress', percent: Math.round((processed / length) * 100) });
      }
    }
  } else {
    const left = channelBuffers[0];
    const right = channelBuffers[1];

    for (let i = 0; i < length; i++) {
      if (panValue <= 0) {
        leftOutput[i] = left[i];
        rightOutput[i] = right[i] * rightGain / Math.max(0.001, leftGain);
      } else {
        leftOutput[i] = left[i] * leftGain / Math.max(0.001, rightGain);
        rightOutput[i] = right[i];
      }

      processed++;

      if (processed % chunkSize === 0) {
        postMessage({ type: 'progress', percent: Math.round((processed / length) * 100) });
      }
    }
  }

  return { outputBuffers: [leftOutput, rightOutput], actualLength: length };
}

/** Apply volume and pan in single pass */
function applyVolumeAndPan(channelBuffers, sampleRate, volumeData, defaultVolume, panValue) {
  const numberOfChannels = channelBuffers.length;
  const length = channelBuffers[0].length;

  const leftOutput = new Float32Array(length);
  const rightOutput = new Float32Array(length);

  const { leftGain, rightGain } = calculatePanGains(panValue);

  const chunkSize = Math.max(1, Math.floor(length / 20));
  let processed = 0;

  if (numberOfChannels === 1) {
    const mono = channelBuffers[0];

    for (let i = 0; i < length; i++) {
      const time = i / sampleRate;
      const volume = getVolumeAtTime(time, volumeData, defaultVolume);
      const sample = mono[i] * volume;

      leftOutput[i] = sample * leftGain;
      rightOutput[i] = sample * rightGain;
      processed++;

      if (processed % chunkSize === 0) {
        postMessage({ type: 'progress', percent: Math.round((processed / length) * 100) });
      }
    }
  } else {
    const left = channelBuffers[0];
    const right = channelBuffers[1];

    for (let i = 0; i < length; i++) {
      const time = i / sampleRate;
      const volume = getVolumeAtTime(time, volumeData, defaultVolume);

      const leftSample = left[i] * volume;
      const rightSample = right[i] * volume;

      if (panValue <= 0) {
        leftOutput[i] = leftSample;
        rightOutput[i] = rightSample * rightGain / Math.max(0.001, leftGain);
      } else {
        leftOutput[i] = leftSample * leftGain / Math.max(0.001, rightGain);
        rightOutput[i] = rightSample;
      }

      processed++;

      if (processed % chunkSize === 0) {
        postMessage({ type: 'progress', percent: Math.round((processed / length) * 100) });
      }
    }
  }

  return { outputBuffers: [leftOutput, rightOutput], actualLength: length };
}

/** Handle incoming messages */
onmessage = function(event) {
  const { type, data } = event.data;

  try {
    let result;

    switch (type) {
      case 'applyVolume': {
        const { channelBuffers, sampleRate, volumeData, defaultVolume } = data;
        result = applyVolume(channelBuffers, sampleRate, volumeData, defaultVolume);
        break;
      }

      case 'applyPan': {
        const { channelBuffers, sampleRate, panValue } = data;
        result = applyPan(channelBuffers, sampleRate, panValue);
        break;
      }

      case 'applyVolumeAndPan': {
        const { channelBuffers, sampleRate, volumeData, defaultVolume, panValue } = data;
        result = applyVolumeAndPan(channelBuffers, sampleRate, volumeData, defaultVolume, panValue);
        break;
      }

      default:
        postMessage({ type: 'error', error: `Unknown operation: ${type}` });

        return;
    }

    postMessage(
      { type: 'complete', channelBuffers: result.outputBuffers, actualLength: result.actualLength },
      result.outputBuffers.map(buf => buf.buffer)
    );
  } catch (error) {
    postMessage({ type: 'error', error: error.message });
  }
};
