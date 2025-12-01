/**
 * Simple LRU cache for AudioBuffer objects.
 * - Tracks refCount so we do not evict buffers in use.
 * - Capacity is in bytes; set to 0 or negative to disable eviction.
 */
class BufferCache {
  constructor(limitBytes = 200 * 1024 * 1024) {
    this.limitBytes = limitBytes;
    this.totalBytes = 0;
    this.map = new Map();
  }

  /** Estimate buffer size in bytes */
  #sizeOf(buffer) {
    if (!buffer) return 0;

    const { length = 0, numberOfChannels = 0 } = buffer;

    // Each sample is a 32-bit float = 4 bytes
    return length * numberOfChannels * 4;
  }

  setLimit(bytes) {
    this.limitBytes = bytes;
    this.#evictIfNeeded();
  }

  #now() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  get(key) {
    const entry = this.map.get(key);

    if (!entry) return null;

    entry.lastUsed = this.#now();

    return entry.buffer;
  }

  addRef(key) {
    const entry = this.map.get(key);

    if (!entry) return;

    entry.refCount += 1;
    entry.lastUsed = this.#now();
  }

  /**
   * Store buffer and increment ref count
   * @returns {AudioBuffer}
   */
  set(key, buffer) {
    const size = this.#sizeOf(buffer);
    const now = this.#now();
    const existing = this.map.get(key);

    if (existing) {
      this.totalBytes -= existing.sizeBytes;
      existing.buffer = buffer;
      existing.sizeBytes = size;
      existing.refCount += 1;
      existing.lastUsed = now;
    } else {
      this.map.set(key, {
        buffer,
        sizeBytes: size,
        refCount: 1,
        lastUsed: now
      });
    }

    this.totalBytes += size;
    this.#evictIfNeeded();

    return buffer;
  }

  release(key) {
    const entry = this.map.get(key);

    if (!entry) return;

    entry.refCount = Math.max(0, entry.refCount - 1);
    entry.lastUsed = this.#now();
    this.#evictIfNeeded();
  }

  /** Evict least-recently-used entries with refCount 0 until under limit */
  #evictIfNeeded() {
    if (this.limitBytes <= 0) {
      return;
    }

    while (this.totalBytes > this.limitBytes) {
      let lruKey = null;
      let lruEntry = null;

      for (const [key, entry] of this.map.entries()) {
        if (entry.refCount > 0) {
          continue;
        }

        if (!lruEntry || entry.lastUsed < lruEntry.lastUsed) {
          lruEntry = entry;
          lruKey = key;
        }
      }

      if (!lruEntry) {
        // Nothing evictable (all in use)
        break;
      }

      this.map.delete(lruKey);
      this.totalBytes -= lruEntry.sizeBytes;
    }
  }
}

export default new BufferCache();
