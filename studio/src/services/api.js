// @ts-check

/** API - HTTP calls with offline fallback */
import { ROUTES, buildUrl } from '../config/routes';
import { getUuid } from './workspace';
import IndexedDB from './offline/IndexedDB';
import SyncManager from './offline/SyncManager';
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

  if (pending.length > 0) return pending.at(-1).data;

  try {
    const response = await fetch(buildUrl('state', uuid), { signal: AbortSignal.timeout(3000) });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    const saved = await IndexedDB.saveWorkspace(
      uuid,
      { video: null, tracks: [], markers: [], ...data },
      {
        expectedRevision: cached?.localRevision || 0
      }
    );

    return workspaceState(saved);
  } catch {
    const local = await IndexedDB.getWorkspace(uuid);
    if (hasLocalState(local)) return workspaceState(local);

    throw new Error('This project has no local save. Open it while connected first.');
  }
};

export const backup = async ({ video, navigator, transcriptions }) => {
  const uuid = getUuid();
  const data = {
    video: video?.src ?? null,
    markers: navigator?.markers ?? [],
    tracks: navigator?.tracks ?? [],
    transcriptions: transcriptions ?? {}
  };

  await IndexedDB.saveWorkspaceBackup(uuid, data);
  await SyncManager.sync();
  const pending = await IndexedDB.getPendingSync();

  return {
    success: true,
    offline: pending.some(operation => operation.type === 'backup' && operation.uuid === uuid)
  };
};

export const publish = ({ video, navigator, duration, format }) =>
  safeFetch(buildUrl('exports', getUuid()), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      duration: duration || video.duration,
      video: video.src,
      tracks: navigator.tracks,
      format: format || 'mp3'
    })
  }).then(r => r.json());

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

export const deleteAudioLibraryItem = id =>
  safeFetch(buildUrl('audio', getUuid(), `/${id}`), { method: 'DELETE' }).then(r => r.json());

export const getAudioList = async () => {
  const response = await safeFetch(buildUrl('audio', getUuid()));

  return response.json();
};

export const getProjects = async () => {
  try {
    const projects = await safeFetch(
      ROUTES.workspaces,
      { signal: AbortSignal.timeout(3000) },
      true
    ).then(r => r.json());

    for (const project of projects) {
      const local = await IndexedDB.saveWorkspace(project.uuid, {
        title: project.title,
        isVideoLoaded: project.isVideoLoaded
      });
      project.hasLocalState = hasLocalState(local);
    }

    return projects;
  } catch {
    // Store persistence records are not projects (including legacy global keys).
    const workspaces = (await IndexedDB.getAllWorkspaces()).filter(record => !('data' in record));

    if (workspaces.length > 0) {
      return workspaces.map(record => ({
        uuid: record.uuid,
        title: record.title || 'Untitled',
        isVideoLoaded: record.isVideoLoaded || false,
        hasLocalState: hasLocalState(record)
      }));
    }

    throw new Error('No cached projects');
  }
};

export const createProject = async title => {
  const response = await safeFetch(ROUTES.workspaces, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  }).then(r => r.json());

  if (response.success) {
    await IndexedDB.saveWorkspace(response.uuid, { title, isVideoLoaded: false });
  }

  return response;
};

export const deleteProject = async uuid => {
  await IndexedDB.deleteWorkspace(uuid);

  return safeFetch(`${ROUTES.workspaces}/${uuid}`, { method: 'DELETE' }).then(r => r.json());
};

export const startStemsSeparation = async audioId => {
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
  const response = await safeFetch(buildUrl('video', getUuid(), '/scene-detect'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options)
  });

  return response.json();
};
