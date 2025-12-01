import ContextAudio from './Ctx';
import Buffer from './nodes/Buffer';
import Volume from './nodes/Volume';
import Pan from './nodes/Pan';

const MAX_WAVEFORM_SAMPLES = 500000;

/** Create waveform path from audio buffer */
let _createSvgPath = buffer => {
  const { length, numSamples: rawNumSamples, audioChns, numberOfChannels } = buffer;

  // Validate and cap numSamples to prevent invalid array length errors
  if (!Number.isFinite(rawNumSamples) || rawNumSamples <= 0) {
    console.warn('[Audio] Invalid numSamples:', rawNumSamples, '- using fallback');

    return [];
  }

  const numSamples = Math.min(Math.floor(rawNumSamples), MAX_WAVEFORM_SAMPLES);
  const sampleSize = length / numSamples;
  const sampleStep = ~~(sampleSize / 2) || 1;

  // Pre-allocate typed array for merged peaks (2 values per sample: max and min)
  const peakCount = numSamples * 2;
  const mergedPeaks = new Float32Array(peakCount);

  // Process all channels
  for (let channelNumber = 0; channelNumber < numberOfChannels; channelNumber++) {
    const channelData = audioChns[channelNumber];
    const isFirstChannel = channelNumber === 0;

    for (let peakNumber = 0; peakNumber < numSamples; peakNumber++) {
      const start = ~~(peakNumber * sampleSize);
      const end = ~~(start + sampleSize);
      let min = 0;
      let max = 0;

      // Find min/max in this sample range
      for (let sampleIndex = start; sampleIndex < end; sampleIndex += sampleStep) {
        const value = channelData[sampleIndex];

        if (value > max) {
          max = value;
        }

        if (value < min) {
          min = value;
        }
      }

      // Merge peaks across channels
      const maxIdx = peakNumber << 1; // peakNumber * 2
      const minIdx = maxIdx + 1;

      if (isFirstChannel || max > mergedPeaks[maxIdx]) {
        mergedPeaks[maxIdx] = max;
      }

      if (isFirstChannel || min < mergedPeaks[minIdx]) {
        mergedPeaks[minIdx] = min;
      }
    }
  }

  // Pre-allocate result array with exact size
  const result = new Array(peakCount);

  // Convert peaks to path coordinates (both max and min use same x)
  for (let i = 0; i < peakCount; i++) {
    result[i] = {
      x: i >> 1, // ~~(i / 2) using bit shift
      y: mergedPeaks[i]
    };
  }

  return result;
};

export default class Audio {
  constructor(config = {}) {
    if (config.idTrack === undefined || config.idTrack === null) {
      throw new Error('wrong audio link ' + config.idTrack);
    }
    this.id = config.id;
    this.idTrack = config.idTrack;
    this.startedAt = config.startTime;
    this.pausedAt = 0;
    this.loaded = false;
    this.playing = false;
    // nodes
    this.buffer = new Buffer({
      idTrack: config.idTrack,
      startTimeBuffer: config.startTimeBuffer,
      endTimeBuffer: config.endTimeBuffer,
      isCutBuffer: config.isCutBuffer,
      start: config.start,
      end: config.end,
      buffer: config.buffer
    });
    this.gainNode = new Volume(config);
    this.pan = new Pan(config);
    ContextAudio.addBuffer(this.id, this);
  }

  /** Check if playing */
  isPlaying() {
    return this.playing;
  }

  /** Check if loaded */
  isLoaded() {
    return this.buffer.isLoaded();
  }

  /** Get start time */
  getStartTime() {
    return this.buffer.getStart();
  }

  /** Get end time */
  getEndTime() {
    return this.buffer.getEnd();
  }

  /** Set duration */
  setDuration(duration) {
    this.buffer.setDuration(duration);
  }

  /** Get duration */
  getDuration() {
    return this.buffer.getDuration();
  }

  /** Get stretch factor */
  getStretchFactor() {
    return this.buffer.getStretchFactor();
  }

  /** Get track id */
  getIdTrack() {
    return this.idTrack;
  }

  /** Set pan value */
  setPanValue(value) {
    this.pan.setValue(value);
  }

  /** Get pan value */
  getPanValue() {
    return this.pan.getValue();
  }

  /** Release audio resources */
  releaseResources() {
    this.playing && this.stop();
    ContextAudio.removeBuffer(this.id);
    return ContextAudio.close()
      .then(() => {
        this._volumeData = [];
        this.originalBuffer = null;
        this.buffer = null;
        this.pan.removeNode();
        this.pan = null;
        this.gainNode.removeNode();
        this.gainNode = null;
        this.source = null;
        return true;
      })
      .catch(err => {
        console.log(err);
        return false;
      });
  }

  /** Get audio buffer */
  getBuffer() {
    return this.buffer.get();
  }

  /** Time-stretch buffer */
  stretchBuffer(stretchFactor = 1, pitchValue) {
    return this.buffer
      .stretch(this.idTrack, stretchFactor, pitchValue)
      .then(res => {
        return res;
      })
      .catch(err => {
        throw err;
      });
  }

  /** Resize audio segment */
  resize(startTime, duration, time = 0) {
    let endAt = this.startedAt + this.buffer.getDuration();
    time = time <= 0 ? 0 : time;
    this.pausedAt = this.pausedAt >= startTime && this.pausedAt <= endAt ? time : 0;
    this.buffer.setDuration(duration);
    this.startedAt = startTime;
    return true;
  }

  /** Move to time position */
  moveTo(time) {
    let endTime = this.startedAt + this.buffer.getDuration();
    time = time <= 0 ? 0 : time;
    this.pausedAt = this.pausedAt >= time && this.pausedAt <= endTime ? this.pausedAt - time : 0;
    this.startedAt = time;
    return true;
  }

  /** Play audio */
  play() {
    return (
      this.playing === false &&
      this.buffer
        .get()
        .then(buff => {
          let pausedAt = ContextAudio.getPausedAt(),
            setNodes = () => {
              let create = () => {
                  this.source = window.audioContextInstance.createBufferSource();
                  this.gainNode.getNode() === null && this.gainNode.createNode();
                  this.pan.createNode();
                  return true;
                },
                set = () => {
                  let currentTime = ContextAudio.getTime() + this.startedAt;
                  this.source.buffer = buff;
                  this.gainNode.setGain(currentTime, pausedAt);
                  this.pan.setNodeValue();
                  return true;
                },
                connect = () => {
                  this.source.connect(this.gainNode.getNode());
                  this.gainNode.connectNode(this.pan.getNode());
                  this.pan.connectNode(window.audioContextInstance.destination);
                  return true;
                };
              return create() && set() && connect();
            },
            resetPauseTime = () => {
              this.pausedAt = 0;
              return true;
            },
            play = () => {
              let delay = pausedAt > this.startedAt ? pausedAt - this.startedAt : 0,
                starTime = pausedAt >= this.startedAt ? 0 : ContextAudio.getTime() + this.startedAt;
              this.source.start(starTime, delay, this.buffer.getDuration());
              this.playing = true;
              return true;
            };
          return setNodes() && play() && resetPauseTime();
        })
        .catch(e => {
          console.log(e);
          return false;
        })
    );
  }

  /** Stop audio */
  stop() {
    let resetNodes = () => {
        let disconnect = () => {
            this.pan.disconnectNode();
            return true;
          },
          remove = () => {
            this.gainNode.removeNode();
            this.pan.removeNode();
            this.source = null;
            return true;
          };
        this.source !== null && disconnect() && remove();
        return true;
      },
      stop = () => {
        this.playing && this.source.stop(0);
        this.playing = false;
        return true;
      },
      resetTime = () => {
        this.pausedAt = 0;
        return true;
      };
    return stop() && resetTime() && resetNodes();
  }

  /** Pause audio at time */
  pause(time) {
    let setTime = () => {
      this.pausedAt = time - this.startedAt;
      return true;
    };
    return this.stop() && setTime();
  }

  /** Set volume envelope */
  setVolumeData(sampleArrayInput) {
    const currentTime = this.playing ? ContextAudio.getTime() + this.startedAt : 0;
    const pausedAt = ContextAudio.getPausedAt();

    return this.gainNode.setVolumeData(sampleArrayInput, currentTime, pausedAt);
  }

  /** Get volume envelope */
  getVolumeData() {
    return this.gainNode.getVolumeData();
  }

  /**
   * Get buffer info for cloning a track segment
   * @param {Object} cutInfo - Cut zone info { start, duration } or null if not cutting
   * @param {number} stretchFactor - Current stretch factor
   * @returns {Object} Buffer timing info for clone
   */
  getCloneBufferInfo(cutInfo, stretchFactor) {
    const isCutting = cutInfo !== null;

    if (isCutting) {
      const { start: cutStart, duration: cutDuration } = cutInfo;

      return {
        isCutBuffer: true,
        startTimeBuffer: parseFloat(this.getStartTime()) + parseFloat(cutStart),
        endTimeBuffer: this.getStartTime() + (cutStart + cutDuration) / stretchFactor
      };
    }

    return {
      isCutBuffer: false,
      startTimeBuffer: this.getStartTime(),
      endTimeBuffer: this.getEndTime()
    };
  }

  /** Get waveform data */
  getWaveForm(scale) {
    const getChannels = buff => {
      const channels = [];

      for (let chn = 0; chn < buff.numberOfChannels; chn++) {
        channels.push(buff.getChannelData(chn));
      }

      return channels;
    };

    return new Promise(resolve => {
      // Validate scale - must be positive number
      if (!Number.isFinite(scale) || scale <= 0) {
        console.warn('[Audio] Invalid scale for waveform:', scale, '- using default 0.1');
        scale = 0.1;
      }

      this.buffer.get().then(buff => {
        const audioChannels = getChannels(buff);
        const duration = this.buffer.getDuration();
        // Calculate numSamples based on scale for proper visual alignment
        // scale is pixels per second, so duration/scale gives us the pixel width
        const numSamples = Math.min(Math.ceil(duration / scale), MAX_WAVEFORM_SAMPLES);

        const bufferInfo = {
          length: buff.length,
          numSamples,
          audioChns: audioChannels,
          numberOfChannels: buff.numberOfChannels
        };

        const path = _createSvgPath(bufferInfo);

        resolve({ path, sampleRate: numSamples });
      });
    });
  }
}
