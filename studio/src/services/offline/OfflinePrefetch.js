/**
 * OfflinePrefetch - manages offline media prefetching via Service Worker
 *
 * Coordinates with SW to download:
 * - Video (small version for offline)
 * - Audio tracks used in timeline
 * - Thumbnail manifest
 *
 * Runs silently in background (no progress indicator)
 */
import { isOnline } from '../../lib';
import { getUuid, getLibraryTrackUrl } from '../workspace';

class OfflinePrefetch {
  static #instance = null;
  #isPrefetching = false;
  #currentUuid = null;
  #messageHandler = null;

  // Static API

  static getInstance() {
    if (!OfflinePrefetch.#instance) {
      OfflinePrefetch.#instance = new OfflinePrefetch();
    }

    return OfflinePrefetch.#instance;
  }

  static init() {
    return OfflinePrefetch.getInstance().init();
  }

  static prefetch(editorData) {
    return OfflinePrefetch.getInstance().prefetch(editorData);
  }

  static checkStatus() {
    return OfflinePrefetch.getInstance().checkStatus();
  }

  static cancel() {
    return OfflinePrefetch.getInstance().cancel();
  }

  static get isPrefetching() {
    return OfflinePrefetch.getInstance().#isPrefetching;
  }

  // Instance API

  init() {
    if (this.#messageHandler) {
      return;
    }

    this.#messageHandler = this.#handleMessage.bind(this);
    navigator.serviceWorker?.addEventListener('message', this.#messageHandler);
  }

  destroy() {
    if (this.#messageHandler) {
      navigator.serviceWorker?.removeEventListener('message', this.#messageHandler);
      this.#messageHandler = null;
    }
  }

  async prefetch(editorData) {
    if (!isOnline()) {
      return false;
    }

    const registration = await navigator.serviceWorker?.ready;

    if (!registration?.active) {
      console.warn('[OfflinePrefetch] No active service worker');

      return false;
    }

    const uuid = getUuid();
    this.#currentUuid = uuid;
    this.#isPrefetching = true;

    // Extract audio URLs from editor data
    const audioUrls = this.#extractAudioUrls(editorData);

    // Extract video URLs from editor data (from backend response)
    const videoUrlsFromData = editorData?.video?.urls || null;

    // Send prefetch request to SW (runs silently in background)
    registration.active.postMessage({
      type: 'PREFETCH_OFFLINE',
      payload: { uuid, audioUrls, videoUrls: videoUrlsFromData }
    });

    return true;
  }

  async checkStatus() {
    const registration = await navigator.serviceWorker?.ready;

    if (!registration?.active) {
      return false;
    }

    const uuid = getUuid();

    registration.active.postMessage({
      type: 'CHECK_OFFLINE_STATUS',
      payload: { uuid }
    });

    return true;
  }

  cancel() {
    this.#isPrefetching = false;
    this.#currentUuid = null;
  }

  // Private Methods

  #handleMessage(event) {
    const { type, payload } = event.data || {};

    switch (type) {
      case 'PREFETCH_PROGRESS':
        this.#handleProgress(payload);
        break;

      case 'OFFLINE_STATUS':
        this.#handleOfflineStatus(payload);
        break;
    }
  }

  #handleProgress({ uuid, status }) {
    // Ignore messages for other workspaces
    if (uuid !== this.#currentUuid) {
      return;
    }

    // Silently track completion state
    if (status === 'complete' || status === 'aborted') {
      this.#isPrefetching = false;
    }
  }

  #handleOfflineStatus({ uuid, available }) {
    // Only handle if it matches current workspace
    if (uuid !== getUuid()) {
      return;
    }

    // Emit event for UI components to listen
    window.dispatchEvent(
      new CustomEvent('offline-status', {
        detail: { uuid, available }
      })
    );
  }

  #extractAudioUrls(editorData) {
    const urls = [];

    if (!editorData?.tracks) {
      return urls;
    }

    for (const track of editorData.tracks) {
      if (track.audioId && track.audioId !== '-1') {
        urls.push(getLibraryTrackUrl(track.audioId));
      }
    }

    return urls;
  }

  // Getters

  get isPrefetching() {
    return this.#isPrefetching;
  }
}

export default OfflinePrefetch;
