/** Routes - single source of truth for all endpoints and paths */

// ============================================================================
// Base paths
// ============================================================================

const BASE = '';
const API = '/api/v1';
const WORKSPACES = `${API}/workspaces`;

// ============================================================================
// URL Builders
// ============================================================================

export const ROUTES = {
  workspaces: WORKSPACES
};

export const buildUrl = (route, uuid, suffix = '') => {
  const base = WORKSPACES;

  const paths = {
    // Workspaces
    workspaces: base,
    state: `${base}/${uuid}/state`,

    // Video
    video: `${base}/${uuid}/video`,
    videoFile: `${base}/${uuid}/video/file`,
    videoConvert: `${base}/${uuid}/video/convert`,
    videoConvertStream: `${base}/${uuid}/video/convert/stream`,
    videoAudio: `${base}/${uuid}/video/audio`,
    videoThumbnails: `${base}/${uuid}/video/thumbnails`,

    // Audio
    audio: `${base}/${uuid}/audio`,
    audioFile: `${base}/${uuid}/audio`,

    // Timeline
    timeline: `${base}/${uuid}/timeline`,

    // Exports
    exports: `${base}/${uuid}/exports`
  };

  if (!paths[route]) {
    throw new Error(`Unknown route: ${route}`);
  }

  return `${paths[route]}${suffix}`;
};

// ============================================================================
// Static Assets / Workers
// ============================================================================

export const ASSETS = {
  stretchWorker: `${BASE}/rubberband-worker.js`,
  processorWorker: `${BASE}/audio-processor-worker.js`
};

// ============================================================================
// Navigation Paths
// ============================================================================

export const NAV = {
  home: BASE || '/',
  workspace: uuid => `${BASE}/${uuid}`
};
