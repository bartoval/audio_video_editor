const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { uploadServiceCreator, streamServiceCreator } = require('../services');
const { mediaRepositoryCreator } = require('../repositories');
const { createLogger } = require('../utils/logger');
const { formatDuration } = require('../utils/time');
const config = require('../config');

const logger = createLogger('UploadHandler');
const uploadService = uploadServiceCreator();
const streamService = streamServiceCreator();
const mediaRepo = mediaRepositoryCreator();

// Destructure path constants
const { dirs, files } = config.paths;

// ============================================================================
// Helper Functions
// ============================================================================

function runFfmpeg(command) {
  return new Promise((resolve, reject) => {
    command
      .on('start', cmd => logger.debug('FFmpeg started', { command: cmd.substring(0, 100) }))
      .on('progress', progress => logger.debug('FFmpeg progress', { percent: progress.percent }))
      .on('error', err => reject(err))
      .on('end', () => resolve())
      .run();
  });
}

function calculateAspectRatio(width, height) {
  if (!width || !height) {
    return null;
  }

  const ratio = width / height;

  if (Math.abs(ratio - 16 / 9) < 0.1) {
    return '16:9';
  }

  if (Math.abs(ratio - 4 / 3) < 0.1) {
    return '4:3';
  }

  if (Math.abs(ratio - 21 / 9) < 0.1) {
    return '21:9';
  }

  return `${width}:${height}`;
}

/**
 * Check if video codec is web-compatible (can be played in browsers)
 */
function isWebCompatibleCodec(codecName) {
  const webCodecs = ['h264', 'avc1', 'vp8', 'vp9', 'av1'];

  return webCodecs.some(c => codecName?.toLowerCase().includes(c));
}

/**
 * Check if MP4 has moov atom at the beginning (faststart ready)
 * Reads first 32 bytes to check for 'ftyp' followed by 'moov' within first 1MB
 */
async function hasFaststart(filePath) {
  return new Promise(resolve => {
    const stream = fs.createReadStream(filePath, { start: 0, end: 1024 * 1024 });
    let buffer = Buffer.alloc(0);

    stream.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);

      // Look for 'moov' atom in first 1MB
      const moovIndex = buffer.indexOf('moov');
      const mdatIndex = buffer.indexOf('mdat');

      if (moovIndex !== -1 && mdatIndex !== -1) {
        stream.destroy();
        // If moov comes before mdat, it's faststart ready
        resolve(moovIndex < mdatIndex);
      }
    });

    stream.on('end', () => {
      // If we didn't find both, assume not faststart
      resolve(false);
    });

    stream.on('error', () => resolve(false));
  });
}

// ============================================================================
// Video Upload Handlers
// ============================================================================

async function uploadVideo(req, res, next) {
  try {
    const { flowChunkNumber, flowChunkSize, flowTotalSize, flowIdentifier, flowFilename } =
      req.body;

    const flowParams = {
      flowChunkNumber: parseInt(flowChunkNumber, 10),
      flowChunkSize: parseInt(flowChunkSize, 10),
      flowTotalSize: parseInt(flowTotalSize, 10),
      flowIdentifier,
      flowFilename
    };

    const result = await uploadService.handleVideoChunk(req.file, flowParams);

    if (result.status === 'done') {
      const { project_uuid: projectUuid } = req.body;
      const assembled = await uploadService.assembleVideo(
        projectUuid,
        result.identifier,
        result.numberOfChunks
      );

      return res.json({ status: 'complete', file: assembled.file });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}

function uploadOptions(req, res) {
  res.status(200).send();
}

// ============================================================================
// Video Streaming Handlers
// ============================================================================

async function getVideo(req, res, next) {
  try {
    const { uuid } = req.params;
    const { range } = req.headers;

    const result = streamService.getVideoStream(uuid, range);

    if (result.error === 'range_not_satisfiable') {
      return res
        .status(416)
        .set({ 'Content-Range': `bytes */${result.fileSize}` })
        .send();
    }

    if (range) {
      res.status(206).set({
        'Content-Range': `bytes ${result.start}-${result.end}/${result.fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': result.chunkSize,
        'Content-Type': result.mimeType
      });
    } else {
      res.status(200).set({ 'Content-Type': result.mimeType });
    }

    result.stream.on('error', next).pipe(res);
  } catch (err) {
    next(err);
  }
}

async function downloadVideo(req, res, next) {
  try {
    const { uuid } = req.params;
    const result = streamService.getVideoStream(uuid);

    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `attachment; filename="${uuid}.mp4"`
    });

    result.stream.on('error', next).pipe(res);
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// Video Conversion
// ============================================================================

async function convertVideo(req, res) {
  const { uuid } = req.params;
  const dirProject = path.join(config.projectsPath, uuid);
  const inputFile = path.join(dirProject, files.original);
  const infoPath = path.join(dirProject, files.info);
  const videoOutput = path.join(dirProject, files.video);

  // Respond immediately - conversion runs in background
  res.status(200).send();

  try {
    logger.info('Starting video conversion', { uuid, inputFile });

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
    fs.writeFileSync(infoPath, JSON.stringify({ metadata }));

    // Prepare thumbnails directory
    const thumbsDir = path.join(dirProject, dirs.thumbs);
    const videoWidth = videoStream?.width || 1920;
    const videoHeight = videoStream?.height || 1080;

    if (fs.existsSync(thumbsDir)) {
      fs.rmSync(thumbsDir, { recursive: true, force: true });
    }

    fs.mkdirSync(thumbsDir, { recursive: true });

    // Check video properties
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

    // =========================================================================
    // Process video: remove audio, optimize for streaming
    // - Already optimized (web codec + no audio + faststart): simple file copy
    // - Web-compatible codec: stream copy + faststart (fast, lossless)
    // - Incompatible codec: re-encode to H.264
    // =========================================================================
    let videoTask;

    if (isFaststart) {
      // Video is already perfect - just copy the file
      videoTask = fs.promises.copyFile(inputFile, videoOutput)
        .then(() => logger.info('Video copied directly (already optimized)', { uuid }));
    } else if (isWebCodec) {
      // Web codec but needs faststart or audio removal
      videoTask = runFfmpeg(
        ffmpeg(inputFile)
          .output(videoOutput)
          .videoCodec('copy')
          .outputOptions(['-movflags', '+faststart'])
          .noAudio()
      ).then(() => logger.info('Video stream copied (no re-encode)', { uuid }));
    } else {
      // Incompatible codec - full re-encode
      videoTask = runFfmpeg(
        ffmpeg(inputFile)
          .output(videoOutput)
          .videoCodec('libx264')
          .outputOptions(['-preset fast', '-crf 18', '-movflags', '+faststart'])
          .noAudio()
      ).then(() => logger.info('Video re-encoded to H.264', { uuid }));
    }

    const tasks = [
      videoTask,
      // Task 2: Generate thumbnails
      mediaRepo.generateThumbs(inputFile, thumbsDir, meta.format.duration, videoWidth, videoHeight)
        .then(() => logger.info('Thumbnails complete', { uuid }))
    ];

    await Promise.all(tasks);

    // Delete original uploaded file
    fs.unlinkSync(inputFile);

    // Mark as ready
    metadata.status = 'ready';
    fs.writeFileSync(infoPath, JSON.stringify({ metadata }));
    logger.info('Video conversion complete', { uuid });
  } catch (err) {
    logger.error('Video conversion failed', { uuid, error: err.message });

    // Update status to error
    try {
      const data = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));

      data.metadata.status = 'error';
      fs.writeFileSync(infoPath, JSON.stringify(data));
    } catch {
      fs.writeFileSync(infoPath, JSON.stringify({ metadata: { status: 'error' } }));
    }
  }
}

async function isVideoConverted(req, res, next) {
  try {
    const { uuid } = req.params;
    const result = await uploadService.getConversionStatus(uuid);

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function conversionStream(req, res, next) {
  try {
    const { uuid } = req.params;

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });

    let closed = false;
    let timerId = null;

    const checkStatus = async () => {
      if (closed) {
        return;
      }

      try {
        const result = await uploadService.getConversionStatus(uuid);
        const { status } = result.metadata || {};

        if (status === 'ready' || status === 'error') {
          res.write(`data: ${JSON.stringify(result)}\n\n`);
          res.end();

          return;
        }

        timerId = setTimeout(checkStatus, 1000);
      } catch (err) {
        if (!closed) {
          res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          res.end();
        }
      }
    };

    checkStatus();

    req.on('close', () => {
      closed = true;

      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// Audio Handlers
// ============================================================================

async function getAudio(req, res, next) {
  try {
    const { uuid } = req.params;
    const result = streamService.getAudioStream(uuid);

    res.set('Content-Type', result.mimeType);
    result.stream.on('error', next).pipe(res);
  } catch (err) {
    next(err);
  }
}

async function uploadAudio(req, res, next) {
  try {
    const {
      flowChunkNumber,
      flowChunkSize,
      flowTotalSize,
      flowIdentifier,
      flowFilename,
      project_uuid: projectUuid
    } = req.body;

    const flowParams = {
      flowChunkNumber: parseInt(flowChunkNumber, 10),
      flowChunkSize: parseInt(flowChunkSize, 10),
      flowTotalSize: parseInt(flowTotalSize, 10),
      flowIdentifier,
      flowFilename
    };

    const result = await uploadService.handleAudioChunk(req.file, flowParams, projectUuid);

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getLibraryAudio(req, res, next) {
  try {
    const { uuid, id } = req.params;
    const result = streamService.getLibraryAudioStream(uuid, id);

    res.set({
      'Content-Type': result.mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: `"${uuid}-${id}"`
    });
    result.stream.on('error', next).pipe(res);
  } catch (err) {
    next(err);
  }
}

async function deleteAudio(req, res, next) {
  try {
    const { uuid, id } = req.params;
    const result = await uploadService.deleteAudio(uuid, id);

    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  uploadVideo,
  uploadOptions,
  getVideo,
  downloadVideo,
  convertVideo,
  isVideoConverted,
  conversionStream,
  getAudio,
  uploadAudio,
  getLibraryAudio,
  deleteAudio
};
