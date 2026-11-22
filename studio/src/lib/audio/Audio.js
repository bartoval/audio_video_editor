// @ts-check

import ContextAudio from './Ctx';
import BufferCache from './BufferCache';
import Buffer from './nodes/Buffer';
import Volume from './nodes/Volume';
import Pan from './nodes/Pan';
import { canDrawAt, frameRange, peaksToPath } from './peaks';
import defaultWaveformTileService from '../../services/WaveformTileService';

/**
 * @typedef {import('@/types').AudioConfig} AudioConfig
 * @typedef {import('@/types').VolumeEnvelope} VolumeEnvelope
 */

/** @typedef {{ x: number, y: number }} WaveformPoint */

const MAX_WAVEFORM_SAMPLES = 500000;
const WAVEFORM_SCALE_PRECISION = 3;

/**
 * Extract min/max peaks from audio channels for waveform rendering.
 * Merges all channels into a single peak array with interleaved max/min values.
 *
 * @param {{ length: number, numSamples: number, audioChns: Float32Array[], numberOfChannels: number }} buffer
 * @returns {WaveformPoint[]}
 */
let _createSvgPath = buffer => {
  const { length, numSamples: rawNumSamples, audioChns, numberOfChannels } = buffer;

  // Validate and cap numSamples to prevent invalid array length errors
  if (!Number.isFinite(rawNumSamples) || rawNumSamples <= 0) {
    console.warn('[Audio] Invalid numSamples:', rawNumSamples, '- using fallback');

    return [];
  }

  const numSamples = Math.min(Math.floor(rawNumSamples), MAX_WAVEFORM_SAMPLES);
  const sampleSize = length / numSamples;
  // Use finer sampling for high zoom (small sampleSize) to keep precision
  const sampleStep = sampleSize < 10 ? 1 : Math.max(1, ~~(sampleSize / 4));
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

      for (let sampleIndex = start; sampleIndex < end; sampleIndex += sampleStep) {
        const value = channelData[sampleIndex];

        if (value > max) {
          max = value;
        }

        if (value < min) {
          min = value;
        }
      }

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

  const result = new Array(peakCount);

  for (let i = 0; i < peakCount; i++) {
    result[i] = {
      x: i >> 1, // ~~(i / 2) using bit shift
      y: mergedPeaks[i]
    };
  }

  return result;
};

/**
 * Audio - Web Audio API wrapper for a single audio track.
 * Manages buffer loading, playback, gain/pan nodes, and waveform generation.
 * Each instance is registered in ContextAudio for global playback coordination.
 */
export default class Audio {
  /** @param {AudioConfig} config */
  constructor(config) {
    if (config.idTrack === undefined || config.idTrack === null) {
      throw new Error('wrong audio link ' + config.idTrack);
    }
    this.id = config.id;
    this.idTrack = config.idTrack;
    this.isDerived = config.isDerived || false;
    this.startedAt = config.startTime;
    this.pausedAt = 0;
    this.loaded = false;
    this.playing = false;
    this._waveformCache = new Map();
    this._waveformTileService = config.waveformTileService || defaultWaveformTileService;
    this.buffer = new Buffer({
      idTrack: config.idTrack,
      isDerived: config.isDerived || false,
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

  /** @param {number} duration - in seconds */
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

  /** @param {number} value - -1 (left) to 1 (right) */
  setPanValue(value) {
    this.pan.setValue(value);
  }

  /** Get pan value */
  getPanValue() {
    return this.pan.getValue();
  }

  /** @returns {Promise<boolean>} true if cleanup succeeded */
  releaseResources() {
    this.playing && this.stop();
    ContextAudio.removeBuffer(this.id);
    BufferCache.release(this.idTrack);
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

  /** Get derived track ID (if audio was stretched) */
  getDerivedId() {
    return this.buffer.getDerivedId();
  }

  /** @param {string|null} id */
  setDerivedId(id) {
    this.buffer.setDerivedId(id);
  }

  /**
   * @param {number} stretchFactor - 1.0 = original speed
   * @param {number} pitchValue - semitones shift
   * @returns {Promise<boolean>}
   */
  stretchBuffer(stretchFactor = 1, pitchValue) {
    return this.buffer
      .stretch(this.idTrack, stretchFactor, pitchValue)
      .then(res => {
        this.invalidateWaveformTiles();

        return res;
      })
      .catch(err => {
        throw err;
      });
  }

  /**
   * @param {number} startTime - new start position on timeline (seconds)
   * @param {number} duration - new duration (seconds)
   * @param {number} [time] - current playback time for pausedAt recalc
   */
  resize(startTime, duration, time = 0) {
    let endAt = this.startedAt + this.buffer.getDuration();
    time = time <= 0 ? 0 : time;
    this.pausedAt = this.pausedAt >= startTime && this.pausedAt <= endAt ? time : 0;
    this.buffer.setDuration(duration);
    this.startedAt = startTime;
    return true;
  }

  /** @param {number} time - new start position on timeline (seconds) */
  moveTo(time) {
    let endTime = this.startedAt + this.buffer.getDuration();
    time = time <= 0 ? 0 : time;
    this.pausedAt = this.pausedAt >= time && this.pausedAt <= endTime ? this.pausedAt - time : 0;
    this.startedAt = time;
    return true;
  }

  /** @returns {false|Promise<boolean>} false if already playing */
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
                  this.source.buffer = buff;
                  this.pan.setNodeValue();
                  return true;
                },
                connect = () => {
                  this.source.connect(this.gainNode.getNode());
                  this.gainNode.connectNode(this.pan.getNode());
                  this.pan.connectNode(window.audioContextInstance.destination);
                  return true;
                },
                applyVolume = () => {
                  const currentTime = ContextAudio.getTime() + this.startedAt;
                  this.gainNode.setGain(currentTime, pausedAt);
                  return true;
                };
              return create() && set() && connect() && applyVolume();
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
        .catch(error => {
          console.log(error);
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

  /** @param {number} time - current playback time (seconds) */
  pause(time) {
    let setTime = () => {
      this.pausedAt = time - this.startedAt;
      return true;
    };
    return this.stop() && setTime();
  }

  /** @param {VolumeEnvelope} sampleArrayInput */
  setVolumeData(sampleArrayInput) {
    const currentTime = this.playing ? ContextAudio.getTime() + this.startedAt : 0;
    const pausedAt = ContextAudio.getPausedAt();

    return this.gainNode.setVolumeData(sampleArrayInput, currentTime, pausedAt);
  }

  /** Get volume envelope */
  getVolumeData() {
    return this.gainNode.getVolumeData();
  }

  /** @param {number} value - 0-2, where 1 is unity gain */
  setGain(value) {
    this.gainNode.setMasterGain(value);
  }

  /** Get master gain */
  getGain() {
    return this.gainNode.getMasterGain();
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
        startTimeBuffer: this.getStartTime() + cutStart,
        endTimeBuffer: this.getStartTime() + (cutStart + cutDuration) / stretchFactor
      };
    }

    return {
      isCutBuffer: false,
      startTimeBuffer: this.getStartTime(),
      endTimeBuffer: this.getEndTime()
    };
  }

  /**
   * Waveform at a zoom level. Uses the file's stored peaks when they fit, so the
   * waveform shows without waiting for the audio to decode; otherwise (no peaks yet,
   * buffer from memory, very deep zoom) reads the decoded buffer.
   * @param {number} scale - seconds per pixel (zoom level)
   * @returns {Promise<{path: WaveformPoint[], sampleRate: number, duration: number}>}
   */
  async getWaveForm(scale) {
    // Validate scale - must be positive number
    if (!Number.isFinite(scale) || scale <= 0) {
      console.warn('[Audio] Invalid scale for waveform:', scale, '- using default 0.1');
      scale = 0.1;
    }

    return (await this.#waveFormFromPeaks(scale)) || this.#waveFormFromBuffer(scale);
  }

  /**
   * @param {number} scale
   * @returns {Promise<{path: WaveformPoint[], sampleRate: number, duration: number} | null>}
   */
  async #waveFormFromPeaks(scale) {
    const found = await this.buffer.getPeaks?.();

    if (!found || !canDrawAt(found.peaks, scale)) {
      return null;
    }

    const { peaks, start, end } = found;
    const { startFrame, endFrame } = frameRange(peaks, start, end);
    const duration = (endFrame - startFrame) / peaks.sampleRate;
    const numSamples = Math.max(1, Math.min(Math.ceil(duration / scale), MAX_WAVEFORM_SAMPLES));
    const scaleKey = 'peaks-' + scale.toFixed(WAVEFORM_SCALE_PRECISION) + '-' + numSamples;

    if (this._waveformCache.has(scaleKey)) {
      return this._waveformCache.get(scaleKey);
    }

    const result = {
      path: peaksToPath(peaks, { pixels: numSamples, start, end }),
      sampleRate: numSamples,
      duration
    };
    this._waveformCache.set(scaleKey, result);

    return result;
  }

  /**
   * @param {number} scale
   * @returns {Promise<{path: WaveformPoint[], sampleRate: number, duration: number}>}
   */
  async #waveFormFromBuffer(scale) {
    const buff = await this.buffer.get();
    const audioChannels = [];

    for (let chn = 0; chn < buff.numberOfChannels; chn++) {
      audioChannels.push(buff.getChannelData(chn));
    }

    const duration = buff.duration;
    // scale is seconds per pixel, so duration/scale gives the pixel width
    const numSamples = Math.max(1, Math.min(Math.ceil(duration / scale), MAX_WAVEFORM_SAMPLES));

    // Cache by rounded scale to limit recomputation during small zoom changes
    const scaleKey = scale.toFixed(WAVEFORM_SCALE_PRECISION) + '-' + numSamples;

    if (this._waveformCache.has(scaleKey)) {
      return this._waveformCache.get(scaleKey);
    }

    const bufferInfo = {
      length: buff.length,
      numSamples,
      audioChns: audioChannels,
      numberOfChannels: buff.numberOfChannels
    };

    const path = _createSvgPath(bufferInfo);
    const result = { path, sampleRate: numSamples, duration };

    this._waveformCache.set(scaleKey, result);

    return result;
  }

  /**
   * Get waveform data for a specific time window using tile-based system
   * @param {Object} options
   * @param {number} options.start - Window start time in seconds
   * @param {number} options.end - Window end time in seconds
   * @param {number} options.magnification - Zoom factor (e.g., 6 for SuperZoom)
   * @returns {Promise<{tiles: Array, windowStart: number, windowEnd: number}>}
   */
  async getWaveformWindow({ start, end, magnification }) {
    const audioBuffer = await this.buffer.get();
    const duration = this.buffer.getDuration();

    const windowStart = Math.max(0, start);
    const windowEnd = Math.min(duration, end);

    if (windowStart >= windowEnd) {
      return { tiles: [], windowStart, windowEnd };
    }

    const { tiles, bufferedStart, bufferedEnd } = await this._waveformTileService.getTilesForWindow(
      String(this.id),
      windowStart,
      windowEnd,
      magnification,
      audioBuffer
    );

    return { tiles, windowStart: bufferedStart, windowEnd: bufferedEnd };
  }

  /**
   * Invalidate waveform tile cache for this audio
   * Called after stretch/pitch/trim/cut/reload operations
   */
  invalidateWaveformTiles() {
    this._waveformTileService.invalidate(String(this.id));
    this._waveformCache.clear();
  }
}
