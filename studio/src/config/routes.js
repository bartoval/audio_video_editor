/** Routes - single source of truth for all endpoints and paths */

const BASE = '';
const API = '/api/v1';
const WORKSPACES = `${API}/workspaces`;

// In production SSE goes through nginx, in dev directly to backend (bypass Vite proxy buffering)
const IS_DEV = import.meta.env.DEV;
const SSE_BASE = IS_DEV ? 'http://localhost:8080' : '';

export const ROUTES = {
  workspaces: WORKSPACES,
  config: `${API}/config`
};

export const buildUrl = (route, uuid, suffix = '') => {
  const base = WORKSPACES;

  const paths = {
    workspaces: base,
    state: `${base}/${uuid}/state`,
    events: `${SSE_BASE}${base}/${uuid}/events`,
    video: `${base}/${uuid}/video`,
    videoFile: `${base}/${uuid}/video/file`,
    videoSmall: `${base}/${uuid}/video/small`,
    videoConvert: `${base}/${uuid}/video/convert`,
    videoConvertStream: `${base}/${uuid}/video/convert/stream`,
    videoThumbnails: `${base}/${uuid}/video/thumbnails`,
    audio: `${base}/${uuid}/audio`,
    audioFile: `${base}/${uuid}/audio`,
    timeline: `${base}/${uuid}/timeline`,
    exports: `${base}/${uuid}/exports`
  };

  if (!paths[route]) {
    throw new Error(`Unknown route: ${route}`);
  }

  return `${paths[route]}${suffix}`;
};

export const ASSETS = {
  stretchWorker: `${BASE}/rubberband-worker.js`,
  processorWorker: `${BASE}/audio-processor-worker.js`,
  waveformWorker: `${BASE}/waveform-worker.js`
};

export const NAV = {
  home: BASE || '/',
  workspace: uuid => `${BASE}/${uuid}`
};
