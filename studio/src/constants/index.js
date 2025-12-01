/** Zone types */
export const ZONE_TYPE = {
  TRACKS: 'tracks',
  SCENES: 'scenes'
};

/** Track toolbar actions */
export const TRACK_ACTION = {
  CUT: 'cut',
  COPY: 'copy',
  REMOVE: 'remove',
  VOLUME: 'volume',
  PAN: 'pan'
};

/** Notification types */
export const NOTIFY_TYPE = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

/** Timing constants */
export const TIMING = {
  SYNC_CHECK_INTERVAL: 500,
  RETRY_DELAY: 1000,
  POLL_INTERVAL: 2000,
  UPLOAD_COMPLETE_DELAY: 2000
};

/** Audio processing limits */
export const AUDIO = {
  MAX_DURATION_WASM: 900
};

/** Tracks constants */
export const TRACKS = {
  DRAG_THROTTLE_MS: 16,
  TOOLTIP_THROTTLE_MS: 16,
  MIN_CUT_DURATION: 0.1,
  MIN_CUT_DURATION_FALLBACK: 0.01,
  MIN_STRETCH_FACTOR: 0.5,
  MAX_STRETCH_FACTOR: 2.0,
  DEFAULT_STRETCH_FACTOR: 1.0,
  ENVELOPE_HEIGHT_PERCENT: 100,
  WAVEFORM_LINE_WIDTH: 0.5
};

/** Connection status */
export const CONNECTION_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline'
};

/** UI Labels */
export const LABEL = {
  // Menu
  LOAD: 'Load',
  SAVE: 'Save',
  PREVIEW: 'Preview',
  LOADED: 'Loaded',
  WASM: 'WASM Main Thread',
  WASM_BROWSER: 'Stretch on main thread (blocks UI)',
  WASM_SERVER: 'Server fallback',
  WORKER: 'WASM Worker',
  WORKER_ENABLED: 'Stretch in background thread',
  WORKER_DISABLED: 'Stretch on main thread',
  OFFLINE: 'Offline Support',
  OFFLINE_ENABLED: 'Offline mode enabled',
  OFFLINE_DISABLED: 'Offline mode disabled',
  PARALLEL_STRETCH: 'WASM Parallel',
  PARALLEL_STRETCH_ENABLED: 'Multi-worker with crossfade',
  PARALLEL_STRETCH_DISABLED: 'Single worker audio stretching',
  TILES_MODE: 'Thumbs with chunks',
  TILES_MODE_ENABLED: 'Netflix-style chunked tiles',
  TILES_MODE_DISABLED: 'Legacy sprite strips',

  // Preview Modal
  EXPORTING: 'Exporting video...',
  EXPORTING_SUBTEXT: 'This may take a few minutes',
  EXPORT_FAILED: 'Export failed',
  TRY_AGAIN: 'Please try again',
  DOWNLOAD: 'Download',
  CLOSE: 'Close',
  DEFAULT_FILENAME: 'export.mp4',

  // Project Selector
  ADD_WORKSPACE: 'Add Workspace',
  ADD_WORKSPACE_OFFLINE: 'Cannot create workspace while offline',
  DELETE: 'Delete',
  DELETE_WORKSPACE: 'Delete Workspace',
  DELETE_WORKSPACE_OFFLINE: 'Cannot delete workspace while offline',
  DELETE_WORKSPACE_DEFAULT: 'Cannot delete default workspace',
  CREATE: 'Create',
  CANCEL: 'Cancel',
  WORKSPACE_TITLE_PLACEHOLDER: 'Workspace title',

  // Uploader
  NO_VIDEO: 'No video loaded',
  IMPORT_VIDEO: 'Import Video',
  CHANGE_VIDEO: 'Change Video',
  CONVERTING: 'Converting video...',
  PLEASE_WAIT: 'Please wait',
  PROCESSING: 'Processing',

  // Confirm Modal
  CONFIRM: 'Confirm',

  // Status Bar
  STATUS_ONLINE: 'Online',
  STATUS_OFFLINE: 'Offline',

  // Library Offline
  LIBRARY_OFFLINE: 'Offline',
  LIBRARY_OFFLINE_HINT: 'Library unavailable while offline',

  // App Loader
  LOADING: 'Loading...'
};
