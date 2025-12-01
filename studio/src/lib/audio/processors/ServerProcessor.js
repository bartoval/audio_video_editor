import { getUuid, getRouteUrl, getTrackUrl } from '../../../services/workspace';
import { buildUrl } from '../../../config/routes';
import { fetchWithRetry, fetchAudio } from '../utils/FetchUtils';

const DEFERRED_RESULT = { buffer: null, deferred: true };

/** Time-stretch via server */
const stretch = async (sourceBuffer, idTrack, stretchFactor, pitchValue, { start, end }) => {
  const uuid = getUuid();
  const body = JSON.stringify({
    audioId: idTrack,
    pitchValue,
    ratio: stretchFactor.toFixed(1),
    startTime: start,
    duration: end - start
  });

  // POST /api/v1/workspaces/:uuid/audio/:id/stretch
  const response = await fetchWithRetry(buildUrl('audio', uuid, `/${idTrack}/stretch`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });
  const { outputId: newTrackId } = await response.json();

  const newBuffer = await fetchAudio(getTrackUrl(newTrackId), { retry: true });

  // Check stretch status (fire and forget)
  // GET /api/v1/workspaces/:uuid/audio/:id/stretch
  window.fetch(buildUrl('audio', uuid, `/${newTrackId}/stretch`));

  return { buffer: newBuffer, duration: newBuffer.duration };
};

/** Volume deferred to export */
const applyVolume = () => {
  console.log('[Server] Volume deferred to export');

  return DEFERRED_RESULT;
};

/** Pan deferred to export */
const applyPan = () => {
  console.log('[Server] Pan deferred to export');

  return DEFERRED_RESULT;
};

/** Volume+Pan deferred to export */
const applyVolumeAndPan = () => {
  console.log('[Server] Volume+Pan deferred to export');

  return DEFERRED_RESULT;
};

export default { stretch, applyVolume, applyPan, applyVolumeAndPan };
