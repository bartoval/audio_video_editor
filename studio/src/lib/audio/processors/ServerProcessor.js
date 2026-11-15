import {
  getUuid as defaultGetUuid,
  getDerivedTrackUrl as defaultGetDerivedTrackUrl
} from '../../../services/workspace';
import { buildUrl as defaultBuildUrl } from '../../../config/routes';
import {
  fetchWithRetry as defaultFetchWithRetry,
  fetchAudio as defaultFetchAudio
} from '../utils/FetchUtils';
import IndexedDB from '../../../services/offline/IndexedDB';

const DEFERRED_RESULT = { buffer: null, deferred: true };

/**
 * Create a server processor with injectable dependencies.
 * Default deps use workspace URLs, FetchUtils, and IndexedDB.
 */
export function createServerProcessor({
  getUuid: injGetUuid,
  getDerivedTrackUrl: injGetDerivedTrackUrl,
  buildUrl: injBuildUrl,
  fetchWithRetry: injFetchWithRetry,
  fetchAudio: injFetchAudio,
  saveAudioBlob = (uuid, id, blob, opts) => IndexedDB.saveAudioBlob(uuid, id, blob, opts)
} = {}) {
  /** Time-stretch via server */
  const stretch = async (sourceBuffer, idTrack, stretchFactor, pitchValue, { start, end }) => {
    const getUuid = injGetUuid || defaultGetUuid;
    const getDerivedTrackUrl = injGetDerivedTrackUrl || defaultGetDerivedTrackUrl;
    const buildUrl = injBuildUrl || defaultBuildUrl;
    const fetchWithRetry = injFetchWithRetry || defaultFetchWithRetry;
    const fetchAudio = injFetchAudio || defaultFetchAudio;

    const uuid = getUuid();
    const hasValidRange = start >= 0 && end > start;
    const startTime = hasValidRange ? start : 0;
    const duration = hasValidRange ? end - start : sourceBuffer.duration;

    const body = JSON.stringify({
      audioId: idTrack,
      pitchValue,
      ratio: stretchFactor.toFixed(1),
      startTime,
      duration
    });

    const response = await fetchWithRetry(buildUrl('audio', uuid, `/${idTrack}/stretch`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    const responseData = await response.json();

    const { outputId: newTrackId, url } = responseData;
    const sourceUrl = url
      ? `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`
      : getDerivedTrackUrl(newTrackId);

    const newBuffer = await fetchAudio(sourceUrl, { retry: true });

    // Save derived blob to IDB for offline reuse (fire and forget)
    fetchWithRetry(sourceUrl)
      .then(res => (res.ok ? res.blob() : null))
      .then(blob => {
        if (!blob) return;
        saveAudioBlob(uuid, newTrackId, blob, {
          isDerived: true,
          mimeType: blob.type || 'audio/mpeg'
        }).catch(err => {
          console.warn('[ServerProcessor] Failed to persist derived audio:', err?.message || err);
        });
      })
      .catch(() => {});

    return { buffer: newBuffer, duration: newBuffer.duration, derivedId: newTrackId };
  };

  /** Volume deferred to export */
  const applyVolume = () => DEFERRED_RESULT;

  /** Pan deferred to export */
  const applyPan = () => DEFERRED_RESULT;

  /** Volume+Pan deferred to export */
  const applyVolumeAndPan = () => DEFERRED_RESULT;

  return { stretch, applyVolume, applyPan, applyVolumeAndPan };
}

export default createServerProcessor();
