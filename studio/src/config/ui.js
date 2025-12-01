/** UI Constants */

export const SLIDER_THUMB_WIDTH = 12;
export const MARGIN = SLIDER_THUMB_WIDTH / 2;

export const RESIZE_BOUNDS = {
  minHeight: 155,
  defaultHeight: 550,
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

export const SCENE_COLORS = [
  '#0dcaf0',
  '#20c997',
  '#6f42c1',
  '#d63384',
  '#fd7e14',
  '#ffc107',
  '#198754',
  '#0d6efd',
  '#6610f2',
  '#dc3545'
];

export const THEME = {
  defaultColor: '#6c757d',
  waveformColor: '#0dcaf0',
  btnVariant: {
    primary: 'outline-info',
    secondary: 'outline-secondary'
  }
};

export const TOAST_DURATION = {
  short: 2000,
  default: 3000,
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

export const THUMBS = {
  MODE: 'tiles', // 'legacy' = single sprite strip, 'tiles' = Netflix-style grid tiles
  SCALES: ['0.01', '0.02', '0.05', '0.1'],
  EXTENSION: '.webp',
  // Tiles mode config (must match backend config)
  TILES: {
    COLS: 10,
    ROWS: 10
  }
};
