// @ts-check

/** API - HTTP calls with offline fallback */
import { buildUrl } from '../config/routes';
import { getUuid } from './workspace';
import IndexedDB from './offline/IndexedDB';
import * as LocalMedia from './offline/LocalMedia';
import * as EventService from './EventService';
import { isOnline } from '../lib';
import ErrorHandler from './ErrorHandler';

class ApiError extends Error {
  constructor(message, status, url) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
  }
}

const safeFetch = async (url, options = {}, silent = false) => {
  if (!isOnline()) {
    const error = new ApiError('You are offline', 0, url);

    if (!silent) {
      ErrorHandler.handle(error);
    }

    throw error;
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      const error = new ApiError(`HTTP ${response.status}: ${errorText}`, response.status, url);

      if (!silent) {
        ErrorHandler.handle(error);
      }

      throw error;
    }

    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    const networkError = new ApiError(error.message || 'Network error', 0, url);

    if (!silent) {
      ErrorHandler.handle(networkError);
    }

    throw networkError;
  }
};

const workspaceState = record => {
  if (!record) return {};

  const {
    uuid: _uuid,
    title: _title,
    isVideoLoaded: _videoLoaded,
    updatedAt: _updatedAt,
    localRevision: _revision,
    videoInfo: _videoInfo,
    audioLibrary: _library,
    serverSynced: _synced,
    syncedVideoId: _syncedVideo,
    deleted: _deleted,
    serverDeleted: _serverDeleted,
    ...state
  } = record;

  return state;
};

const hasLocalState = record => Boolean(record && ('tracks' in record || 'video' in record));

export const load = async () => {
  const uuid = getUuid();
  const cached = await IndexedDB.getWorkspace(uuid);
  const pending = (await IndexedDB.getPendingSync())
    .filter(operation => operation.type === 'backup' && operation.uuid === uuid)
    .sort((a, b) => a.createdAt - b.createdAt);
  if (pending.length) return pending.at(-1).data;
  if (hasLocalState(cached)) return workspaceState(cached);
  throw new Error('This project is not on this device. Use Sync server to download it.');
};

export const backup = async ({ video, navigator, transcriptions }) => {
  await IndexedDB.saveWorkspaceBackup(getUuid(), {
    video: video?.src || null,
    markers: navigator?.markers || [],
    tracks: navigator?.tracks || [],
    transcriptions: transcriptions || {}
  });
  return { success: true, offline: true };
};

async function requireServerCopy(audioId) {
  const uuid = getUuid();
  const project = await IndexedDB.getWorkspace(uuid);
  const media = audioId ? await LocalMedia.get(uuid, audioId) : null;
  if (!project?.serverSynced || (media && (!media.synced || media.deleted))) {
    throw new Error('Use Sync server first. Files are only sent when you synchronize.');
  }
  EventService.connect();
}

export const publish = async ({ video, navigator, duration, format }) => {
  await requireServerCopy();
  for (const track of navigator.tracks || []) {
    await requireServerCopy(track.idTrack);
    if (track.derivedId) await requireServerCopy(track.derivedId);
  }
  const project = await IndexedDB.getWorkspace(getUuid());
  if (video.src && project.videoInfo?.localMediaId !== project.syncedVideoId) {
    throw new Error('Sync this video first.');
  }
  return safeFetch(buildUrl('exports', getUuid()), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      duration: duration || video.duration,
      video: video.src,
      tracks: navigator.tracks,
      format: format || 'mp3'
    })
  }).then(r => r.json());
};

export const getAudioDownloadUrl = async (id, format) => {
  await requireServerCopy(id);
  return buildUrl('audio', getUuid(), `/${encodeURIComponent(id)}/file?format=${format}`);
};

export const getVideoUploadUrl = () => buildUrl('videoFile', getUuid());

export const convertVideo = (priorityScale = '0.02') =>
  safeFetch(buildUrl('videoConvert', getUuid()), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priorityScale })
  });

export const isVideoConverted = () =>
  safeFetch(buildUrl('videoConvert', getUuid())).then(r => r.json());

export const getAudioUploadUrl = () => buildUrl('audio', getUuid());

export const deleteAudioLibraryItem = async id => {
  await LocalMedia.remove(getUuid(), id);
  return { status: 'deleted' };
};

export const getAudioList = () => LocalMedia.library();

export const getProjects = async () => {
  const projects = (await IndexedDB.getAllWorkspaces()).filter(
    record => !('data' in record) && !record.deleted
  );
  return projects.map(record => ({
    uuid: record.uuid,
    title: record.title || 'Untitled',
    isVideoLoaded: record.isVideoLoaded || false,
    hasLocalState: hasLocalState(record)
  }));
};

export const createProject = async title => {
  const uuid = crypto.randomUUID();
  await IndexedDB.saveWorkspace(uuid, { title, isVideoLoaded: false, serverSynced: false });
  await IndexedDB.saveWorkspaceBackup(uuid, {
    video: null,
    tracks: [],
    markers: [],
    transcriptions: {}
  });
  return { success: true, uuid };
};

export const deleteProject = async uuid => {
  // Keep a tombstone until an explicit sync also deletes the server copy.
  await IndexedDB.saveWorkspace(uuid, { deleted: true });
  for (const record of await LocalMedia.list(uuid)) await LocalMedia.remove(uuid, record.id);
  await IndexedDB.deleteAudioBlobsByWorkspace(uuid);
  return { success: true };
};

export const startStemsSeparation = async audioId => {
  await requireServerCopy(audioId);
  const response = await safeFetch(buildUrl('audio', getUuid(), `/${audioId}/stems`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  return response.json();
};

export const getStemsDownloadUrl = (audioId, jobId) => {
  return buildUrl('audio', getUuid(), `/${audioId}/stems/${jobId}/download`);
};

export const startSceneDetection = async (options = {}) => {
  await requireServerCopy();
  const project = await IndexedDB.getWorkspace(getUuid());
  if (project.videoInfo?.localMediaId !== project.syncedVideoId)
    throw new Error('Sync this video first.');
  const response = await safeFetch(buildUrl('video', getUuid(), '/scene-detect'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options)
  });

  return response.json();
};
