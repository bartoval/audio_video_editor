const { editorServiceCreator, streamServiceCreator } = require('../services');

const editorService = editorServiceCreator();
const streamService = streamServiceCreator();

async function getVideoMetadata(req, res, next) {
  try {
    const { uuid } = req.params;
    const metadata = await editorService.getVideoMetadata(uuid);

    res.json(metadata);
  } catch (err) {
    next(err);
  }
}

async function getAudioList(req, res, next) {
  try {
    const { uuid } = req.params;
    const tracks = await editorService.getAudioList(uuid);

    res.json(tracks);
  } catch (err) {
    next(err);
  }
}

async function getAudio(req, res, next) {
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

async function addAudio(req, res, next) {
  try {
    const { uuid, id } = req.params;
    const metaInfo = req.body;
    const result = await editorService.addAudioToTimeline(uuid, id, metaInfo);

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function removeAudio(req, res, next) {
  try {
    const { uuid, id } = req.params;
    const result = await editorService.removeAudioFromTimeline(uuid, id);

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function stretchAudio(req, res, next) {
  try {
    const { uuid } = req.params;
    const { audioId, ratio, pitchValue = 0, startTime = 0, duration = 0 } = req.body;

    if (audioId === undefined || audioId === null || !ratio) {
      return res.status(400).json({ error: 'audioId and ratio are required' });
    }

    const result = await editorService.stretchAudio(
      uuid,
      audioId,
      ratio,
      pitchValue,
      startTime,
      duration
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getStretchStatus(req, res, next) {
  try {
    const { uuid, id } = req.params;
    const result = await editorService.getStretchStatus(uuid, id);

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getVideo(req, res, next) {
  try {
    const { uuid } = req.params;
    const range = req.headers.range;
    const result = streamService.getVideoStream(uuid, range);

    if (result.error === 'range_not_satisfiable') {
      res
        .status(416)
        .set({ 'Content-Range': `bytes */${result.fileSize}` })
        .send();

      return;
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

async function loadProject(req, res, next) {
  try {
    const { uuid } = req.params;
    const data = await editorService.loadProject(uuid);

    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function saveProject(req, res, next) {
  try {
    const { uuid } = req.params;
    const result = await editorService.saveProject(uuid, req.body);

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function exportProject(req, res, next) {
  try {
    const { uuid } = req.params;
    const result = await editorService.exportProject(uuid, req.body);

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getThumbs(req, res, next) {
  try {
    const { uuid, id } = req.params;
    const result = streamService.getThumbStream(uuid, id);

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

async function getThumb(req, res, next) {
  try {
    const { uuid, id } = req.params;

    // Check if requesting manifest.json at root level (tiles mode)
    if (id === 'manifest.json') {
      const result = streamService.getThumbStream(uuid, id);

      res.set({
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        ETag: `"${uuid}-${id}"`
      });
      result.stream.on('error', next).pipe(res);

      return;
    }

    // Check if requesting a pre-generated strip (e.g., 0.01.webp) or a single frame (e.g., 1.50)
    if (id.endsWith('.webp')) {
      // Strip request - serve from thumbs directory
      const result = streamService.getThumbStream(uuid, id);

      res.set({
        'Content-Type': result.mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        ETag: `"${uuid}-${id}"`
      });
      result.stream.on('error', next).pipe(res);
    } else {
      // Single frame request - extract from video
      const thumbPath = await editorService.getThumb(uuid, parseFloat(id));

      res.set({
        'Cache-Control': 'public, max-age=86400',
        ETag: `"${uuid}-frame-${id}"`
      });
      res.sendFile(thumbPath);
    }
  } catch (err) {
    next(err);
  }
}

async function getThumbTile(req, res, next) {
  try {
    const { uuid, scale, file } = req.params;
    const filePath = `${scale}/${file}`;
    const result = streamService.getThumbStream(uuid, filePath);

    const isManifest = file === 'manifest.json';
    const contentType = isManifest ? 'application/json' : result.mimeType;
    const cacheControl = isManifest
      ? 'public, max-age=3600'
      : 'public, max-age=31536000, immutable';

    res.set({
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
      ETag: `"${uuid}-${scale}-${file}"`
    });
    result.stream.on('error', next).pipe(res);
  } catch (err) {
    next(err);
  }
}

async function getPublished(req, res, next) {
  try {
    const { uuid } = req.params;
    const videoPath = await editorService.getPublishedVideo(uuid);

    res.sendFile(videoPath);
  } catch (err) {
    next(err);
  }
}

async function deleteVideo(req, res, next) {
  try {
    const { uuid } = req.params;
    const result = await editorService.deleteVideo(uuid);

    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getVideoMetadata,
  getAudioList,
  getAudio,
  addAudio,
  removeAudio,
  stretchAudio,
  getStretchStatus,
  getVideo,
  loadProject,
  saveProject,
  exportProject,
  getThumbs,
  getThumb,
  getThumbTile,
  getPublished,
  deleteVideo
};
