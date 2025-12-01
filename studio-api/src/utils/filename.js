const path = require('path');

// ============================================================================
// Filename Utilities
// Centralizes filename parsing, generation, and MIME type detection
// ============================================================================

/**
 * Parse filename into components
 * @param {string} filename - Filename to parse
 * @returns {{ ext: string, baseName: string, extLower: string }}
 */
function parseFilename(filename) {
  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext);
  const extLower = ext.slice(1).toLowerCase();

  return { ext, baseName, extLower };
}

/**
 * Generate unique filename with suffix
 * @param {string} filename - Original filename
 * @param {string} suffix - Suffix to add (e.g., 'stretched', 'processed')
 * @returns {string} Unique filename
 */
function generateUniqueFilename(filename, suffix = '') {
  const { ext, baseName } = parseFilename(filename);
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const suffixPart = suffix ? `-${suffix}` : '';

  return `${baseName}${suffixPart}-${uniqueId}${ext}`;
}

/**
 * Generate stretched audio filename
 * @param {string} filename - Original filename
 * @returns {string} Stretched filename
 */
function generateStretchedFilename(filename) {
  const { ext, baseName } = parseFilename(filename);

  return `${baseName}-stretched-${Date.now()}${ext}`;
}

// ============================================================================
// MIME Types
// ============================================================================

const AUDIO_MIME_TYPES = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  aac: 'audio/aac',
  m4a: 'audio/mp4'
};

const VIDEO_MIME_TYPES = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime'
};

const IMAGE_MIME_TYPES = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png'
};

const ALL_MIME_TYPES = {
  ...AUDIO_MIME_TYPES,
  ...VIDEO_MIME_TYPES,
  ...IMAGE_MIME_TYPES
};

/**
 * Get MIME type for filename
 * @param {string} filename - Filename
 * @param {string} defaultType - Default MIME type
 * @returns {string} MIME type
 */
function getMimeType(filename, defaultType = 'application/octet-stream') {
  const { extLower } = parseFilename(filename);

  return ALL_MIME_TYPES[extLower] || defaultType;
}

/**
 * Get audio MIME type
 */
function getAudioMimeType(filename) {
  const { extLower } = parseFilename(filename);

  return AUDIO_MIME_TYPES[extLower] || 'audio/mpeg';
}

/**
 * Get video MIME type
 */
function getVideoMimeType(filename) {
  const { extLower } = parseFilename(filename);

  return VIDEO_MIME_TYPES[extLower] || 'video/mp4';
}

/**
 * Get image MIME type
 */
function getImageMimeType(filename) {
  const { extLower } = parseFilename(filename);

  return IMAGE_MIME_TYPES[extLower] || 'image/webp';
}

/**
 * Sanitize filename for security (prevent path traversal)
 * @param {string} filename - Potentially unsafe filename
 * @returns {string} Safe filename
 */
function sanitizeFilename(filename) {
  return path.basename(filename);
}

/**
 * Sanitize a path that may include subdirectories (e.g., "0.01/tile_0.webp")
 * Prevents path traversal (..) while allowing forward slashes
 * @param {string} filePath - Potentially unsafe path
 * @returns {string} Safe path
 */
function sanitizePath(filePath) {
  // Normalize to forward slashes, remove any .. segments
  const normalized = filePath
    .replace(/\\/g, '/')
    .split('/')
    .filter(segment => segment !== '..' && segment !== '.' && segment.length > 0)
    .join('/');

  return normalized;
}

module.exports = {
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
