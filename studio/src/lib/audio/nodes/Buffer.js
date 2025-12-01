import AudioProcessor from '../AudioProcessor';
import BufferCache from '../BufferCache';
import { crop } from '../utils/BufferUtils';
import { AudioError } from '../errors/AudioError';
import BufferLoader from './BufferLoader';

/** Audio buffer wrapper with processing capabilities */
export default class Buffer {
  /** @type {import('./BufferLoader').default} */
  #loader;

  constructor({
    startTimeBuffer,
    endTimeBuffer,
    isCutBuffer = false,
    idTrack,
    isDerived = false,
    start,
    end,
    buffer,
    loader
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
    this.derivedId = null;
    this.isDerived = isDerived;
    this.#loader = loader || new BufferLoader();
    this.buffer = this._load(idTrack, start, end, buffer, isDerived);
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

    const { buffer, duration, derivedId } = await AudioProcessor.stretch(
      this.buffer,
      idTrack,
      this.stretchFactor,
      pitchValue,
      context
    );

    this.originalBuffer = context.originalBuffer;
    this.buffer = Promise.resolve(buffer);
    this.duration = duration;
    this.derivedId = derivedId || null;
    this.isDerived = Boolean(this.derivedId);

    return true;
  }

  /** Get derived track ID (if audio was stretched) */
  getDerivedId() {
    return this.derivedId;
  }

  /** Set derived track ID (for restore from backup) */
  setDerivedId(id) {
    this.derivedId = id;
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

  /**
   * Load buffer from track or existing buffer
   *
   * Lookup order:
   * 1. existingBuffer (passed in)
   * 2. RAM BufferCache
   * 3. IndexedDB audioBlobs
   * 4. Network fetch (if online)
   * 5. Error if offline and miss
   */
  async _load(idTrack, start = -1, end = -1, existingBuffer = null, isDerived = false) {
    const finalize = buff => {
      const cropped = crop(buff, start, end);
      this.duration = cropped.duration;
      this.originalDuration = this.duration;
      this.loaded = true;

      return cropped;
    };

    if (existingBuffer) {
      BufferCache.addRef(idTrack);

      return existingBuffer.then(finalize);
    }

    try {
      const cached = BufferCache.get(idTrack);

      if (cached) {
        BufferCache.addRef(idTrack);

        return finalize(cached);
      }

      const cachedBuffer = await this.#loader.loadFromCache(idTrack);

      if (cachedBuffer) {
        console.log('[Buffer] Loading from cache:', idTrack, isDerived ? '(derived)' : '');
        BufferCache.set(idTrack, cachedBuffer);

        return finalize(cachedBuffer);
      }

      if (!this.#loader.isNetworkAvailable()) {
        this.loaded = false;
        throw AudioError.offline(idTrack);
      }

      const { blob, buffer } = await this.#loader.fetchAndDecode(idTrack, isDerived);

      BufferCache.set(idTrack, buffer);

      this.#loader.saveToCache(idTrack, blob, isDerived).catch(err => {
        console.warn('[Buffer] Failed to save to cache:', err.message);
      });

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
    return Math.round(this.duration * 100) / 100;
  }

  getStretchFactor() {
    return 1 / this.stretchFactor;
  }

  getPitchValue() {
    return ~~this.pitchValue;
  }
}
