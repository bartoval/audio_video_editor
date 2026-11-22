/** Zone types */
export const ZONE_TYPE = {
  TRACKS: 'tracks'
};

/** Track toolbar actions */
export const TRACK_ACTION = {
  VOLUME: 'volume',
  PAN: 'pan',
  CUT: 'cut'
};

/** Cut mode states */
export const CUT_STATE = {
  INACTIVE: 'inactive',
  ACTIVE: 'active',
  PENDING: 'pending',
  DRAGGING: 'dragging',
  READY: 'ready'
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

/** Timeline scroll modes */
export const SCROLL_MODE = {
  CONTINUOUS: 'continuous',
  PAGE_FLIP: 'page-flip'
};

/** Timeline configuration */
export const TIMELINE = {
  SCROLL_MODE: SCROLL_MODE.PAGE_FLIP
};

/** Audio-only mode configuration */
export const AUDIO_ONLY = {
  DEFAULT_DURATION: 600,
  MIN_DURATION: 10
};

/** Snapping configuration */
export const SNAP = {
  BASE_TOLERANCE: 14,
  TOLERANCE_MIN: 8,
  TOLERANCE_MAX: 30,
  HYSTERESIS_MULTIPLIER: 1.2,
  GRID_INTERVAL: 1.0,
  BEATS_PER_BAR: 4
};

/** Connection status */
export const CONNECTION_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline'
};

/** Thumbnail generation status */
export const THUMBS_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  READY: 'ready',
  ERROR: 'error'
};

/** Event names for EventService */
export const EVENT = {
  VIDEO_LOADED: 'video:loaded',
  VIDEO_DELETED: 'video:deleted',
  VIDEO_RESIZED: 'video:resized',
  PLAYBACK_PLAY: 'playback:play',
  PLAYBACK_PAUSE: 'playback:pause',
  PLAYBACK_RESET: 'playback:reset',
  PLAYBACK_REWIND: 'playback:rewind',
  PLAYBACK_SKIP_BACK: 'playback:skipBack',
  PLAYBACK_SKIP_FORWARD: 'playback:skipForward',
  PLAYBACK_FAST_FORWARD: 'playback:fastForward',
  PLAYBACK_SET_TIME_SLICE: 'playback:setTimeSlice',
  PLAYBACK_MOVE_FROM_NAVIGATOR: 'playback:moveFromNavigator',
  PLAYBACK_MOVE_FROM_PLAYER: 'playback:moveFromPlayer',
  LAYOUT_RESIZE: 'layout:resize',
  TIMELINE_ADD_TRACKS: 'timeline:addTracks',
  LIBRARY_REMOVED: 'library:removed',
  /** Side panel tab chosen by the user: { tab: 'library' | 'inspector' } */
  SIDE_PANEL_TAB: 'sidePanel:tab',
  /** Inspector opened or closed (tab, shortcut, toolbar): { isOpen: boolean } */
  INSPECTOR_VISIBILITY: 'inspector:visibility',
  CONNECTION: 'connection',
  THUMBNAILS: 'thumbnails',
  MARKER_PREVIOUS: 'marker:previous',
  MARKER_NEXT: 'marker:next',
  LOOP_TOGGLE: 'loop:toggle',
  MARKERS_CHANGED: 'markers:changed',
  WORKSPACE_LOAD_VIDEO: 'workspace:loadVideo',
  WORKSPACE_INIT_AUDIO_ONLY: 'workspace:initAudioOnly',
  WORKSPACE_GET_DATA: 'workspace:getData',
  JOB_COMPLETED: 'job:completed',
  JOB_FAILED: 'job:failed',
  JOB_COUNT_CHANGED: 'job:countChanged',
  SCENE_DETECTION_READY: 'sceneDetection:ready'
};

/** Error Context Messages */
export const ERROR_CONTEXT = {
  FETCH_PROJECTS: 'Failed to fetch projects',
  LOAD_WORKSPACE: 'Failed to load workspace',
  LOAD_VIDEO: 'Failed to load video',
  THUMBNAIL_GENERATION: 'Thumbnail generation failed',
  DELETE_TRACK: 'Failed to delete track',
  UPLOAD_FILE: 'Failed to upload file',
  STEMS_SEPARATION: 'Failed to separate stems',
  SCENE_DETECTION: 'Failed to start scene detection'
};

/** Warning Messages */
export const WARNING = {
  AUDIO_EXCEEDS_VIDEO: 'Some audio tracks extend past the video duration'
};

/** UI Labels */
export const LABEL = {
  LOAD: 'Load',
  LOAD_OFFLINE: 'Load local save',
  SAVE: 'Save locally',
  SYNC_SERVER: 'Sync server',
  SAVED: 'Saved',
  SAVED_LOCALLY: 'Saved on this device. Use Sync server to send changes.',
  SAVE_OFFLINE: 'Save on this device',
  PREVIEW: 'Preview',
  PREVIEW_OFFLINE: 'Cannot preview while offline',
  LOADED: 'Loaded',
  OFFLINE: 'Offline Support',
  OFFLINE_ENABLED: 'Offline mode enabled',
  OFFLINE_DISABLED: 'Offline mode disabled',
  EXPORTING: 'Exporting...',
  EXPORTING_SUBTEXT: 'This may take a few minutes',
  EXPORT_FAILED: 'Export failed',
  TRY_AGAIN: 'Please try again',
  DOWNLOAD: 'Download',
  CLOSE: 'Close',
  DEFAULT_FILENAME: 'export.mp4',
  SELECT_FORMAT: 'Select Format',
  SELECT_FORMAT_SUBTEXT: 'Choose export format',
  FORMAT_MP3: 'MP3',
  FORMAT_MP3_DESC: 'Smaller file, good quality',
  FORMAT_WAV: 'WAV',
  FORMAT_WAV_DESC: 'Lossless, larger file',
  EXPORT: 'Export',
  ADD_WORKSPACE: 'Add Workspace',
  ADD_WORKSPACE_OFFLINE: 'Cannot create workspace while offline',
  SELECT_WORKSPACE_OFFLINE: 'Open a project saved on this device',
  DELETE: 'Delete',
  DELETE_WORKSPACE: 'Delete Workspace',
  DELETE_WORKSPACE_OFFLINE: 'Cannot delete workspace while offline',
  DELETE_WORKSPACE_DEFAULT: 'Cannot delete default workspace',
  DELETE_WORKSPACE_PROMPT: 'Delete "{title}"?',
  DELETE_WORKSPACE_WARNING: 'This action cannot be undone.',
  CREATE: 'Create',
  CANCEL: 'Cancel',
  WORKSPACE_TITLE_PLACEHOLDER: 'Workspace title',
  NO_VIDEO: 'No video loaded',
  IMPORT_VIDEO: 'Import Video',
  CHANGE_VIDEO: 'Change Video',
  DELETE_VIDEO: 'Delete Video',
  RESIZE_VIDEO: 'Resize video',
  CONVERTING: 'Converting video...',
  PLEASE_WAIT: 'Please wait',
  PROCESSING: 'Processing',
  CONFIRM: 'Confirm',
  STATUS_ONLINE: 'Online',
  STATUS_OFFLINE: 'Offline',
  VIDEO_OFFLINE: 'Video is not on this device. Use Sync server, then reopen the project.',
  VIDEO_LOW_QUALITY: 'Low quality (offline)',
  LIBRARY_OFFLINE: 'Offline',
  LIBRARY_OFFLINE_HINT: 'Library unavailable while offline',
  LIBRARY_PLAY: 'Play',
  LIBRARY_INFO: 'Track info',
  LIBRARY_ADD_TO_TIMELINE: 'Add to timeline',
  LIBRARY_DELETE: 'Delete',
  LIBRARY_DOWNLOAD: 'Download',
  DOWNLOAD_MP3: 'Download MP3',
  DOWNLOAD_WAV: 'Download WAV',
  DOWNLOAD_STEMS: 'Download Stems',
  DOWNLOAD_STEMS_DESC: 'Vocals, drums, bass, other',
  MORE_OPTIONS: 'More options',
  STEMS_PROCESSING: 'Processing Stems',
  STEMS_PROCESSING_DESC: 'Separating audio into individual stems. This may take a few minutes.',
  STEMS_READY: 'Stems Ready',
  STEMS_READY_DESC: 'Your stems have been separated and are downloading.',
  STEMS_FAILED: 'Stems Failed',
  STEMS_CLOSE_HINT: 'You can close this and continue working.',
  VIEW_TRANSCRIPT: 'View Transcript',
  SCENE_DETECTION: 'Detect Scenes',
  SCENE_DETECTION_PROCESSING: 'Detecting scenes...',
  SCENE_DETECTION_READY: 'Scene Detection Ready',
  SCENE_DETECTION_FAILED: 'Scene Detection Failed',
  TRANSCRIPT_SEARCH_PLACEHOLDER: 'Search transcript...',
  TRANSCRIPT_NO_RESULTS: 'No matches found',
  TRANSCRIPT_EMPTY: 'No transcription available',
  PENDING_OPERATIONS: 'pending operations',
  JOB_PANEL_TITLE: 'Active Jobs',
  JOB_DISMISS: 'Dismiss',
  JOB_NO_ETA: '\u2014',
  JOB_TYPE_STEMS: 'Stems',
  JOB_TYPE_SCENE_DETECT: 'Scene Detect',
  LIBRARY_DRAG: 'Drag to timeline',
  LIBRARY_SELECT_ALL: 'Select All',
  LIBRARY_DESELECT_ALL: 'Deselect All',
  LIBRARY_IMPORT_FILES: 'Import Files',
  LIBRARY_IMPORT_FOLDER: 'Import Folder',
  LIBRARY_SEARCH: 'Search...',
  LIBRARY_DROP_TITLE: 'Drop audio files here',
  LIBRARY_DROP_HINT: 'or click to browse',
  LIBRARY_TRACKS: 'tracks',
  LIBRARY_SELECTED: 'selected',
  LIBRARY_ADD: 'Add',
  LIBRARY_TIMELINE: 'Timeline',
  TRACK_INFO: 'Track Info',
  TRACK_NAME: 'Name',
  TRACK_FORMAT: 'Format',
  TRACK_CODEC: 'Codec',
  TRACK_BIT_DEPTH: 'Bit depth',
  TRACK_CHANNELS: 'Channels',
  TRACK_SAMPLE_RATE: 'Sample rate',
  TRACK_BITRATE: 'Bitrate',
  TRACK_DURATION: 'Duration',
  TRACK_SIZE: 'Size',
  TOOLBAR_CUT: 'Cut (C)',
  TOOLBAR_DUPLICATE: 'Duplicate (D)',
  TOOLBAR_DELETE: 'Delete (Del)',
  TOOLBAR_MUTE: 'Mute (U)',
  TOOLBAR_VOLUME: 'Volume (V)',
  TOOLBAR_PAN: 'Pan (P)',
  TOOLBAR_INSPECTOR: 'Inspector (I)',
  TOOLBAR_SNAP: 'Snap (S)',
  TOOLBAR_SUPERZOOM: 'SuperZoom (Z)',
  LOADING: 'Loading...'
};
