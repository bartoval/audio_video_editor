/** API - HTTP calls with offline fallback */
import { ROUTES, buildUrl } from '../config/routes';
import { getUuid } from './workspace';
import { IndexedDB } from './offline';
import { isOnline } from '../lib';
import ErrorHandler from './ErrorHandler';

// ============================================================================
// Fetch Wrapper
// ============================================================================

class ApiError extends Error {
  constructor(message, status, url) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
  }
}

const safeFetch = async (url, options = {}) => {
  if (!isOnline()) {
    const error = new ApiError('You are offline', 0, url);
    ErrorHandler.handle(error);

    throw error;
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      const error = new ApiError(`HTTP ${response.status}: ${errorText}`, response.status, url);
      ErrorHandler.handle(error);

      throw error;
    }

    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    const networkError = new ApiError(error.message || 'Network error', 0, url);
    ErrorHandler.handle(networkError);

    throw networkError;
  }
};

const call = async (route, options = {}) => {
  const response = await safeFetch(buildUrl(route, getUuid()), options);

  return response.json();
};

// ============================================================================
// Workspace API
// ============================================================================

export const load = async () => {
  const uuid = getUuid();

  try {
    // Direct fetch without ErrorHandler - we have IndexedDB fallback
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
    // Silent fallback to IndexedDB when offline
    const cached = await IndexedDB.getWorkspace(uuid);

    if (cached) {
      return cached;
    }

    return {};
  }
};

export const backup = async ({ video, navigator }) => {
  const uuid = getUuid();
  const data = {
    video: video.src,
    scenes: navigator.scenes,
    tracks: navigator.tracks
  };

  // Always save locally first
  await IndexedDB.saveWorkspace(uuid, data);

  try {
    return await safeFetch(buildUrl('state', uuid), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json());
  } catch {
    // Queue for sync when back online
    await IndexedDB.addPendingSync({ type: 'backup', uuid, data });

    return { success: true, offline: true };
  }
};

export const publish = ({ video, navigator }) =>
  safeFetch(buildUrl('exports', getUuid()), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      duration: video.duration,
      video: video.src,
      tracks: navigator.tracks
    })
  }).then(r => r.json());

// ============================================================================
// Video API
// ============================================================================

export const getVideoUploadUrl = () => buildUrl('videoFile', getUuid());

export const convertVideo = () =>
  safeFetch(buildUrl('videoConvert', getUuid()), { method: 'POST' });

export const isVideoConverted = () =>
  safeFetch(buildUrl('videoConvert', getUuid())).then(r => r.json());

// ============================================================================
// Audio API
// ============================================================================

export const getAudioUploadUrl = () => buildUrl('audio', getUuid());

export const deleteAudioLibraryItem = id =>
  safeFetch(buildUrl('audio', getUuid(), `/${id}`), { method: 'DELETE' }).then(r => r.json());

// ============================================================================
// Workspaces API
// ============================================================================

export const getProjects = async () => {
  try {
    const projects = await safeFetch(ROUTES.workspaces).then(r => r.json());

    // Save each project to workspaces for offline access
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
    // Offline: get projects from workspaces cache
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
  // Always delete locally first
  await IndexedDB.deleteWorkspace(uuid);

  return safeFetch(`${ROUTES.workspaces}/${uuid}`, { method: 'DELETE' }).then(r => r.json());
};
