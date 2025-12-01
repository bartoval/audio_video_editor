const { NotFoundError } = require('./errors');

// ============================================================================
// File Validation Utilities
// Centralizes file existence checks with consistent error handling
// ============================================================================

/**
 * Ensure file exists or throw NotFoundError
 * @param {object} fileRepo - File repository instance
 * @param {string} filePath - Path to check
 * @param {string} errorMessage - Custom error message
 * @returns {string} The file path if exists
 * @throws {NotFoundError} If file doesn't exist
 */
function requireFile(fileRepo, filePath, errorMessage = 'File not found') {
  if (!fileRepo.exists(filePath)) {
    throw new NotFoundError(errorMessage);
  }

  return filePath;
}

/**
 * Ensure video file exists
 */
function requireVideoFile(fileRepo, filePath) {
  return requireFile(fileRepo, filePath, 'Video file not found');
}

/**
 * Ensure audio file exists
 */
function requireAudioFile(fileRepo, filePath) {
  return requireFile(fileRepo, filePath, 'Audio file not found');
}

/**
 * Ensure thumbnail file exists
 */
function requireThumbFile(fileRepo, filePath) {
  return requireFile(fileRepo, filePath, 'Thumbnail not found');
}

/**
 * Ensure published video exists
 */
function requirePublishedVideo(fileRepo, filePath) {
  return requireFile(fileRepo, filePath, 'Published video not found');
}

module.exports = {
  requireFile,
  requireVideoFile,
  requireAudioFile,
  requireThumbFile,
  requirePublishedVideo
};
