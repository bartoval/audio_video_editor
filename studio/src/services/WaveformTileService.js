// @ts-check
import { ASSETS } from '../config/routes';

const WORKER_TIMEOUT = 5000;

class WaveformTileService {
  #TILE_DURATION = 2;
  #MAX_POINTS_PER_TILE = 100000;
  #BUFFER_TILES = 2;
  #MAX_CACHE_SIZE = 200;

  /** @type {Worker|null} */
  #worker = null;

  /** @type {Promise<Worker>|null} */
  #workerPromise = null;

  /** @type {Map<string, Map<string, import('@types').TileMetadata>>} clipId → tileKey → metadata */
  #cache = new Map();

  /** @type {Map<number, {resolve: Function, reject: Function, clipId: string, tileIdx: number, magnification: number}>} */
  #pendingRequests = new Map();

  /** @type {number} */
  #requestIdCounter = 0;

  /** @type {Set<Function>} */
  #listeners = new Set();

  /**
   * Initialize worker with ready signal
   * @returns {Promise<Worker>}
   */
  async #initWorker() {
    if (this.#worker) {
      return this.#worker;
    }

    if (this.#workerPromise) {
      return this.#workerPromise;
    }

    this.#workerPromise = new Promise((resolve, reject) => {
      const worker = new Worker(ASSETS.waveformWorker);

      const timeout = setTimeout(() => {
        worker.terminate();
        this.#workerPromise = null;
        reject(new Error(`[WaveformTileService] Worker timeout after ${WORKER_TIMEOUT}ms`));
      }, WORKER_TIMEOUT);

      worker.onmessage = ({ data: { type, data } }) => {
        if (type === 'ready') {
          clearTimeout(timeout);
          this.#worker = worker;
          this.#setupMessageHandler(worker);
          resolve(worker);
        } else if (type === 'error' && !this.#worker) {
          clearTimeout(timeout);
          this.#workerPromise = null;
          reject(new Error(data?.error || 'Worker initialization failed'));
        }
      };

      worker.onerror = event => {
        clearTimeout(timeout);
        this.#workerPromise = null;
        reject(event);
      };
    });

    return this.#workerPromise;
  }

  /**
   * Setup message handler for worker responses
   * @param {Worker} worker
   */
  #setupMessageHandler(worker) {
    worker.onmessage = ({ data: { type, data } }) => {
      if (type === 'tile') {
        this.#handleTileResponse(data);
      } else if (type === 'error') {
        this.#handleErrorResponse(data);
      }
    };
  }

  /**
   * Handle tile response from worker
   * @param {Object} data
   */
  #handleTileResponse(data) {
    const { requestId, clipId, tileIdx, magnification, peaks } = data;
    const pending = this.#pendingRequests.get(requestId);

    if (!pending) {
      return;
    }

    this.#pendingRequests.delete(requestId);

    const tileKey = this.#buildTileKey(tileIdx, magnification);
    const clipCache = this.#getOrCreateClipCache(clipId);

    clipCache.set(tileKey, {
      status: 'ready',
      data: peaks,
      timestamp: Date.now(),
      promise: null
    });

    this.#evictIfNeeded();
    pending.resolve(peaks);
    this.#notifyListeners();
  }

  /**
   * Handle error response from worker
   * @param {Object} data
   */
  #handleErrorResponse(data) {
    const { requestId, error } = data;
    const pending = this.#pendingRequests.get(requestId);

    if (!pending) {
      return;
    }

    this.#pendingRequests.delete(requestId);

    const { clipId, tileIdx, magnification } = pending;
    const tileKey = this.#buildTileKey(tileIdx, magnification);
    const clipCache = this.#cache.get(clipId);

    if (clipCache) {
      clipCache.set(tileKey, {
        status: 'error',
        data: null,
        timestamp: Date.now(),
        promise: null
      });
    }

    pending.reject(new Error(error));
  }

  /**
   * Build cache key for a tile
   * @param {number} tileIdx
   * @param {number} magnification
   * @returns {string}
   */
  #buildTileKey(tileIdx, magnification) {
    return `${tileIdx}-${magnification.toFixed(2)}`;
  }

  /**
   * Get or create clip cache
   * @param {string} clipId
   * @returns {Map<string, import('@types').TileMetadata>}
   */
  #getOrCreateClipCache(clipId) {
    if (!this.#cache.has(clipId)) {
      this.#cache.set(clipId, new Map());
    }

    return this.#cache.get(clipId);
  }

  /**
   * Evict oldest tiles when cache exceeds limit
   */
  #evictIfNeeded() {
    let totalTiles = 0;

    for (const clipCache of this.#cache.values()) {
      totalTiles += clipCache.size;
    }

    if (totalTiles <= this.#MAX_CACHE_SIZE) {
      return;
    }

    const allTiles = [];

    for (const [clipId, clipCache] of this.#cache.entries()) {
      for (const [tileKey, metadata] of clipCache.entries()) {
        allTiles.push({ clipId, tileKey, timestamp: metadata.timestamp });
      }
    }

    allTiles.sort((entryA, entryB) => entryA.timestamp - entryB.timestamp);

    const toRemove = totalTiles - this.#MAX_CACHE_SIZE + 20;

    for (let i = 0; i < toRemove && i < allTiles.length; i++) {
      const { clipId, tileKey } = allTiles[i];
      const clipCache = this.#cache.get(clipId);

      if (clipCache) {
        clipCache.delete(tileKey);

        if (clipCache.size === 0) {
          this.#cache.delete(clipId);
        }
      }
    }
  }

  /**
   * Extract channel data for a specific time range
   * @param {AudioBuffer} audioBuffer
   * @param {number} startTime
   * @param {number} endTime
   * @returns {Float32Array[]}
   */
  #extractChannelData(audioBuffer, startTime, endTime) {
    const { sampleRate, numberOfChannels, length } = audioBuffer;
    const startSample = Math.max(0, Math.floor(startTime * sampleRate));
    const endSample = Math.min(length, Math.ceil(endTime * sampleRate));
    const channels = [];

    for (let ch = 0; ch < numberOfChannels; ch++) {
      const fullChannel = audioBuffer.getChannelData(ch);
      const segment = fullChannel.slice(startSample, endSample);

      channels.push(segment);
    }

    return channels;
  }

  /**
   * Notify all listeners of cache changes
   */
  #notifyListeners() {
    for (const listener of this.#listeners) {
      try {
        listener();
      } catch (error) {
        console.error('[WaveformTileService] Listener error:', error);
      }
    }
  }

  /**
   * Get tile index for a given time
   * @param {number} time - Time in seconds
   * @returns {number}
   */
  getTileIndexForTime(time) {
    return Math.floor(time / this.#TILE_DURATION);
  }

  /**
   * Get time range for a tile
   * @param {number} tileIdx
   * @returns {{start: number, end: number}}
   */
  getTileTimeRange(tileIdx) {
    return {
      start: tileIdx * this.#TILE_DURATION,
      end: (tileIdx + 1) * this.#TILE_DURATION
    };
  }

  /**
   * Get a single tile
   * @param {string} clipId
   * @param {number} tileIdx
   * @param {number} magnification
   * @param {AudioBuffer} audioBuffer
   * @returns {Promise<Float32Array>}
   */
  async getTile(clipId, tileIdx, magnification, audioBuffer) {
    const tileKey = this.#buildTileKey(tileIdx, magnification);
    const clipCache = this.#getOrCreateClipCache(clipId);
    const cached = clipCache.get(tileKey);

    if (cached?.status === 'ready' && cached.data) {
      cached.timestamp = Date.now();

      return cached.data;
    }

    if (cached?.status === 'loading' && cached.promise) {
      return cached.promise;
    }

    const worker = await this.#initWorker();
    const requestId = ++this.#requestIdCounter;
    const { start: tileStart, end: tileEnd } = this.getTileTimeRange(tileIdx);
    const duration = audioBuffer.length / audioBuffer.sampleRate;
    const clampedStart = Math.max(0, tileStart);
    const clampedEnd = Math.min(duration, tileEnd);

    if (clampedStart >= clampedEnd) {
      return new Float32Array(0);
    }

    const channelBuffers = this.#extractChannelData(audioBuffer, clampedStart, clampedEnd);

    const promise = new Promise((resolve, reject) => {
      this.#pendingRequests.set(requestId, {
        resolve,
        reject,
        clipId,
        tileIdx,
        magnification
      });

      worker.postMessage(
        {
          type: 'getTile',
          data: {
            requestId,
            clipId,
            tileIdx,
            magnification,
            tileStart: clampedStart,
            tileEnd: clampedEnd,
            channelBuffers,
            sampleRate: audioBuffer.sampleRate,
            maxPoints: this.#MAX_POINTS_PER_TILE
          }
        },
        channelBuffers.map(buf => buf.buffer)
      );
    });

    clipCache.set(tileKey, {
      status: 'loading',
      data: null,
      timestamp: Date.now(),
      promise
    });

    return promise;
  }

  /**
   * Get tiles covering a time window with buffer
   * @param {string} clipId
   * @param {number} startTime
   * @param {number} endTime
   * @param {number} magnification
   * @param {AudioBuffer} audioBuffer
   * @returns {Promise<{tiles: import('@types').TileResult[], bufferedStart: number, bufferedEnd: number}>}
   */
  async getTilesForWindow(clipId, startTime, endTime, magnification, audioBuffer) {
    const duration = audioBuffer.length / audioBuffer.sampleRate;
    const bufferedStart = Math.max(0, startTime - this.#BUFFER_TILES * this.#TILE_DURATION);
    const bufferedEnd = Math.min(duration, endTime + this.#BUFFER_TILES * this.#TILE_DURATION);

    const startTileIdx = this.getTileIndexForTime(bufferedStart);
    const endTileIdx = this.getTileIndexForTime(bufferedEnd);

    const tilePromises = [];

    for (let tileIdx = startTileIdx; tileIdx <= endTileIdx; tileIdx++) {
      const { start: tileStart, end: tileEnd } = this.getTileTimeRange(tileIdx);

      if (tileEnd <= 0 || tileStart >= duration) {
        continue;
      }

      tilePromises.push(
        this.getTile(clipId, tileIdx, magnification, audioBuffer).then(peaks => ({
          tileIdx,
          tileStart: Math.max(0, tileStart),
          tileEnd: Math.min(duration, tileEnd),
          peaks
        }))
      );
    }

    const tiles = await Promise.all(tilePromises);

    const actualStart = tiles.length > 0 ? Math.min(...tiles.map(t => t.tileStart)) : bufferedStart;
    const actualEnd = tiles.length > 0 ? Math.max(...tiles.map(t => t.tileEnd)) : bufferedEnd;

    return { tiles, bufferedStart: actualStart, bufferedEnd: actualEnd };
  }

  /**
   * Invalidate cache for a clip
   * @param {string} clipId
   * @param {string[]|null} tileKeys - Specific tile keys to invalidate, or null for all
   */
  invalidate(clipId, tileKeys = null) {
    const clipCache = this.#cache.get(clipId);

    if (!clipCache) {
      return;
    }

    if (tileKeys) {
      for (const key of tileKeys) {
        clipCache.delete(key);
      }
    } else {
      this.#cache.delete(clipId);
    }

    if (this.#worker) {
      this.#worker.postMessage({
        type: 'invalidate',
        data: { clipId, tileKeys }
      });
    }

    this.#notifyListeners();
  }

  /**
   * Invalidate all cached tiles
   */
  invalidateAll() {
    this.#cache.clear();

    if (this.#worker) {
      this.#worker.postMessage({
        type: 'invalidate',
        data: {}
      });
    }

    this.#notifyListeners();
  }

  /**
   * Subscribe to cache changes
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onChange(callback) {
    this.#listeners.add(callback);

    return () => this.#listeners.delete(callback);
  }

  /**
   * Get tile duration
   * @returns {number}
   */
  getTileDuration() {
    return this.#TILE_DURATION;
  }

  /**
   * Terminate worker and clear cache
   */
  destroy() {
    if (this.#worker) {
      this.#worker.terminate();
      this.#worker = null;
      this.#workerPromise = null;
    }

    this.#cache.clear();
    this.#pendingRequests.clear();
    this.#listeners.clear();
  }
}

const waveformTileService = new WaveformTileService();

export default waveformTileService;
