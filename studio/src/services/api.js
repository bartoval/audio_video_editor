// @ts-check

/** API - HTTP calls with offline fallback */
import { ROUTES, buildUrl } from '../config/routes';
import { getUuid } from './workspace';
import { IndexedDB } from './offline';
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

export const load = async () => {
  const uuid = getUuid();

  try {
    const response = await fetch(buildUrl('state', uuid));

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data && Object.keys(data).length > 0) {
      await IndexedDB.saveWorkspace(uuid, data);
    }

    return data;
  } catch {
    const cached = await IndexedDB.getWorkspace(uuid);

    if (cached) {
      return cached;
    }

    return {};
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

  await IndexedDB.saveWorkspace(uuid, data);

  try {
    return await safeFetch(
      buildUrl('state', uuid),
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      },
      true // silent: don't show error toast, we handle offline gracefully
    ).then(r => r.json());
  } catch {
    await IndexedDB.addPendingSync({ type: 'backup', uuid, data });

    return { success: true, offline: true };
  }
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
    const projects = await safeFetch(ROUTES.workspaces).then(r => r.json());

    for (const project of projects) {
      const existing = await IndexedDB.getWorkspace(project.uuid);

      await IndexedDB.saveWorkspace(project.uuid, {
        ...existing,
        title: project.title,
        isVideoLoaded: project.isVideoLoaded
      });
    }

    return projects;
  } catch {
    const workspaces = await IndexedDB.getAllWorkspaces();

    if (workspaces.length > 0) {
      return workspaces.map(({ uuid, title, isVideoLoaded }) => ({
        uuid,
        title: title || 'Untitled',
        isVideoLoaded: isVideoLoaded || false
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
