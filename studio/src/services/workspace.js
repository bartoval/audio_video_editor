/** Workspace - runtime state for current session */
import { buildUrl } from '../config/routes';
import { isOnline } from '../lib';

// ============================================================================
// State
// ============================================================================

let uuid = '0';
let cacheBuster = Date.now();

// ============================================================================
// State Management
// ============================================================================

export const init = workspaceUuid => {
  uuid = workspaceUuid || '0';
};

export const getUuid = () => uuid;

export const invalidateCache = () => {
  cacheBuster = Date.now();
};

// ============================================================================
// URL Builders
// ============================================================================

export const getRouteUrl = route => buildUrl(route, uuid);

export const getVideoSrc = () => `${buildUrl('videoFile', uuid)}?t=${cacheBuster}`;

export const getTrackUrl = (id = -1) => {
  const path = id !== -1 ? buildUrl('audio', uuid, `/${id}/file`) : buildUrl('videoAudio', uuid);

  return `${path}?t=${cacheBuster}`;
};

export const getLibraryTrackUrl = id => buildUrl('audio', uuid, `/${id}`);

export const getThumbsUrl = id => {
  const base = buildUrl('videoThumbnails', uuid);

  return id ? `${base}/${id}?t=${cacheBuster}` : `${base}/`;
};

export const getThumbAtTime = time => {
  // Dynamic thumbs require server - disabled when offline
  if (!isOnline()) {
    return null;
  }

  return `${buildUrl('videoThumbnails', uuid, `/${time.toFixed(2)}`)}?v=2&t=${cacheBuster}`;
};

// ============================================================================
// Tiles Mode URL Builders
// ============================================================================

/** Get URL for thumbs manifest (tiles mode) */
export const getThumbsManifestUrl = () => {
  return `${buildUrl('videoThumbnails', uuid)}/manifest.json?t=${cacheBuster}`;
};

/** Get URL for specific scale manifest (tiles mode) */
export const getScaleManifestUrl = scale => {
  return `${buildUrl('videoThumbnails', uuid)}/${scale}/manifest.json?t=${cacheBuster}`;
};

/** Get URL for a specific tile file */
export const getTileUrl = (scale, tileFile) => {
  return `${buildUrl('videoThumbnails', uuid)}/${scale}/${tileFile}?t=${cacheBuster}`;
};
