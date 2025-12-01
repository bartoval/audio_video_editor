import { getTrackUrl } from '../../../services/workspace';
import AudioProcessor from '../AudioProcessor';
import { crop } from '../utils/BufferUtils';
import { fetchAudio } from '../utils/FetchUtils';

/** Audio buffer wrapper with processing capabilities */
export default class Buffer {
  constructor({
    startTimeBuffer,
    endTimeBuffer,
    isCutBuffer = false,
    idTrack,
    start,
    end,
    buffer
  }) {
    this.start = startTimeBuffer;
    this.end = endTimeBuffer;
    this.isCutBuffer = isCutBuffer;
    this.duration = 0;
    this.originalDuration = 0;
    this.loaded = false;
    this.stretchFactor = 1;
    this.pitchValue = 0;
    this.originalBuffer = null;
    this.buffer = this._load(idTrack, start, end, buffer);
  }

  /** Get buffer promise */
  get() {
    return this.buffer;
  }

  /** Time-stretch audio */
  async stretch(idTrack, stretchFactor, pitchValue = 0) {
    this.stretchFactor = parseFloat(stretchFactor.toFixed(2));
    this.pitchValue = pitchValue;

    const context = {
      originalBuffer: this.originalBuffer,
      start: this.start,
      end: this.end
    };

    const { buffer, duration } = await AudioProcessor.stretch(
      this.buffer,
      idTrack,
      this.stretchFactor,
      pitchValue,
      context
    );

    this.originalBuffer = context.originalBuffer;
    this.buffer = Promise.resolve(buffer);
    this.duration = duration;

    return true;
  }

  /** Apply volume envelope */
  async applyVolume(_, volumeData, defaultVolume = 1) {
    const { buffer } = await AudioProcessor.applyVolume(this.buffer, volumeData, defaultVolume);

    if (buffer) {
      this.buffer = Promise.resolve(buffer);
    }

    return true;
  }

  /** Apply pan */
  async applyPan(_, panValue) {
    const { buffer } = await AudioProcessor.applyPan(this.buffer, panValue);

    if (buffer) {
      this.buffer = Promise.resolve(buffer);
    }

    return true;
  }

  /** Apply volume and pan in single pass */
  async applyVolumeAndPan(_, volumeData, defaultVolume, panValue) {
    const { buffer } = await AudioProcessor.applyVolumeAndPan(
      this.buffer,
      volumeData,
      defaultVolume,
      panValue
    );

    if (buffer) {
      this.buffer = Promise.resolve(buffer);
    }

    return true;
  }

  /** Get processed buffer for export */
  getProcessedBuffer(volumeData, defaultVolume, panValue) {
    return AudioProcessor.getProcessedBuffer(this.buffer, volumeData, defaultVolume, panValue);
  }

  /** Load buffer from track or existing buffer */
  async _load(idTrack, start = -1, end = -1, existingBuffer = null) {
    const finalize = buff => {
      const cropped = crop(buff, start, end);
      this.duration = cropped.duration;
      this.originalDuration = this.duration;
      this.loaded = true;

      return cropped;
    };

    if (existingBuffer) {
      return existingBuffer.then(finalize);
    }

    try {
      const buffer = await fetchAudio(getTrackUrl(idTrack));

      return finalize(buffer);
    } catch (error) {
      this.loaded = false;
      throw error;
    }
  }

  /** Reload buffer from track */
  setBuffer(idTrack) {
    this.buffer = this._load(idTrack);

    return this.buffer;
  }

  isLoaded() {
    return this.loaded;
  }

  getStart() {
    return parseFloat(this.start);
  }

  getEnd() {
    return parseFloat(this.end);
  }

  setDuration(duration) {
    this.duration = duration;
  }

  getDuration() {
    return parseFloat(this.duration).toFixed(2);
  }

  getStretchFactor() {
    return 1 / this.stretchFactor;
  }

  getPitchValue() {
    return ~~this.pitchValue;
  }
}
