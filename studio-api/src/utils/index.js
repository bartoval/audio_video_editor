const { createLogger } = require('./logger');
const { formatDuration } = require('./time');
const { NotFoundError, ValidationError, AppError } = require('./errors');
const { createTrackListManager } = require('./trackList');
const {
  requireFile,
  requireVideoFile,
  requireAudioFile,
  requireThumbFile,
  requirePublishedVideo
} = require('./fileValidation');
const {
  parseFilename,
  generateUniqueFilename,
  generateStretchedFilename,
  getMimeType,
  getAudioMimeType,
  getVideoMimeType,
  getImageMimeType,
  sanitizeFilename,
  sanitizePath,
  AUDIO_MIME_TYPES,
  VIDEO_MIME_TYPES,
  IMAGE_MIME_TYPES
} = require('./filename');

module.exports = {
  // Logger
  createLogger,

  // Time
  formatDuration,

  // Errors
  NotFoundError,
  ValidationError,
  AppError,

  // TrackList
  createTrackListManager,

  // File Validation
  requireFile,
  requireVideoFile,
  requireAudioFile,
  requireThumbFile,
  requirePublishedVideo,

  // Filename
  parseFilename,
  generateUniqueFilename,
  generateStretchedFilename,
  getMimeType,
  getAudioMimeType,
  getVideoMimeType,
  getImageMimeType,
  sanitizeFilename,
  sanitizePath,
  AUDIO_MIME_TYPES,
  VIDEO_MIME_TYPES,
  IMAGE_MIME_TYPES
};
