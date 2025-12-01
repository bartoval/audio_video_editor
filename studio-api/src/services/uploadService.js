const path = require('path');
const https = require('https');
const http = require('http');
const {
  createLogger,
  formatDuration,
  ValidationError,
  createTrackListManager,
  requireVideoFile,
  requireAudioFile,
  generateUniqueFilename,
  parseFilename,
  computeFileHash
} = require('../utils');
const {
  projectRepositoryCreator,
  mediaRepositoryCreator,
  chunkRepositoryCreator,
  fileRepositoryCreator
} = require('../repositories');
const { aiMusicServiceCreator } = require('./aiMusicService');
const config = require('../config');

const logger = createLogger('UploadService');
const aiMusicService = aiMusicServiceCreator();

// Track processed uploads to prevent duplicates (using Map for atomic check-and-set)
const processingUploads = new Map();

// Destructure path constants
const { dirs, files } = config.paths;

const SAFE_FLOW_PARAM = /^[a-zA-Z0-9._-]+$/;

function sanitizeFlowParam(value, paramName) {
  const str = String(value);
  if (!SAFE_FLOW_PARAM.test(str)) {
    throw new ValidationError(`Invalid ${paramName}: contains disallowed characters`);
  }

  return str;
}

function sanitizeFilename(value) {
  const str = String(value);
  const ext = path.extname(str);
  const name = path.basename(str, ext).replace(/[^a-zA-Z0-9._-]/g, '_');

  return name + ext;
}

function uploadServiceCreator(deps = {}) {
  const projectRepo = deps.projectRepo || projectRepositoryCreator();
  const mediaRepo = deps.mediaRepo || mediaRepositoryCreator();
  const chunkRepo = deps.chunkRepo || chunkRepositoryCreator();
  const fileRepo = deps.fileRepo || fileRepositoryCreator(config.projectsPath);

  async function handleVideoChunk(file, flowParams) {
    const { flowChunkNumber, flowChunkSize, flowTotalSize, flowIdentifier, flowFilename } =
      flowParams;

    // Validate flow parameters
    if (!flowChunkNumber || !flowChunkSize || !flowTotalSize || !flowIdentifier || !flowFilename) {
      throw new ValidationError(
        'Missing required flow parameters (flowChunkNumber, flowChunkSize, flowTotalSize, flowIdentifier, flowFilename)'
      );
    }

    sanitizeFlowParam(flowIdentifier, 'flowIdentifier');
    const safeFilename = sanitizeFilename(flowFilename);

    const numberOfChunks = Math.ceil(flowTotalSize / flowChunkSize);

    // Validate chunk
    if (!file || !file.size) {
      throw new ValidationError('Invalid file chunk');
    }

    // Save chunk
    await chunkRepo.saveChunk(file, flowChunkNumber, flowIdentifier);

    // Check if all chunks received
    if (await chunkRepo.allChunksExist(numberOfChunks, flowIdentifier)) {
      return { status: 'done', filename: safeFilename, identifier: flowIdentifier, numberOfChunks };
    }

    return { status: 'partly_done', chunk: flowChunkNumber, total: numberOfChunks };
  }

  async function assembleVideo(projectUuid, identifier, numberOfChunks) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const outputFile = path.join(projectPath, files.original);

    // Ensure directories exist
    await fileRepo.ensureDir(projectPath);
    await fileRepo.ensureDir(path.join(projectPath, dirs.videoTracks));
    await fileRepo.ensureDir(path.join(projectPath, dirs.audioTracks));
    await fileRepo.ensureDir(path.join(projectPath, dirs.thumbs));

    // Write initial metadata
    await fileRepo.writeJson(path.join(projectPath, files.info), {
      metadata: { status: 'pending' }
    });

    // Assemble chunks
    const writeStream = fileRepo.createWriteStream(outputFile);
    await chunkRepo.assembleChunks(identifier, numberOfChunks, writeStream);

    // Cleanup chunks
    await chunkRepo.cleanChunks(identifier);

    logger.info('Video assembled', { projectUuid, file: outputFile });

    return { file: outputFile };
  }

  async function convertVideo(projectUuid) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const inputFile = path.join(projectPath, files.original);

    await requireVideoFile(fileRepo, inputFile);

    // Probe media
    const meta = await mediaRepo.probeMedia(inputFile);
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
    await fileRepo.writeJson(path.join(projectPath, files.info), { metadata });

    // Generate thumbnails (async)
    const thumbsDir = path.join(projectPath, dirs.thumbs);
    await fileRepo.deleteDir(thumbsDir);
    mediaRepo.generateThumbs(inputFile, thumbsDir, meta.format.duration, videoWidth, videoHeight);

    // Convert video (async) - audio extraction disabled, we only need muted videos
    const resourcesDir = path.join(projectPath, dirs.resources);
    mediaRepo
      .convertVideo(inputFile, resourcesDir)
      .then(async () => {
        metadata.status = 'ready';
        await fileRepo.writeJson(path.join(projectPath, files.info), { metadata });
        logger.info('Video conversion complete', { projectUuid });
      })
      .catch(async err => {
        metadata.status = 'error';
        await fileRepo.writeJson(path.join(projectPath, files.info), { metadata });
        logger.error('Video conversion failed', { projectUuid, error: err.message });
      });

    return { status: 'started' };
  }

  async function getConversionStatus(projectUuid) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const infoPath = path.join(projectPath, files.info);

    const data = await fileRepo.readJson(infoPath);

    if (!data) {
      return {
        conversionComplete: false,
        thumbnailsComplete: false,
        thumbnailsStatus: 'pending',
        metadata: {}
      };
    }

    return {
      conversionComplete: data.metadata?.status === 'ready',
      thumbnailsComplete: data.metadata?.thumbnailsStatus === 'ready',
      thumbnailsStatus: data.metadata?.thumbnailsStatus || 'pending',
      metadata: data.metadata
    };
  }

  async function handleAudioChunk(file, flowParams, projectUuid) {
    const {
      flowChunkNumber,
      flowChunkSize,
      flowTotalSize,
      flowIdentifier,
      flowFilename,
      provider = null,
      source = null
    } = flowParams;

    // Validate flow parameters
    if (!flowChunkNumber || !flowChunkSize || !flowTotalSize || !flowIdentifier || !flowFilename) {
      throw new ValidationError(
        'Missing required flow parameters (flowChunkNumber, flowChunkSize, flowTotalSize, flowIdentifier, flowFilename)'
      );
    }

    sanitizeFlowParam(flowIdentifier, 'flowIdentifier');
    const safeFilename = sanitizeFilename(flowFilename);

    const numberOfChunks = Math.ceil(flowTotalSize / flowChunkSize);

    // Validate and save chunk
    if (!file || !file.size) {
      throw new ValidationError('Invalid file chunk');
    }

    await chunkRepo.saveChunk(file, flowChunkNumber, flowIdentifier);

    // Check if all chunks received
    if (!(await chunkRepo.allChunksExist(numberOfChunks, flowIdentifier))) {
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
    await fileRepo.ensureDir(libraryDir);

    // Generate unique filename
    const { baseName, extLower } = parseFilename(safeFilename);
    const newFilename = generateUniqueFilename(safeFilename);
    const outputFile = path.join(libraryDir, newFilename);

    try {
      // Assemble chunks
      const writeStream = fileRepo.createWriteStream(outputFile);
      await chunkRepo.assembleChunks(flowIdentifier, numberOfChunks, writeStream);

      // Extract metadata
      const audioMeta = {
        id: newFilename,
        name: baseName,
        duration: 0,
        durationFormatted: '00:00.00',
        channelLayout: 'stereo',
        bitDepth: 0,
        sampleRate: 0,
        bitrate: 0,
        codec: '',
        format: extLower,
        fileSize: (await fileRepo.getStats(outputFile))?.size || 0,
        createdAt: new Date().toISOString(),
        provider: provider || undefined,
        source: source || undefined
      };

      try {
        const meta = await mediaRepo.probeMedia(outputFile);

        if (meta && meta.format) {
          audioMeta.duration = meta.format.duration * 1000;
          audioMeta.durationFormatted = formatDuration(meta.format.duration);
          audioMeta.bitrate = Math.round((meta.format.bit_rate || 0) / 1000);

          if (meta.streams && meta.streams[0]) {
            const stream = meta.streams[0];
            const layout = stream.channel_layout;
            const channels = stream.channels;

            // Some WAV/PCM streams report "unknown" or empty layout: derive from channels
            audioMeta.channelLayout =
              layout && layout !== 'unknown'
                ? layout
                : channels === 1
                  ? 'mono'
                  : channels === 2
                    ? 'stereo'
                    : channels
                      ? `${channels}ch`
                      : 'stereo';

            audioMeta.sampleRate = stream.sample_rate || 0;
            audioMeta.bitDepth = stream.bits_per_sample || 0;
            audioMeta.codec = stream.codec_name || '';
          }
        }
      } catch (err) {
        logger.warn('Failed to probe audio', { error: err.message });
      }

      // Compute file hash for dedupe
      let fileHash = '';
      try {
        fileHash = await computeFileHash(outputFile);
      } catch (err) {
        logger.warn('Failed to hash audio', { error: err.message });
      }
      audioMeta.hash = fileHash;

      // Track list manager (dedupe + save)
      const trackListManager = createTrackListManager(projectPath, files, fileRepo);

      // Check for duplicates by hash
      const existingTracks = await trackListManager.getTracks();
      const duplicateEntry = Object.entries(existingTracks).find(
        ([, meta]) => meta.hash && fileHash && meta.hash === fileHash
      );

      if (duplicateEntry) {
        const [existingId, existingMeta] = duplicateEntry;
        // Remove the newly assembled duplicate file
        await fileRepo.deleteFile(outputFile).catch(() => {});
        await chunkRepo.cleanChunks(flowIdentifier);
        logger.info('Duplicate audio detected, skipping save', {
          projectUuid,
          filename: newFilename,
          duplicateOf: existingId
        });

        return { status: 'duplicate', file: existingId, metadata: existingMeta };
      }

      // Update track list
      await trackListManager.addTrack(newFilename, audioMeta);

      logger.info('Audio uploaded', { projectUuid, filename: newFilename });

      return { status: 'complete', file: newFilename, metadata: audioMeta };
    } catch (err) {
      logger.error('Audio assembly failed', { error: err.message, flowIdentifier });

      throw err;
    } finally {
      // Always cleanup chunks (success or failure)
      await chunkRepo.cleanChunks(flowIdentifier);
    }
  }

  async function deleteAudio(projectUuid, filename) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const filePath = path.join(projectPath, dirs.library, filename);

    await requireAudioFile(fileRepo, filePath);

    const trackListManager = createTrackListManager(projectPath, files, fileRepo);
    const metadata = await trackListManager.getTrack(filename);

    if (metadata?.provider === 'mureka' && metadata?.providerId) {
      await aiMusicService.deleteSong(metadata.providerId);
    }

    await fileRepo.deleteFile(filePath);

    // Update track list
    await trackListManager.removeTrack(filename);

    logger.info('Audio deleted', { projectUuid, filename });

    return { status: 'deleted', file: filename };
  }

  function downloadToFile(url, outputPath) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;

      client
        .get(url, response => {
          if (
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            return downloadToFile(response.headers.location, outputPath).then(resolve, reject);
          }

          if (response.statusCode !== 200) {
            return reject(new Error(`Download failed: HTTP ${response.statusCode}`));
          }

          const writeStream = fileRepo.createWriteStream(outputPath);
          response.pipe(writeStream);

          writeStream.on('finish', () => resolve());
          writeStream.on('error', reject);
          response.on('error', reject);
        })
        .on('error', reject);
    });
  }

  async function saveAudioFromUrl(url, filename, projectUuid, extraMeta = {}) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const libraryDir = path.join(projectPath, dirs.library);
    await fileRepo.ensureDir(libraryDir);

    const { baseName, extLower } = parseFilename(filename);
    const newFilename = generateUniqueFilename(filename);
    const outputFile = path.join(libraryDir, newFilename);

    await downloadToFile(url, outputFile);

    const audioMeta = {
      id: newFilename,
      name: baseName,
      duration: 0,
      durationFormatted: '00:00.00',
      channelLayout: 'stereo',
      bitDepth: 0,
      sampleRate: 0,
      bitrate: 0,
      codec: '',
      format: extLower,
      fileSize: (await fileRepo.getStats(outputFile))?.size || 0,
      createdAt: new Date().toISOString(),
      ...extraMeta
    };

    try {
      const meta = await mediaRepo.probeMedia(outputFile);

      if (meta && meta.format) {
        audioMeta.duration = meta.format.duration * 1000;
        audioMeta.durationFormatted = formatDuration(meta.format.duration);
        audioMeta.bitrate = Math.round((meta.format.bit_rate || 0) / 1000);

        if (meta.streams && meta.streams[0]) {
          const stream = meta.streams[0];
          const layout = stream.channel_layout;
          const channels = stream.channels;

          audioMeta.channelLayout =
            layout && layout !== 'unknown'
              ? layout
              : channels === 1
                ? 'mono'
                : channels === 2
                  ? 'stereo'
                  : channels
                    ? `${channels}ch`
                    : 'stereo';

          audioMeta.sampleRate = stream.sample_rate || 0;
          audioMeta.bitDepth = stream.bits_per_sample || 0;
          audioMeta.codec = stream.codec_name || '';
        }
      }
    } catch (err) {
      logger.warn('Failed to probe audio from URL', { error: err.message });
    }

    let fileHash = '';
    try {
      fileHash = await computeFileHash(outputFile);
    } catch (err) {
      logger.warn('Failed to hash audio from URL', { error: err.message });
    }
    audioMeta.hash = fileHash;

    const trackListManager = createTrackListManager(projectPath, files, fileRepo);
    const existingTracks = await trackListManager.getTracks();
    const duplicateEntry = Object.entries(existingTracks).find(
      ([, trackMeta]) => trackMeta.hash && fileHash && trackMeta.hash === fileHash
    );

    if (duplicateEntry) {
      const [existingId, existingMeta] = duplicateEntry;
      await fileRepo.deleteFile(outputFile).catch(() => {});
      logger.info('Duplicate audio from URL, skipping', { projectUuid, duplicateOf: existingId });

      return { status: 'duplicate', file: existingId, metadata: existingMeta };
    }

    await trackListManager.addTrack(newFilename, audioMeta);
    logger.info('Audio saved from URL', { projectUuid, filename: newFilename });

    return { status: 'complete', file: newFilename, metadata: audioMeta };
  }

  return {
    handleVideoChunk,
    assembleVideo,
    convertVideo,
    getConversionStatus,
    handleAudioChunk,
    saveAudioFromUrl,
    deleteAudio
  };
}

module.exports = { uploadServiceCreator };
