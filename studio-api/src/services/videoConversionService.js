const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const config = require('../config');
const { createLogger } = require('../utils/logger');
const { formatDuration } = require('../utils/time');
const {
  getEncoderConfig,
  runFfmpeg,
  calculateAspectRatio,
  isWebCompatibleCodec,
  hasFaststart
} = require('../utils/ffmpeg');

const logger = createLogger('VideoConversionService');

// Destructure path constants
const { dirs, files } = config.paths;

// ============================================================================
// Service Factory
// ============================================================================

function videoConversionServiceCreator(deps = {}) {
  const mediaRepo = deps.mediaRepo || require('../repositories').mediaRepositoryCreator();
  const eventService = deps.eventService || require('./eventService').eventServiceCreator();

  // ==========================================================================
  // Video Conversion
  // ==========================================================================

  /**
   * Convert video for web playback
   * - Removes audio track
   * - Ensures web-compatible codec
   * - Adds faststart for streaming
   * @param {string} uuid - Workspace UUID
   * @param {string} priorityScale - Scale to generate first
   * @returns {Promise<{metadata: object}>}
   */
  async function convertVideo(uuid, priorityScale = '0.02') {
    const projectPath = path.join(config.projectsPath, uuid);
    const inputFile = path.join(projectPath, files.original);
    const infoPath = path.join(projectPath, files.info);
    const videoOutput = path.join(projectPath, files.video);
    const videoSmallOutput = path.join(projectPath, files.videoSmall);
    const videoSmallDir = path.dirname(videoSmallOutput);

    logger.info('Starting video conversion', { uuid, priorityScale });

    // Probe media file
    const meta = await mediaRepo.probeMedia(inputFile);
    const videoStream = meta.streams.find(s => s.codec_type === 'video');

    // Calculate aspect ratio
    let displayAspectRatio = videoStream?.display_aspect_ratio;

    if (!displayAspectRatio || displayAspectRatio === 'N/A') {
      displayAspectRatio = calculateAspectRatio(videoStream?.width, videoStream?.height);
    }

    // Build metadata
    const metadata = {
      status: 'pending',
      id: path.basename(inputFile),
      name: meta.metadata?.title || path.basename(inputFile),
      duration: meta.format.duration * 1000,
      durationFormatted: formatDuration(meta.format.duration),
      displayAspectRatio,
      isMuteVideo: true
    };

    // Save initial metadata
    await writeMetadata(infoPath, { metadata });

    // Prepare thumbnails directory
    const thumbsDir = path.join(projectPath, dirs.thumbs);
    const videoWidth = videoStream?.width || 1920;
    const videoHeight = videoStream?.height || 1080;

    await fs.promises.rm(thumbsDir, { recursive: true, force: true }).catch(() => {});
    await fs.promises.mkdir(thumbsDir, { recursive: true });

    // Analyze video
    const codecName = videoStream?.codec_name;
    const hasAudio = meta.streams.some(s => s.codec_type === 'audio');
    const isWebCodec = isWebCompatibleCodec(codecName);
    const isFaststart = isWebCodec && !hasAudio ? await hasFaststart(inputFile) : false;

    logger.info('Video analysis', {
      uuid,
      codec: codecName,
      isWebCodec,
      hasAudio,
      isFaststart
    });

    // Process video
    await processVideo(inputFile, videoOutput, { isFaststart, isWebCodec, uuid });

    // Mark video as ready
    metadata.status = 'ready';
    metadata.thumbnailsStatus = 'processing';
    await writeMetadata(infoPath, { metadata });

    // Write placeholder manifest to avoid 404 errors
    const manifestPath = path.join(thumbsDir, 'manifest.json');
    const placeholder = {
      status: 'processing',
      mode: 'tiles',
      scalesReady: [],
      thumbWidth: null,
      thumbHeight: null,
      scales: {}
    };
    await fs.promises.writeFile(manifestPath, JSON.stringify(placeholder));

    logger.info('Video ready, thumbnails generating in background', { uuid });

    // Generate thumbnails in background
    generateThumbnailsAsync(
      uuid,
      inputFile,
      thumbsDir,
      meta.format.duration,
      videoWidth,
      videoHeight,
      priorityScale,
      infoPath
    );

    // Generate small video for offline use (in background, non-blocking)
    await fs.promises.mkdir(videoSmallDir, { recursive: true });
    generateSmallVideo(inputFile, videoSmallOutput, uuid)
      .then(() => logger.info('Small video ready for offline', { uuid }))
      .catch(err => logger.error('Small video generation failed', { uuid, error: err.message }));

    return { metadata };
  }

  // ==========================================================================
  // Thumbnail Generation
  // ==========================================================================

  /**
   * Regenerate thumbnails for existing video
   * @param {string} uuid - Workspace UUID
   * @param {string} priorityScale - Scale to generate first
   * @returns {Promise<void>}
   */
  async function regenerateThumbnails(uuid, priorityScale = '0.02') {
    const projectPath = path.join(config.projectsPath, uuid);
    const infoPath = path.join(projectPath, files.info);
    const thumbsDir = path.join(projectPath, dirs.thumbs);
    const videoFile = path.join(projectPath, files.video);

    // Check if video exists
    try {
      await fs.promises.access(videoFile);
    } catch {
      throw new Error('Video not found');
    }

    // Read video info
    const raw = await fs.promises.readFile(infoPath, 'utf-8');
    const data = JSON.parse(raw);
    const { duration } = data.metadata;

    // Get video dimensions
    const meta = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoFile, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata);
        }
      });
    });

    const videoStream = meta.streams.find(s => s.codec_type === 'video');
    const videoWidth = videoStream?.width || 1920;
    const videoHeight = videoStream?.height || 1080;

    // Clear existing thumbs
    await fs.promises.rm(thumbsDir, { recursive: true, force: true }).catch(() => {});
    await fs.promises.mkdir(thumbsDir, { recursive: true });

    // Update status
    data.metadata.thumbnailsStatus = 'processing';
    await writeMetadata(infoPath, data);

    // Write placeholder manifest to avoid 404 errors
    const manifestPath = path.join(thumbsDir, 'manifest.json');
    const placeholder = {
      status: 'processing',
      mode: 'tiles',
      scalesReady: [],
      thumbWidth: null,
      thumbHeight: null,
      scales: {}
    };
    await fs.promises.writeFile(manifestPath, JSON.stringify(placeholder));

    // Generate thumbnails in background
    generateThumbnailsAsync(
      uuid,
      videoFile,
      thumbsDir,
      duration / 1000,
      videoWidth,
      videoHeight,
      priorityScale,
      infoPath
    );
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Generate small video for offline use
   */
  async function generateSmallVideo(inputFile, outputFile, uuid) {
    const { smallVideoHeight } = config.ffmpeg;
    const encoder = getEncoderConfig();

    logger.info('Generating small video', { uuid, height: smallVideoHeight });
    await runFfmpeg(
      ffmpeg(inputFile)
        .output(outputFile)
        .videoCodec(encoder.codec)
        .outputOptions(encoder.options)
        .size(`?x${smallVideoHeight}`)
        .noAudio()
    );
    logger.info('Small video generated', { uuid });
  }

  /**
   * Process video based on codec compatibility
   */
  async function processVideo(inputFile, outputFile, { isFaststart, isWebCodec, uuid }) {
    if (isFaststart) {
      // Video is already perfect - just copy
      await fs.promises.copyFile(inputFile, outputFile);
      logger.info('Video copied directly (already optimized)', { uuid });

      return;
    }

    if (isWebCodec) {
      // Web codec but needs faststart or audio removal
      await runFfmpeg(
        ffmpeg(inputFile)
          .output(outputFile)
          .videoCodec('copy')
          .outputOptions(['-movflags', '+faststart'])
          .noAudio()
      );
      logger.info('Video stream copied (no re-encode)', { uuid });

      return;
    }

    // Incompatible codec - full re-encode
    const encoder = getEncoderConfig();

    logger.info('Re-encoding video', { uuid, encoder: encoder.codec });
    await runFfmpeg(
      ffmpeg(inputFile)
        .output(outputFile)
        .videoCodec(encoder.codec)
        .outputOptions(encoder.options)
        .noAudio()
    );
    logger.info('Video re-encoded', { uuid, encoder: encoder.codec });
  }

  /**
   * Generate thumbnails asynchronously with event emission
   */
  function generateThumbnailsAsync(
    uuid,
    inputFile,
    thumbsDir,
    duration,
    width,
    height,
    priorityScale,
    infoPath
  ) {
    const callbacks = {
      onProgress: ({ percent, scale, isChunkReady }) => {
        eventService.emitThumbnailStatus(uuid, 'generating', { percent, scale, isChunkReady });
      },
      onScaleComplete: scale => {
        eventService.emitThumbnailStatus(uuid, 'scale_complete', { scale });
      },
      priorityScale
    };

    const updateStatus = async (status, eventStatus, error = null) => {
      try {
        await fs.promises.access(infoPath);
      } catch {
        logger.warn('Workspace deleted during thumbnail generation', { uuid });

        return false;
      }

      const raw = await fs.promises.readFile(infoPath, 'utf-8');
      const data = JSON.parse(raw);

      data.metadata.thumbnailsStatus = status;
      await writeMetadata(infoPath, data);
      eventService.emitThumbnailStatus(uuid, eventStatus, null, error ? { error } : {});

      return true;
    };

    mediaRepo
      .generateThumbs(inputFile, thumbsDir, duration, width, height, callbacks)
      .then(async () => {
        logger.info('Thumbnails complete', { uuid });

        if (!(await updateStatus('ready', 'complete'))) {
          return;
        }

        try {
          await fs.promises.access(inputFile);

          if (inputFile.includes(files.original)) {
            await fs.promises.unlink(inputFile);
          }
        } catch {
          // File already removed
        }
      })
      .catch(async err => {
        logger.error('Thumbnail generation failed', { uuid, error: err.message });
        await updateStatus('error', 'error', err.message);
      });
  }

  /**
   * Write metadata to file (atomic-ish)
   */
  async function writeMetadata(filePath, data) {
    await fs.promises.writeFile(filePath, JSON.stringify(data));
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  return {
    convertVideo,
    regenerateThumbnails
  };
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  videoConversionServiceCreator
};
