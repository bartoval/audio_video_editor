// @ts-check

import { getTrackUrl, getDerivedTrackUrl, getUuid } from '../../../services/workspace';
import { isOnline } from '../../utils/network';
import IndexedDB from '../../../services/offline/IndexedDB';
import { blobToAudioBuffer } from '../utils/AudioBufferSerializer';

/**
 * @typedef {Object} BufferLoaderInterface
 * @property {(idTrack: string) => Promise<AudioBuffer|null>} loadFromCache
 * @property {() => boolean} isNetworkAvailable
 * @property {(idTrack: string, isDerived: boolean) => Promise<{blob: Blob, buffer: AudioBuffer}>} fetchAndDecode
 * @property {(idTrack: string, blob: Blob, isDerived: boolean) => Promise<void>} saveToCache
 */

/**
 * Default buffer loader — loads audio from IndexedDB cache or network.
 * Wraps workspace URLs, IndexedDB persistence, and network detection.
 *
 * @implements {BufferLoaderInterface}
 */
export default class BufferLoader {
  /** @param {string} idTrack */
  async loadFromCache(idTrack) {
    const workspaceUuid = getUuid();
    const record = await IndexedDB.getAudioBlob(workspaceUuid, idTrack);

    if (!record?.blob) {
      return null;
    }

    return blobToAudioBuffer(record.blob);
  }

  /** @returns {boolean} */
  isNetworkAvailable() {
    return isOnline();
  }

  /**
   * @param {string} idTrack
   * @param {boolean} isDerived
   * @returns {Promise<{blob: Blob, buffer: AudioBuffer}>}
   */
  async fetchAndDecode(idTrack, isDerived) {
    const trackUrl = isDerived ? getDerivedTrackUrl(idTrack) : getTrackUrl(idTrack);
    const response = await fetch(trackUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${trackUrl}`);
    }

    const blob = await response.clone().blob();
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await window.audioContextInstance.decodeAudioData(arrayBuffer);

    return { blob, buffer };
  }

  /**
   * @param {string} idTrack
   * @param {Blob} blob
   * @param {boolean} isDerived
   */
  async saveToCache(idTrack, blob, isDerived) {
    const workspaceUuid = getUuid();

    await IndexedDB.saveAudioBlob(workspaceUuid, idTrack, blob, {
      isDerived,
      mimeType: blob.type || 'audio/mpeg'
    });
  }
}
