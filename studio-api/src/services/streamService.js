const path = require('path');
const {
  createLogger,
  requireVideoFile,
  requireAudioFile,
  requireThumbFile,
  sanitizeFilename,
  sanitizePath,
  getAudioMimeType
} = require('../utils');
const { projectRepositoryCreator, fileRepositoryCreator } = require('../repositories');
const config = require('../config');

const logger = createLogger('StreamService');

// Destructure path constants
const { dirs, files } = config.paths;

function streamServiceCreator() {
  const projectRepo = projectRepositoryCreator();
  const fileRepo = fileRepositoryCreator(config.projectsPath);

  function getVideoStream(projectUuid, range) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const filePath = path.join(projectPath, files.video);

    requireVideoFile(fileRepo, filePath);

    const stats = fileRepo.getStats(filePath);
    const fileSize = stats.size;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        return { error: 'range_not_satisfiable', fileSize };
      }

      return {
        stream: fileRepo.createReadStream(filePath, { start, end }),
        start,
        end,
        fileSize,
        chunkSize: end - start + 1,
        mimeType: 'video/mp4'
      };
    }

    return {
      stream: fileRepo.createReadStream(filePath),
      fileSize,
      mimeType: 'video/mp4'
    };
  }

  function getAudioStream(projectUuid) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const filePath = path.join(projectPath, files.audioMp3);

    requireAudioFile(fileRepo, filePath);

    return {
      stream: fileRepo.createReadStream(filePath),
      mimeType: 'audio/mpeg'
    };
  }

  function getLibraryAudioStream(projectUuid, filename) {
    const safeFilename = sanitizeFilename(filename);
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const filePath = path.join(projectPath, dirs.library, safeFilename);

    requireAudioFile(fileRepo, filePath);

    return {
      stream: fileRepo.createReadStream(filePath),
      mimeType: getAudioMimeType(filename)
    };
  }

  function getThumbStream(projectUuid, filename) {
    // Use sanitizePath for tile paths (e.g., "0.01/tile_0.webp"), sanitizeFilename for simple files
    const safePath = filename.includes('/') ? sanitizePath(filename) : sanitizeFilename(filename);
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const filePath = path.join(projectPath, dirs.thumbs, safePath);

    requireThumbFile(fileRepo, filePath);

    // Determine MIME type based on file extension
    const mimeType = filename.endsWith('.json') ? 'application/json' : 'image/webp';

    return {
      stream: fileRepo.createReadStream(filePath),
      mimeType
    };
  }

  return {
    getVideoStream,
    getAudioStream,
    getLibraryAudioStream,
    getThumbStream
  };
}

module.exports = { streamServiceCreator };
