const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { mediaWorkerServiceCreator } = require('../services/mediaWorkerService');
const { projectRepositoryCreator } = require('../repositories');
const { eventServiceCreator } = require('../services/eventService');
const config = require('../config');
const { createLogger } = require('../utils/logger');

const logger = createLogger('MlHandler');
const mediaWorkerService = mediaWorkerServiceCreator();
const projectRepo = projectRepositoryCreator();
const eventService = eventServiceCreator();

/**
 * Convert host file path to Docker container path
 * Host: /home/user/.../studio-api/projects/0/0/library/file.wav
 * Container: /media/projects/0/0/library/file.wav
 */
function toContainerPath(hostPath) {
  const projectsRoot = path.join(config.rootPath, 'projects');
  const relativePath = path.relative(projectsRoot, hostPath);

  return path.join(config.mediaWorker.sharedMediaPath, 'projects', relativePath);
}

/**
 * Convert container path back to host path
 * Handles both input paths (/media/projects/...) and output paths (/media/output/...)
 */
function toHostPath(containerPath) {
  const mediaPrefix = config.mediaWorker.sharedMediaPath;

  if (containerPath.startsWith(path.join(mediaPrefix, 'output'))) {
    const relativePath = path.relative(path.join(mediaPrefix, 'output'), containerPath);

    return path.join(config.rootPath, 'projects', '.stems-output', relativePath);
  }

  const relativePath = path.relative(path.join(mediaPrefix, 'projects'), containerPath);

  return path.join(config.rootPath, 'projects', relativePath);
}

/**
 * Check media worker health
 * GET /api/v1/ml/health
 */
async function getHealth(req, res) {
  const health = await mediaWorkerService.healthCheck();

  res.json(health);
}

/**
 * Start transcription job
 * POST /api/v1/ml/transcribe
 */
async function transcribe(req, res, next) {
  try {
    const { filePath, language, model } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' });
    }

    const result = await mediaWorkerService.transcribe(filePath, { language, model });

    logger.info('Transcription job started', { jobId: result.jobId, filePath });

    res.json(result);
  } catch (error) {
    logger.error('Failed to start transcription', { error: error.message });
    next(error);
  }
}

/**
 * Get transcription job status
 * GET /api/v1/ml/transcribe/:jobId
 */
async function getTranscribeStatus(req, res, next) {
  try {
    const { jobId } = req.params;
    const status = await mediaWorkerService.getTranscribeStatus(jobId);

    res.json(status);
  } catch (error) {
    logger.error('Failed to get transcription status', {
      jobId: req.params.jobId,
      error: error.message
    });
    next(error);
  }
}

/**
 * Start stem separation job
 * POST /api/v1/ml/stems
 */
async function stems(req, res, next) {
  try {
    const { filePath, model, twoStems } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' });
    }

    const result = await mediaWorkerService.stems(filePath, { model, twoStems });

    logger.info('Stem separation job started', { jobId: result.jobId, filePath });

    res.json(result);
  } catch (error) {
    logger.error('Failed to start stem separation', { error: error.message });
    next(error);
  }
}

/**
 * Get stem separation job status
 * GET /api/v1/ml/stems/:jobId
 */
async function getStemsStatus(req, res, next) {
  try {
    const { jobId } = req.params;
    const status = await mediaWorkerService.getStemsStatus(jobId);

    res.json(status);
  } catch (error) {
    logger.error('Failed to get stems status', { jobId: req.params.jobId, error: error.message });
    next(error);
  }
}

/**
 * Build callback URL for ML job completion
 */
function buildCallbackUrl(uuid, audioId, jobType) {
  const baseUrl = config.mediaWorker.callbackBaseUrl;

  return `${baseUrl}/api/v1/internal/jobs/callback?uuid=${uuid}&audioId=${encodeURIComponent(audioId)}&type=${jobType}`;
}

/**
 * Start stem separation for a library audio track
 * POST /api/v1/workspaces/:uuid/audio/:id/stems
 */
async function stemsFromLibrary(req, res, next) {
  try {
    const { uuid, id } = req.params;
    const { model, twoStems } = req.body;

    const projectPath = projectRepo.getProjectPath(uuid);
    const hostFilePath = path.join(projectPath, config.paths.dirs.library, id);
    const containerFilePath = toContainerPath(hostFilePath);
    const callbackUrl = buildCallbackUrl(uuid, id, 'stems');

    const result = await mediaWorkerService.stems(containerFilePath, {
      model,
      twoStems,
      callbackUrl
    });

    logger.info('Library stem separation job started', {
      jobId: result.jobId,
      uuid,
      audioId: id,
      callbackUrl
    });

    res.json(result);
  } catch (error) {
    logger.error('Failed to start library stem separation', { error: error.message });
    next(error);
  }
}

/**
 * Start transcription for a library audio track
 * POST /api/v1/workspaces/:uuid/audio/:id/transcribe
 */
async function transcribeFromLibrary(req, res, next) {
  try {
    const { uuid, id } = req.params;
    const { language, model } = req.body;

    const projectPath = projectRepo.getProjectPath(uuid);
    const hostFilePath = path.join(projectPath, config.paths.dirs.library, id);
    const containerFilePath = toContainerPath(hostFilePath);
    const callbackUrl = buildCallbackUrl(uuid, id, 'transcribe');

    const result = await mediaWorkerService.transcribe(containerFilePath, {
      language,
      model,
      callbackUrl
    });

    logger.info('Library transcription job started', {
      jobId: result.jobId,
      uuid,
      audioId: id,
      callbackUrl
    });

    res.json(result);
  } catch (error) {
    logger.error('Failed to start library transcription', { error: error.message });
    next(error);
  }
}

/**
 * Download stems as ZIP file
 * GET /api/v1/workspaces/:uuid/audio/:id/stems/:jobId/download
 */
async function downloadStemsZip(req, res, next) {
  try {
    const { uuid, id, jobId } = req.params;

    const status = await mediaWorkerService.getStemsStatus(jobId);

    if (status.status !== 'completed') {
      return res.status(400).json({
        error: 'Stems not ready',
        status: status.status
      });
    }

    if (!status.stems || status.stems.length === 0) {
      return res.status(404).json({ error: 'No stems found' });
    }

    const trackName = path.basename(id, path.extname(id));
    const zipFilename = `${trackName}_stems.zip`;

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipFilename}"`
    });

    const archive = archiver('zip', { zlib: { level: 5 } });

    archive.on('error', err => {
      logger.error('Archive error', { error: err.message });
      next(err);
    });

    archive.pipe(res);

    for (const stem of status.stems) {
      const hostStemPath = toHostPath(stem.path);

      try {
        await fs.promises.access(hostStemPath);
        const stemName = `${trackName}_${stem.name}.wav`;
        archive.file(hostStemPath, { name: stemName });
      } catch {
        // File doesn't exist, skip
      }
    }

    await archive.finalize();

    logger.info('Stems ZIP downloaded', {
      uuid,
      audioId: id,
      jobId,
      stemCount: status.stems.length
    });
  } catch (error) {
    logger.error('Failed to download stems ZIP', { error: error.message });
    next(error);
  }
}

/**
 * Start scene detection for a project video
 * POST /api/v1/workspaces/:uuid/video/scene-detect
 */
async function sceneDetectFromVideo(req, res, next) {
  try {
    const { uuid } = req.params;
    const { threshold, minSceneLen } = req.body;

    const projectPath = projectRepo.getProjectPath(uuid);
    const hostFilePath = path.join(projectPath, config.paths.files.video);
    const containerFilePath = toContainerPath(hostFilePath);
    const callbackUrl = buildCallbackUrl(uuid, 'video', 'scene-detect');

    const result = await mediaWorkerService.sceneDetect(containerFilePath, {
      threshold,
      minSceneLen,
      callbackUrl
    });

    logger.info('Scene detection job started', {
      jobId: result.jobId,
      uuid,
      callbackUrl
    });

    res.json(result);
  } catch (error) {
    logger.error('Failed to start scene detection', { error: error.message });
    next(error);
  }
}

/**
 * Get scene detection job status
 * GET /api/v1/workspaces/:uuid/video/scene-detect/:jobId
 */
async function getSceneDetectStatus(req, res, next) {
  try {
    const { jobId } = req.params;
    const status = await mediaWorkerService.getSceneDetectStatus(jobId);

    res.json(status);
  } catch (error) {
    logger.error('Failed to get scene detection status', {
      jobId: req.params.jobId,
      error: error.message
    });
    next(error);
  }
}

/**
 * Internal callback for ML job completion (called by Python worker)
 * POST /api/v1/internal/jobs/callback
 */
function jobCallback(req, res) {
  const { uuid, audioId, type: jobType } = req.query;
  const { job_id: jobId, status, error } = req.body;

  if (!uuid || !jobId) {
    logger.warn('Job callback missing required params', { uuid, jobId });

    return res.status(400).json({ error: 'Missing uuid or job_id' });
  }

  logger.info('Job callback received', { uuid, audioId, jobId, status, type: jobType });

  const payload = {
    type: jobType || 'stems',
    jobId,
    audioId,
    status,
    error: error || null
  };

  if (jobType === 'stems') {
    payload.stems = req.body.stems || null;
  }

  if (jobType === 'transcribe') {
    payload.text = req.body.text || null;
    payload.segments = req.body.segments || null;
    payload.language = req.body.language || null;
    payload.duration = req.body.duration || null;
  }

  if (jobType === 'scene-detect') {
    payload.scenes = req.body.scenes || null;
    payload.fps = req.body.fps || null;
    payload.duration = req.body.duration || null;
  }

  eventService.emit(uuid, 'job:completed', payload);

  res.json({ received: true });
}

module.exports = {
  getHealth,
  transcribe,
  getTranscribeStatus,
  transcribeFromLibrary,
  stems,
  getStemsStatus,
  stemsFromLibrary,
  downloadStemsZip,
  sceneDetectFromVideo,
  getSceneDetectStatus,
  jobCallback
};
