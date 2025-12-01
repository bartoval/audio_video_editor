const path = require('path');
const { v4: uuidv4 } = require('uuid');
const {
  createLogger,
  formatDuration,
  NotFoundError,
  ValidationError,
  createTrackListManager,
  requireVideoFile,
  requireAudioFile,
  generateUniqueFilename,
  parseFilename
} = require('../utils');
const {
  projectRepositoryCreator,
  mediaRepositoryCreator,
  chunkRepositoryCreator,
  fileRepositoryCreator
} = require('../repositories');
const config = require('../config');

const logger = createLogger('UploadService');

// Track processed uploads to prevent duplicates (using Map for atomic check-and-set)
const processingUploads = new Map();

// Destructure path constants
const { dirs, files } = config.paths;

function uploadServiceCreator() {
  const projectRepo = projectRepositoryCreator();
  const mediaRepo = mediaRepositoryCreator();
  const chunkRepo = chunkRepositoryCreator();
  const fileRepo = fileRepositoryCreator(config.projectsPath);

  async function handleVideoChunk(file, flowParams) {
    const { flowChunkNumber, flowChunkSize, flowTotalSize, flowIdentifier, flowFilename } =
      flowParams;

    const numberOfChunks = Math.ceil(flowTotalSize / flowChunkSize);

    // Validate chunk
    if (!file || !file.size) {
      throw new ValidationError('Invalid file chunk');
    }

    // Save chunk
    await chunkRepo.saveChunk(file, flowChunkNumber, flowIdentifier);

    // Check if all chunks received
    if (chunkRepo.allChunksExist(numberOfChunks, flowIdentifier)) {
      return { status: 'done', filename: flowFilename, identifier: flowIdentifier, numberOfChunks };
    }

    return { status: 'partly_done', chunk: flowChunkNumber, total: numberOfChunks };
  }

  async function assembleVideo(projectUuid, identifier, numberOfChunks) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const outputFile = path.join(projectPath, files.original);

    // Ensure directories exist
    fileRepo.ensureDir(projectPath);
    fileRepo.ensureDir(path.join(projectPath, dirs.videoTracks));
    fileRepo.ensureDir(path.join(projectPath, dirs.audioTracks));
    fileRepo.ensureDir(path.join(projectPath, dirs.thumbs));

    // Write initial metadata
    fileRepo.writeJson(path.join(projectPath, files.info), {
      metadata: { status: 'pending' }
    });

    // Assemble chunks
    const writeStream = fileRepo.createWriteStream(outputFile);
    await chunkRepo.assembleChunks(identifier, numberOfChunks, writeStream);

    // Cleanup chunks
    chunkRepo.cleanChunks(identifier);

    logger.info('Video assembled', { projectUuid, file: outputFile });

    return { file: outputFile };
  }

  async function convertVideo(projectUuid) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const inputFile = path.join(projectPath, files.original);

    requireVideoFile(fileRepo, inputFile);

    // Probe media
    const meta = await mediaRepo.probeMedia(inputFile);
    const hasAudio = meta.streams.some(s => s.codec_type === 'audio');
    const videoStream = meta.streams.find(s => s.codec_type === 'video');
    const videoWidth = videoStream?.width || 1920;
    const videoHeight = videoStream?.height || 1080;

    // Build metadata
    const metadata = {
      status: 'pending',
      id: meta.filename,
      name: meta.metadata?.title || meta.filename,
      duration: meta.format.duration * 1000,
      durationFormatted: formatDuration(meta.format.duration),
      displayAspectRatio: videoStream?.display_aspect_ratio,
      width: videoWidth,
      height: videoHeight
    };

    // Save initial metadata
    fileRepo.writeJson(path.join(projectPath, files.info), { metadata });

    // Generate thumbnails (async)
    const thumbsDir = path.join(projectPath, dirs.thumbs);
    fileRepo.deleteDir(thumbsDir);
    mediaRepo.generateThumbs(inputFile, thumbsDir, meta.format.duration, videoWidth, videoHeight);

    // Convert video (async)
    const resourcesDir = path.join(projectPath, dirs.resources);
    mediaRepo
      .convertVideo(inputFile, resourcesDir, hasAudio)
      .then(() => {
        metadata.status = 'ready';
        fileRepo.writeJson(path.join(projectPath, files.info), { metadata });
        logger.info('Video conversion complete', { projectUuid });
      })
      .catch(err => {
        metadata.status = 'error';
        fileRepo.writeJson(path.join(projectPath, files.info), { metadata });
        logger.error('Video conversion failed', { projectUuid, error: err.message });
      });

    return { status: 'started' };
  }

  async function getConversionStatus(projectUuid) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const infoPath = path.join(projectPath, files.info);

    const data = fileRepo.readJson(infoPath);

    if (!data) {
      return { status: false, metadata: {} };
    }

    return {
      status: data.metadata?.status || false,
      metadata: data.metadata
    };
  }

  async function handleAudioChunk(file, flowParams, projectUuid) {
    const { flowChunkNumber, flowChunkSize, flowTotalSize, flowIdentifier, flowFilename } =
      flowParams;

    const numberOfChunks = Math.ceil(flowTotalSize / flowChunkSize);

    // Validate and save chunk
    if (!file || !file.size) {
      throw new ValidationError('Invalid file chunk');
    }

    await chunkRepo.saveChunk(file, flowChunkNumber, flowIdentifier);

    // Check if all chunks received
    if (!chunkRepo.allChunksExist(numberOfChunks, flowIdentifier)) {
      return { status: 'partly_done', chunk: flowChunkNumber, total: numberOfChunks };
    }

    // Atomic check-and-set to prevent race condition
    if (processingUploads.has(flowIdentifier)) {
      return { status: 'already_processing' };
    }

    processingUploads.set(flowIdentifier, Date.now());

    // Cleanup after 60 seconds
    setTimeout(() => processingUploads.delete(flowIdentifier), 60000);

    // Assemble audio file
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const libraryDir = path.join(projectPath, dirs.library);
    fileRepo.ensureDir(libraryDir);

    // Generate unique filename
    const { ext, baseName, extLower } = parseFilename(flowFilename);
    const newFilename = generateUniqueFilename(flowFilename);
    const outputFile = path.join(libraryDir, newFilename);

    try {
      // Assemble chunks
      const writeStream = fileRepo.createWriteStream(outputFile);
      await chunkRepo.assembleChunks(flowIdentifier, numberOfChunks, writeStream);

      // Extract metadata
      let audioMeta = {
        id: newFilename,
        name: baseName,
        duration: 0,
        durationFormatted: '00:00.00',
        channelLayout: 'stereo',
        sampleRate: 0,
        bitrate: 0,
        codec: '',
        format: extLower,
        fileSize: fileRepo.getStats(outputFile)?.size || 0
      };

      try {
        const meta = await mediaRepo.probeMedia(outputFile);

        if (meta && meta.format) {
          audioMeta.duration = meta.format.duration * 1000;
          audioMeta.durationFormatted = formatDuration(meta.format.duration);
          audioMeta.bitrate = Math.round((meta.format.bit_rate || 0) / 1000);

          if (meta.streams && meta.streams[0]) {
            audioMeta.channelLayout = meta.streams[0].channel_layout || 'stereo';
            audioMeta.sampleRate = meta.streams[0].sample_rate || 0;
            audioMeta.codec = meta.streams[0].codec_name || '';
          }
        }
      } catch (err) {
        logger.warn('Failed to probe audio', { error: err.message });
      }

      // Update track list
      const trackListManager = createTrackListManager(projectPath, files, fileRepo);
      trackListManager.addTrack(newFilename, audioMeta);

      logger.info('Audio uploaded', { projectUuid, filename: newFilename });

      return { status: 'complete', file: newFilename, metadata: audioMeta };
    } catch (err) {
      logger.error('Audio assembly failed', { error: err.message, flowIdentifier });

      throw err;
    } finally {
      // Always cleanup chunks (success or failure)
      chunkRepo.cleanChunks(flowIdentifier);
    }
  }

  async function deleteAudio(projectUuid, filename) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const filePath = path.join(projectPath, dirs.library, filename);

    requireAudioFile(fileRepo, filePath);

    fileRepo.deleteFile(filePath);

    // Update track list
    const trackListManager = createTrackListManager(projectPath, files, fileRepo);
    trackListManager.removeTrack(filename);

    logger.info('Audio deleted', { projectUuid, filename });

    return { status: 'deleted', file: filename };
  }

  return {
    handleVideoChunk,
    assembleVideo,
    convertVideo,
    getConversionStatus,
    handleAudioChunk,
    deleteAudio
  };
}

module.exports = { uploadServiceCreator };
