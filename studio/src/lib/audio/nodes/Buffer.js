import AudioProcessor from '../AudioProcessor';
import BufferCache from '../BufferCache';
import { crop } from '../utils/BufferUtils';
import { AudioError } from '../errors/AudioError';
import BufferLoader from './BufferLoader';

/** Audio buffer wrapper with processing capabilities */
export default class Buffer {
  /** @type {import('./BufferLoader').default} */
  #loader;
  /** Id of the latest stretch request: older results are dropped (latest wins) */
  #stretchRequest = 0;
  /**
   * File the buffer was decoded from and the cropped range, in seconds (-1 = whole file).
   * Null when the buffer came from memory (a clone, a stretch): stored peaks of the
   * file would not match it.
   * @type {{ id: string, start: number, end: number } | null}
   */
  #source = null;

  /**
   * @param {Object} options
   * @param {number} options.startTimeBuffer
   * @param {number} options.endTimeBuffer
   * @param {boolean} [options.isCutBuffer]
   * @param {string | number} options.idTrack
   * @param {boolean} [options.isDerived]
   * @param {number} options.start
   * @param {number} options.end
   * @param {AudioBuffer} [options.buffer]
   * @param {import('./BufferLoader').default} [options.loader] - defaults to a new BufferLoader
   */
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
    this.#source = buffer ? null : { id: String(idTrack), start: start ?? -1, end: end ?? -1 };
    this.buffer = this._load(idTrack, start, end, buffer, isDerived);
  }

  /**
   * Stored waveform peaks matching this buffer, with the range to draw.
   * Null when there are none or the buffer does not come straight from a file.
   * @returns {Promise<{ peaks: import('../peaks').Peaks, start: number, end: number } | null>}
   */
  async getPeaks() {
    const source = this.#source;

    if (!source || !this.#loader.loadPeaks) {
      return null;
    }

    const peaks = await this.#loader.loadPeaks(source.id).catch(() => null);

    // A stretch may have replaced the buffer while reading
    if (!peaks || source !== this.#source) {
      return null;
    }

    return { peaks, start: source.start, end: source.end };
  }

  /**
   * Store the peaks of a whole decoded file for later loads (in the background).
   * @param {string | number} id
   * @param {AudioBuffer} audioBuffer
   */
  #rememberPeaks(id, audioBuffer) {
    if (!this.#loader.savePeaks || !audioBuffer) {
      return;
    }

    Promise.resolve(this.#loader.savePeaks(String(id), audioBuffer)).catch(err => {
      console.warn('[Buffer] Failed to store waveform peaks:', err?.message);
    });
  }

  /** Get buffer promise */
  get() {
    return this.buffer;
  }

  /**
   * Time-stretch audio. Requests can overlap (a slider sends many): only the latest
   * one updates the buffer, so a slow older result can never overwrite a newer one.
   * @returns {Promise<boolean>} false when a newer request superseded this one
   */
  async stretch(idTrack, stretchFactor, pitchValue = 0) {
    const request = ++this.#stretchRequest;
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

    if (request !== this.#stretchRequest) {
      return false;
    }

    this.originalBuffer = context.originalBuffer;
    this.buffer = Promise.resolve(buffer);
    this.duration = duration;
    this.derivedId = derivedId || null;
    this.isDerived = Boolean(this.derivedId);
    // The stretched audio lives in memory now; its file gets peaks for the next load
    this.#source = null;

    if (this.derivedId) {
      this.#rememberPeaks(this.derivedId, buffer);
    }

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
        this.#rememberPeaks(idTrack, cached);

        return finalize(cached);
      }

      const cachedBuffer = await this.#loader.loadFromCache(idTrack);

      if (cachedBuffer) {
        console.log('[Buffer] Loading from cache:', idTrack, isDerived ? '(derived)' : '');
        BufferCache.set(idTrack, cachedBuffer);
        this.#rememberPeaks(idTrack, cachedBuffer);

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
      this.#rememberPeaks(idTrack, buffer);

      return finalize(buffer);
    } catch (error) {
      this.loaded = false;
      throw error;
    }
  }

  /** Reload buffer from track */
  setBuffer(idTrack) {
    this.#source = { id: String(idTrack), start: -1, end: -1 };
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
