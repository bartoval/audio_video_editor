/**
 * MediaPrefetch - pre-caches audio tracks that are in the editor
 *
 * Only caches tracks used in the timeline, not the full library.
 * Uses Cache Storage API for efficient media caching.
 */
import { isOnline } from '../../lib';
import { getLibraryTrackUrl } from '../workspace';

const MEDIA_CACHE = 'media-v11';

class MediaPrefetch {
  static #instance = null;
  #prefetchedUrls = new Set();
  #isPrefetching = false;

  // ============================================================================
  // Static API
  // ============================================================================

  static getInstance() {
    if (!MediaPrefetch.#instance) {
      MediaPrefetch.#instance = new MediaPrefetch();
    }

    return MediaPrefetch.#instance;
  }

  /**
   * Prefetch audio tracks from editor data
   * @param {Object} editorData - The editor data containing tracks
   */
  static prefetch(editorData) {
    return MediaPrefetch.getInstance().prefetch(editorData);
  }

  /**
   * Check if a URL is already cached
   * @param {string} url - URL to check
   */
  static isCached(url) {
    return MediaPrefetch.getInstance().isCached(url);
  }

  /**
   * Clear all prefetched media
   */
  static clear() {
    return MediaPrefetch.getInstance().clear();
  }

  // ============================================================================
  // Instance API
  // ============================================================================

  async prefetch(editorData) {
    if (this.#isPrefetching || !isOnline()) {
      return;
    }

    const urls = this.#extractAudioUrls(editorData);

    if (urls.length === 0) {
      console.log('[MediaPrefetch] No audio tracks to prefetch');

      return;
    }

    // Filter out already cached URLs
    const uncachedUrls = urls.filter(url => !this.#prefetchedUrls.has(url));

    if (uncachedUrls.length === 0) {
      console.log('[MediaPrefetch] All tracks already cached');

      return;
    }

    this.#isPrefetching = true;
    console.log(`[MediaPrefetch] Prefetching ${uncachedUrls.length} audio tracks...`);

    try {
      const cache = await caches.open(MEDIA_CACHE);

      for (const url of uncachedUrls) {
        await this.#cacheUrl(cache, url);
      }

      console.log('[MediaPrefetch] Prefetch complete');
    } catch (error) {
      console.error('[MediaPrefetch] Prefetch failed:', error);
    } finally {
      this.#isPrefetching = false;
    }
  }

  async isCached(url) {
    try {
      const cache = await caches.open(MEDIA_CACHE);
      // Use pathname-only key for consistent matching (ignore query string)
      const cacheKey = this.#getCacheKey(url);
      const response = await cache.match(cacheKey);

      return response !== undefined;
    } catch {
      return false;
    }
  }

  async clear() {
    try {
      await caches.delete(MEDIA_CACHE);
      this.#prefetchedUrls.clear();
      console.log('[MediaPrefetch] Cache cleared');
    } catch (error) {
      console.error('[MediaPrefetch] Clear failed:', error);
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Extract audio URLs from editor data
   * @param {Object} editorData - Editor data containing tracks
   * @returns {string[]} Array of audio URLs
   */
  #extractAudioUrls(editorData) {
    const urls = [];

    if (!editorData?.tracks) {
      return urls;
    }

    for (const track of editorData.tracks) {
      if (track.audioId) {
        // Build the audio URL using workspace helper
        const audioUrl = getLibraryTrackUrl(track.audioId);
        urls.push(audioUrl);
      }
    }

    return urls;
  }

  /**
   * Cache a single URL
   * @param {Cache} cache - Cache instance
   * @param {string} url - URL to cache
   */
  async #cacheUrl(cache, url) {
    try {
      // Use pathname-only key for consistent matching (ignore query string)
      const cacheKey = this.#getCacheKey(url);

      // Check if already in cache
      const existing = await cache.match(cacheKey);

      if (existing) {
        this.#prefetchedUrls.add(cacheKey);

        return;
      }

      // Fetch and cache
      const response = await fetch(url);

      // Only cache successful complete responses (not 206 partial)
      if (response.ok && response.status === 200) {
        await cache.put(cacheKey, response);
        this.#prefetchedUrls.add(cacheKey);
        console.log('[MediaPrefetch] Cached:', cacheKey);
      }
    } catch (error) {
      console.warn('[MediaPrefetch] Failed to cache:', url, error.message);
    }
  }

  /**
   * Get cache key from URL (pathname only, no query string)
   * Matches SW cacheFirst strategy for consistent cache matching
   * @param {string} url - URL to convert
   * @returns {string} Cache key
   */
  #getCacheKey(url) {
    try {
      const urlObj = new URL(url, window.location.origin);

      return urlObj.origin + urlObj.pathname;
    } catch {
      return url;
    }
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get isPrefetching() {
    return this.#isPrefetching;
  }

  get prefetchedCount() {
    return this.#prefetchedUrls.size;
  }
}

export default MediaPrefetch;
