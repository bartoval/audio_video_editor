/** UI Constants */

export const SLIDER_THUMB_WIDTH = 12;
export const MARGIN = SLIDER_THUMB_WIDTH / 2;
export const SCRUBBER_LINE_OFFSET = 50;

export const RESIZE_BOUNDS = {
  minHeightPercent: 0.25,
  defaultHeightPercent: 0.35,
  headerOffset: 90
};

export const CANVAS_UP_BOUND = 32767;

export const TRACK_COLORS = [
  'rgba(189, 121, 0, 1)',
  'rgba(27, 11, 26, 1)',
  'rgba(153, 153, 0, 1)',
  'rgba(102, 51, 0, 1)',
  'rgba(153, 0, 0, 1)',
  'rgba(67, 109, 67, 1)',
  'rgba(153, 153, 204, 1)',
  'rgba(153, 153, 153, 1)',
  'rgba(153, 153, 255, 1)',
  'rgba(204, 153, 255, 1)',
  'rgba(255, 153, 255, 1)',
  'rgba(255, 153, 204, 1)',
  'rgba(224, 224, 224, 1)',
  'rgba(102, 178, 255, 1)',
  'rgba(59, 68, 101, 1)',
  'rgba(153, 51, 255, 1)'
];

export const THEME = {
  // Canvas non risolve CSS var: usare colore reale per waveform
  waveformColor: '#c084fc',
  btnVariant: {
    primary: 'outline-info',
    secondary: 'outline-secondary'
  }
};

export const TOAST_DURATION = {
  short: 2000,
  default: 3000,
  medium: 4000,
  long: 5000
};

export const Z_INDEX = {
  dropdown: 1000,
  modal: 1050,
  toast: 1100
};

export const UPLOAD = {
  VIDEO_EXTENSIONS: '.mp4,.mov,.avi,.mkv,.webm,.m4v',
  AUDIO_EXTENSIONS: ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'],
  CHUNK_SIZE: 1024 * 1024,
  PARALLEL_UPLOADS: 3
};

export const SSE = {
  RECONNECT_DELAY: 3000, // Wait before retrying SSE connection
  OFFLINE_DELAY: 2000 // Wait before declaring offline (avoids false positives)
};

export const JOB_TRACKER = {
  STORAGE_KEY: 'studio_pending_jobs',
  ESTIMATION_RATIO: { transcribe: 0.33, stems: 1.5 },
  ELAPSED_TICK_MS: 1000
};

export const PLAYBACK = {
  SKIP_SECONDS: 5, // Forward/backward skip amount
  SYNC_THRESHOLD_MS: 50 // Audio-video sync tolerance
};

export const NETWORK = {
  DEFAULT_TIMEOUT: 30000, // Fetch timeout in ms
  MAX_RETRIES: 3 // Retry attempts for failed requests
};

export const THUMBNAILS = {
  MAX_CACHE_SIZE: 30,
  DEBOUNCE_MS: 50,
  MAX_RETRIES: 60,
  DEFAULT_SCALE: '0.1'
};

export const WORKSPACE = {
  DEFAULT_UUID: '0',
  SELECT_WIDTH: 200
};

export const SELECTOR = {
  STUDIO: '.studio',
  PREVIEW: '.studio-preview',
  TIMELINE: '.studio-timeline',
  LIBRARY: '.studio-library .library',
  HEADER: '.studio-header .container-fluid',
  FOOTER: '.studio-footer'
};

export const CSS_CLASS = {
  HAS_VIDEO: 'has-video',
  HIDE: 'hide',
  LOADING: 'loading',
  VISIBLE: 'visible',
  DRAGGING: 'dragging',
  SELECTED: 'selected',
  ACTIVE: 'active',
  OPEN: 'open',
  SHOW: 'show',
  // Video component classes
  VIDEO_CONTAINER: 'content-video',
  VIDEO_UPLOADER: 'video-uploader',
  VIDEO_EMPTY_STATE: 'video-empty-state',
  VIDEO_UPLOAD_PROGRESS: 'video-upload-progress',
  VIDEO_ACTIONS: 'video-actions',
  VIDEO_OFFLINE_OVERLAY: 'video-offline-overlay',
  VIDEO_QUALITY_BADGE: 'video-quality-badge',
  VIDEO_VIEWER: 'viewer',
  VIDEO_RESIZER: 'resizer'
};
