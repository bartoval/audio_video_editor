const path = require('path');
const { v4: uuidv4 } = require('uuid');
const {
  createLogger,
  requireAudioFile,
  requirePublishedVideo,
  createTrackListManager,
  parseFilename
} = require('../utils');
const { ValidationError, NotFoundError } = require('../utils/errors');
const {
  projectRepositoryCreator,
  mediaRepositoryCreator,
  fileRepositoryCreator
} = require('../repositories');
const config = require('../config');

const logger = createLogger('EditorService');

// Track stretch operations in progress (auto-cleanup after 5 minutes)
const stretchOperations = new Map();
const OPERATION_TTL_MS = 5 * 60 * 1000;

// Destructure path constants
const { dirs, files } = config.paths;

function editorServiceCreator() {
  const projectRepo = projectRepositoryCreator();
  const mediaRepo = mediaRepositoryCreator();
  const fileRepo = fileRepositoryCreator(config.projectsPath);

  async function getVideoMetadata(projectUuid) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const infoPath = path.join(projectPath, files.info);
    const data = await fileRepo.readJson(infoPath);

    if (!data?.metadata) {
      throw new NotFoundError('Video metadata not found');
    }

    const baseUrl = `/api/v1/workspaces/${projectUuid}`;

    return {
      ...data.metadata,
      urls: {
        file: `${baseUrl}/video/file`,
        offline: `${baseUrl}/video/small`,
        thumbnails: `${baseUrl}/video/thumbnails`
      }
    };
  }

  async function getAudioList(projectUuid) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const trackListManager = createTrackListManager(projectPath, files, fileRepo);

    const tracks = await trackListManager.getTracks();
    const entries = Object.entries(tracks);
    const valid = {};

    for (const [id, meta] of entries) {
      const filePath = path.join(projectPath, dirs.library, id);
      const exists = await fileRepo.exists(filePath);

      if (exists) {
        valid[id] = meta;
      } else {
        // Clean stale entry
        await trackListManager.removeTrack(id);
        logger.warn('Pruned missing audio from track list', { projectUuid, id });
      }
    }

    return valid;
  }

  async function getAudioFile(projectUuid, audioId) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const filePath = path.join(projectPath, dirs.library, audioId);

    return await requireAudioFile(fileRepo, filePath);
  }

  async function addAudioToTimeline(projectUuid, audioId, metaInfo) {
    logger.info('Adding audio to timeline', { projectUuid, audioId });

    const projectPath = projectRepo.getProjectPath(projectUuid);
    const trackListManager = createTrackListManager(projectPath, files, fileRepo);

    await trackListManager.addTrack(audioId, metaInfo);

    return { success: true };
  }

  async function removeAudioFromTimeline(projectUuid, audioId) {
    logger.info('Removing audio from timeline', { projectUuid, audioId });

    const projectPath = projectRepo.getProjectPath(projectUuid);
    const trackListManager = createTrackListManager(projectPath, files, fileRepo);

    await trackListManager.removeTrack(audioId);

    return { success: true };
  }

  async function stretchAudio(
    projectUuid,
    audioId,
    ratio,
    pitchValue = 0,
    startTime = 0,
    duration = 0
  ) {
    // Validate ratio
    const numRatio = parseFloat(ratio);

    if (isNaN(numRatio) || numRatio <= 0 || numRatio > 10) {
      throw new ValidationError('Invalid ratio: must be a number between 0 and 10');
    }

    const numPitch = parseFloat(pitchValue) || 0;
    const numStartTime = parseFloat(startTime) || 0;
    const numDuration = parseFloat(duration) || 0;
    const projectPath = projectRepo.getProjectPath(projectUuid);

    // Handle special case: audioId === -1 means original video audio
    const isOriginalAudio = audioId === -1 || audioId === '-1';
    const inputFile = isOriginalAudio
      ? path.join(projectPath, files.audioWav)
      : path.join(projectPath, dirs.library, String(audioId));

    await requireAudioFile(fileRepo, inputFile);

    const derivedDir = path.join(projectPath, dirs.derived || path.join(dirs.library, 'derived'));
    await fileRepo.ensureDir(derivedDir);

    // Deterministic output filename based on source + params
    const sourceFilename = isOriginalAudio ? 'original-audio.wav' : String(audioId);
    const { baseName } = parseFilename(sourceFilename);
    const safeRatio = String(ratio)
      .replace(/[^0-9.+-]/g, '')
      .replace(/\./g, '_');
    const safePitch = String(pitchValue)
      .replace(/[^0-9.+-]/g, '')
      .replace(/\./g, '_');
    const safeStart = String(numStartTime.toFixed(1)).replace(/\./g, '_');
    const safeDuration = String(numDuration.toFixed(1)).replace(/\./g, '_');
    const stretchedId = `${baseName}-s${safeRatio}-p${safePitch}-t${safeStart}-d${safeDuration}.mp3`;
    const outputFile = path.join(derivedDir, stretchedId);

    // Track operation
    const operationId = uuidv4();
    const operationKey = `${projectUuid}:${audioId}`;

    stretchOperations.set(operationKey, {
      id: operationId,
      status: 'processing',
      outputId: stretchedId
    });

    logger.info('Starting audio stretch', {
      projectUuid,
      audioId,
      ratio: numRatio,
      pitchValue: numPitch,
      startTime: numStartTime,
      duration: numDuration
    });

    // Fast path: use cache if exists
    if (await fileRepo.exists(outputFile)) {
      stretchOperations.set(operationKey, {
        id: operationId,
        status: 'complete',
        outputId: stretchedId,
        url: `/api/v1/workspaces/${projectUuid}/audio/derived/${stretchedId}`
      });
      setTimeout(() => stretchOperations.delete(operationKey), OPERATION_TTL_MS);
      return {
        operationId,
        status: 'complete',
        outputId: stretchedId,
        url: `/api/v1/workspaces/${projectUuid}/audio/derived/${stretchedId}`,
        cached: true
      };
    }

    // Run stretch and WAIT for completion (like old backend)
    try {
      await mediaRepo.stretchAudio(
        inputFile,
        outputFile,
        numRatio,
        numPitch,
        numStartTime,
        numDuration
      );

      // Get metadata for the new file
      let audioMeta = null;

      try {
        const meta = await mediaRepo.probeMedia(outputFile);

        audioMeta = {
          id: stretchedId,
          name: `${baseName} (stretched)`,
          duration: meta.format.duration * 1000,
          format: 'mp3'
        };
      } catch (err) {
        logger.warn('Failed to probe stretched audio', { error: err.message });
      }

      // Do not add stretched output to trackList (kept only as derived asset)

      stretchOperations.set(operationKey, {
        id: operationId,
        status: 'complete',
        outputId: stretchedId,
        url: `/api/v1/workspaces/${projectUuid}/audio/derived/${stretchedId}`
      });
      logger.info('Audio stretch complete', { projectUuid, audioId, stretchedId });

      // Auto-cleanup after TTL
      setTimeout(() => stretchOperations.delete(operationKey), OPERATION_TTL_MS);

      // Return output ID so frontend can fetch the file
      return {
        operationId,
        status: 'complete',
        outputId: stretchedId,
        url: `/api/v1/workspaces/${projectUuid}/audio/derived/${stretchedId}`,
        meta: audioMeta
      };
    } catch (err) {
      stretchOperations.set(operationKey, {
        id: operationId,
        status: 'error',
        error: err.message
      });
      logger.error('Audio stretch failed', { projectUuid, audioId, error: err.message });

      // Auto-cleanup errors after TTL
      setTimeout(() => stretchOperations.delete(operationKey), OPERATION_TTL_MS);

      throw err;
    }
  }

  async function getStretchStatus(projectUuid, audioId) {
    const operation = stretchOperations.get(`${projectUuid}:${audioId}`);

    if (!operation) {
      return { status: 'not_found' };
    }

    return operation;
  }

  async function loadProject(projectUuid) {
    // Verify project exists first
    const project = await projectRepo.findByUuid(projectUuid);

    if (!project) {
      throw new NotFoundError(`Project not found: ${projectUuid}`);
    }

    const projectPath = projectRepo.getProjectPath(projectUuid);
    const backupPath = path.join(projectPath, files.backup);
    const data = await fileRepo.readJson(backupPath);

    return data || {};
  }

  async function saveProject(projectUuid, data) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const backupPath = path.join(projectPath, files.backup);

    await fileRepo.ensureDir(path.join(projectPath, dirs.saved));
    await fileRepo.writeJson(backupPath, data);
    logger.info('Project saved', { projectUuid });

    return { success: true };
  }

  async function exportProject(projectUuid, exportConfig) {
    logger.info('Exporting project', { projectUuid, config: exportConfig });

    const { tracks = [], duration, format = 'mp3' } = exportConfig;
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const videoFile = path.join(projectPath, files.video);
    const hasVideo = await fileRepo.exists(videoFile);

    const publishedDir = path.join(projectPath, dirs.published);
    await fileRepo.ensureDir(publishedDir);

    const libraryDir = path.join(projectPath, dirs.library);

    if (hasVideo) {
      const outputFile = path.join(projectPath, files.publishedVideo);

      await mediaRepo.exportVideo(videoFile, outputFile, tracks, libraryDir, null, duration);

      return { res: `/api/v1/workspaces/${projectUuid}/exports/out`, type: 'video' };
    }

    const audioFormat = format === 'wav' ? 'wav' : 'mp3';
    const outputFile = path.join(
      projectPath,
      audioFormat === 'wav' ? files.publishedAudioWav : files.publishedAudioMp3
    );

    await mediaRepo.exportAudio(outputFile, tracks, libraryDir, duration);

    return {
      res: `/api/v1/workspaces/${projectUuid}/exports/audio.${audioFormat}`,
      type: 'audio',
      format: audioFormat
    };
  }

  async function getThumb(projectUuid, time) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const thumbsDir = path.join(projectPath, dirs.thumbs);
    const cacheDir = path.join(thumbsDir, 'cache');
    const cacheFile = path.join(cacheDir, `thumb_${time.toFixed(2)}.webp`);

    // Check cache first
    if (await fileRepo.exists(cacheFile)) {
      return cacheFile;
    }

    // Get video file for frame extraction
    const videoFile = path.join(projectPath, files.video);

    if (!(await fileRepo.exists(videoFile))) {
      throw new NotFoundError('Video file not found');
    }

    // Ensure cache directory exists
    await fileRepo.ensureDir(cacheDir);

    // Extract frame at specified time
    await mediaRepo.extractFrame(videoFile, cacheFile, time);

    return cacheFile;
  }

  async function getPublishedVideo(projectUuid) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const publishedPath = path.join(projectPath, files.publishedVideo);

    return await requirePublishedVideo(fileRepo, publishedPath);
  }

  async function getPublishedAudio(projectUuid, format = 'mp3') {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const audioFormat = format === 'wav' ? 'wav' : 'mp3';
    const publishedPath = path.join(
      projectPath,
      audioFormat === 'wav' ? files.publishedAudioWav : files.publishedAudioMp3
    );

    if (!(await fileRepo.exists(publishedPath))) {
      throw new NotFoundError('Published audio not found');
    }

    return publishedPath;
  }

  async function deleteVideo(projectUuid) {
    const projectPath = projectRepo.getProjectPath(projectUuid);

    // Delete video-related files but keep project structure
    await fileRepo.deleteDir(path.join(projectPath, dirs.resources));
    await fileRepo.deleteDir(path.join(projectPath, dirs.thumbs));
    await fileRepo.deleteFile(path.join(projectPath, files.original));
    await fileRepo.deleteFile(path.join(projectPath, files.info));

    logger.info('Video deleted from project', { projectUuid });

    return { success: true };
  }

  return {
    getVideoMetadata,
    getAudioList,
    getAudioFile,
    addAudioToTimeline,
    removeAudioFromTimeline,
    stretchAudio,
    getStretchStatus,
    loadProject,
    saveProject,
    exportProject,
    getThumb,
    getPublishedVideo,
    getPublishedAudio,
    deleteVideo
  };
}

module.exports = { editorServiceCreator };
