// @ts-check

/** Workspace - runtime state for current session */
import { buildUrl } from '../config/routes';
import { isOnline } from '../lib';

let uuid = '0';
let cacheBuster = Date.now();

export const init = workspaceUuid => {
  uuid = workspaceUuid || '0';
};

export const getUuid = () => uuid;

export const invalidateCache = () => {
  cacheBuster = Date.now();
};

export const getRouteUrl = route => buildUrl(route, uuid);

export const getTrackUrl = (id, format = 'mp3') => {
  const path = buildUrl('audio', uuid, `/${id}/file`);

  return `${path}?t=${cacheBuster}&format=${format}`;
};

export const getDerivedTrackUrl = id => {
  const path = buildUrl('audio', uuid, `/derived/${id}`);

  return `${path}?t=${cacheBuster}`;
};

export const getLibraryTrackUrl = id => buildUrl('audio', uuid, `/${id}`);

export const getThumbsUrl = id => {
  const base = buildUrl('videoThumbnails', uuid);

  return id ? `${base}/${id}?v=${cacheBuster}` : `${base}/`;
};

export const getThumbAtTime = time => {
  if (!isOnline()) {
    return null;
  }

  return `${buildUrl('videoThumbnails', uuid, `/${time.toFixed(2)}`)}?v=${cacheBuster}`;
};

/** Get URL for thumbs manifest (tiles mode) */
export const getThumbsManifestUrl = () => {
  return `${buildUrl('videoThumbnails', uuid)}/manifest.json?v=${cacheBuster}`;
};

/** Get URL for specific scale manifest (tiles mode) */
export const getScaleManifestUrl = scale => {
  return `${buildUrl('videoThumbnails', uuid)}/${scale}/manifest.json?v=${cacheBuster}`;
};

/** Get URL for a specific tile file */
export const getTileUrl = (scale, tileFile) => {
  return `${buildUrl('videoThumbnails', uuid)}/${scale}/${tileFile}?v=${cacheBuster}`;
};
