const {
  uploadServiceCreator,
  streamServiceCreator,
  videoConversionServiceCreator
} = require('../services');
const { createLogger } = require('../utils/logger');

const logger = createLogger('UploadHandler');
const uploadService = uploadServiceCreator();
const streamService = streamServiceCreator();
const videoConversionService = videoConversionServiceCreator();

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

    const result = await streamService.getVideoStream(uuid, range);

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
    const result = await streamService.getVideoStream(uuid);

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
  const { priorityScale = '0.02' } = req.body || {};

  logger.info('convertVideo called', { uuid, priorityScale });

  // Respond immediately - conversion runs in background
  res.status(200).send();

  // Delegate to video conversion service
  try {
    await videoConversionService.convertVideo(uuid, priorityScale);
  } catch (err) {
    logger.error('Video conversion failed', { uuid, error: err.message });
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

async function uploadAudio(req, res, next) {
  try {
    const {
      flowChunkNumber,
      flowChunkSize,
      flowTotalSize,
      flowIdentifier,
      flowFilename,
      project_uuid: projectUuid,
      provider,
      source
    } = req.body;

    const flowParams = {
      flowChunkNumber: parseInt(flowChunkNumber, 10),
      flowChunkSize: parseInt(flowChunkSize, 10),
      flowTotalSize: parseInt(flowTotalSize, 10),
      flowIdentifier,
      flowFilename,
      provider,
      source
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
    const { range } = req.headers;
    const result = await streamService.getLibraryAudioStream(uuid, id, range);

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
        'Content-Type': result.mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        ETag: `"${uuid}-${id}"`
      });
    } else {
      res.status(200).set({
        'Accept-Ranges': 'bytes',
        'Content-Length': result.fileSize,
        'Content-Type': result.mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        ETag: `"${uuid}-${id}"`
      });
    }

    result.stream.on('error', next).pipe(res);
  } catch (err) {
    next(err);
  }
}

async function getDerivedAudio(req, res, next) {
  try {
    const { uuid, id } = req.params;
    const result = await streamService.getDerivedAudioStream(uuid, id);

    res.set({
      'Content-Type': result.mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: `"${uuid}-derived-${id}"`
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
// Thumbnail Regeneration
// ============================================================================

async function regenerateThumbnails(req, res, next) {
  try {
    const { uuid } = req.params;
    const { priorityScale = '0.02' } = req.body || {};

    // Return immediately - generation happens in background
    res.json({ status: 'generating', message: 'Thumbnail regeneration started' });

    // Delegate to video conversion service
    await videoConversionService.regenerateThumbnails(uuid, priorityScale);
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
  uploadAudio,
  getLibraryAudio,
  getDerivedAudio,
  deleteAudio,
  regenerateThumbnails
};
