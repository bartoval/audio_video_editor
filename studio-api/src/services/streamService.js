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
const {
  projectRepositoryCreator,
  fileRepositoryCreator,
  mediaRepositoryCreator
} = require('../repositories');
const config = require('../config');

const logger = createLogger('StreamService');

// Destructure path constants
const { dirs, files } = config.paths;

function streamServiceCreator() {
  const projectRepo = projectRepositoryCreator();
  const fileRepo = fileRepositoryCreator(config.projectsPath);
  const mediaRepo = mediaRepositoryCreator();

  async function getVideoStream(projectUuid, range) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const filePath = path.join(projectPath, files.video);

    await requireVideoFile(fileRepo, filePath);

    const stats = await fileRepo.getStats(filePath);
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

  async function getVideoSmallStream(projectUuid) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const filePath = path.join(projectPath, files.videoSmall);

    await requireVideoFile(fileRepo, filePath);

    const stats = await fileRepo.getStats(filePath);

    return {
      stream: fileRepo.createReadStream(filePath),
      fileSize: stats.size,
      mimeType: 'video/mp4'
    };
  }

  async function getLibraryAudioStream(projectUuid, filename, range) {
    const safeFilename = sanitizeFilename(filename);
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const filePath = path.join(projectPath, dirs.library, safeFilename);

    await requireAudioFile(fileRepo, filePath);

    const stats = await fileRepo.getStats(filePath);
    const fileSize = stats.size;
    const mimeType = getAudioMimeType(filename);

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
        mimeType
      };
    }

    return {
      stream: fileRepo.createReadStream(filePath),
      fileSize,
      mimeType
    };
  }

  async function getLibraryAudioWithFormat(projectUuid, filename, format = 'mp3') {
    const safeFilename = sanitizeFilename(filename);
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const sourcePath = path.join(projectPath, dirs.library, safeFilename);

    await requireAudioFile(fileRepo, sourcePath);

    const sourceExt = path.extname(safeFilename).toLowerCase().slice(1);

    if (sourceExt === format) {
      return {
        stream: fileRepo.createReadStream(sourcePath),
        mimeType: getAudioMimeType(safeFilename)
      };
    }

    const cacheDir = path.join(projectPath, dirs.library, 'cache');
    await fileRepo.ensureDir(cacheDir);

    const baseName = path.basename(safeFilename, path.extname(safeFilename));
    const cachedFile = path.join(cacheDir, `${baseName}.${format}`);

    if (!(await fileRepo.exists(cachedFile))) {
      logger.info('Converting audio format', { source: safeFilename, format });
      await mediaRepo.convertAudioFormat(sourcePath, cachedFile, format);
    }

    const mimeType = format === 'wav' ? 'audio/wav' : 'audio/mpeg';

    return {
      stream: fileRepo.createReadStream(cachedFile),
      mimeType,
      filename: `${baseName}.${format}`
    };
  }

  async function getDerivedAudioStream(projectUuid, filename) {
    const safeFilename = sanitizeFilename(filename);
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const filePath = path.join(
      projectPath,
      dirs.derived || path.join(dirs.library, 'derived'),
      safeFilename
    );

    await requireAudioFile(fileRepo, filePath);

    return {
      stream: fileRepo.createReadStream(filePath),
      mimeType: getAudioMimeType(filename)
    };
  }

  async function getThumbStream(projectUuid, filename) {
    // Use sanitizePath for tile paths (e.g., "0.01/tile_0.webp"), sanitizeFilename for simple files
    const safePath = filename.includes('/') ? sanitizePath(filename) : sanitizeFilename(filename);
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const filePath = path.join(projectPath, dirs.thumbs, safePath);

    await requireThumbFile(fileRepo, filePath);

    // Determine MIME type based on file extension
    const mimeType = filename.endsWith('.json') ? 'application/json' : 'image/webp';

    return {
      stream: fileRepo.createReadStream(filePath),
      mimeType
    };
  }

  return {
    getVideoStream,
    getVideoSmallStream,
    getLibraryAudioStream,
    getLibraryAudioWithFormat,
    getDerivedAudioStream,
    getThumbStream
  };
}

module.exports = { streamServiceCreator };
