const path = require('path');
const { v4: uuidv4 } = require('uuid');
const {
  createLogger,
  requireAudioFile,
  requireVideoFile,
  requirePublishedVideo,
  createTrackListManager,
  parseFilename,
  generateStretchedFilename
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
const { dirs, files, ext } = config.paths;

function editorServiceCreator() {
  const projectRepo = projectRepositoryCreator();
  const mediaRepo = mediaRepositoryCreator();
  const fileRepo = fileRepositoryCreator(config.projectsPath);

  async function getVideoMetadata(projectUuid) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const infoPath = path.join(projectPath, files.info);
    const data = fileRepo.readJson(infoPath);

    if (!data?.metadata) {
      throw new NotFoundError('Video metadata not found');
    }

    return data.metadata;
  }

  async function getAudioList(projectUuid) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const trackListManager = createTrackListManager(projectPath, files, fileRepo);

    return trackListManager.getTracks();
  }

  async function getAudioFile(projectUuid, audioId) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const filePath = path.join(projectPath, dirs.library, audioId);

    return requireAudioFile(fileRepo, filePath);
  }

  async function addAudioToTimeline(projectUuid, audioId, metaInfo) {
    logger.info('Adding audio to timeline', { projectUuid, audioId });

    const projectPath = projectRepo.getProjectPath(projectUuid);
    const trackListManager = createTrackListManager(projectPath, files, fileRepo);

    trackListManager.addTrack(audioId, metaInfo);

    return { success: true };
  }

  async function removeAudioFromTimeline(projectUuid, audioId) {
    logger.info('Removing audio from timeline', { projectUuid, audioId });

    const projectPath = projectRepo.getProjectPath(projectUuid);
    const trackListManager = createTrackListManager(projectPath, files, fileRepo);

    trackListManager.removeTrack(audioId);

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

    requireAudioFile(fileRepo, inputFile);

    // Generate output filename - always output as MP3
    const sourceFilename = isOriginalAudio ? 'original-audio.wav' : String(audioId);
    const { baseName } = parseFilename(sourceFilename);
    const stretchedId = `${baseName}-stretched-${Date.now()}.mp3`;
    const outputFile = path.join(projectPath, dirs.library, stretchedId);

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

      // Add to trackList
      if (audioMeta) {
        const trackListManager = createTrackListManager(projectPath, files, fileRepo);

        trackListManager.addTrack(stretchedId, audioMeta);
      }

      stretchOperations.set(operationKey, {
        id: operationId,
        status: 'complete',
        outputId: stretchedId
      });
      logger.info('Audio stretch complete', { projectUuid, audioId, stretchedId });

      // Auto-cleanup after TTL
      setTimeout(() => stretchOperations.delete(operationKey), OPERATION_TTL_MS);

      // Return output ID so frontend can fetch the file
      return { operationId, status: 'complete', outputId: stretchedId };
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
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const backupPath = path.join(projectPath, files.backup);
    const data = fileRepo.readJson(backupPath);

    return data || {};
  }

  async function saveProject(projectUuid, data) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const backupPath = path.join(projectPath, files.backup);

    fileRepo.ensureDir(path.join(projectPath, dirs.saved));
    fileRepo.writeJson(backupPath, data);
    logger.info('Project saved', { projectUuid });

    return { success: true };
  }

  async function exportProject(projectUuid, exportConfig) {
    logger.info('Exporting project', { projectUuid, config: exportConfig });

    const { tracks = [] } = exportConfig;
    const projectPath = projectRepo.getProjectPath(projectUuid);

    // Source video (mute)
    const videoFile = path.join(projectPath, files.video);

    requireVideoFile(fileRepo, videoFile);

    // Output path
    const publishedDir = path.join(projectPath, dirs.published);
    fileRepo.ensureDir(publishedDir);
    const outputFile = path.join(projectPath, files.publishedVideo);

    // Audio library directory
    const libraryDir = path.join(projectPath, dirs.library);

    // Original video audio - not used in new simplified flow
    const originalAudioFile = null;

    // Get video duration
    const { duration } = exportConfig;

    // Run export
    await mediaRepo.exportVideo(
      videoFile,
      outputFile,
      tracks,
      libraryDir,
      originalAudioFile,
      duration
    );

    // Return URL for the published video
    return { res: `/api/v1/workspaces/${projectUuid}/exports/out` };
  }

  async function getThumb(projectUuid, time) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const thumbsDir = path.join(projectPath, dirs.thumbs);
    const cacheDir = path.join(thumbsDir, 'cache');
    const cacheFile = path.join(cacheDir, `thumb_${time.toFixed(2)}.webp`);

    // Check cache first
    if (fileRepo.exists(cacheFile)) {
      return cacheFile;
    }

    // Get video file for frame extraction
    const videoFile = path.join(projectPath, files.video);

    if (!fileRepo.exists(videoFile)) {
      throw new NotFoundError('Video file not found');
    }

    // Ensure cache directory exists
    fileRepo.ensureDir(cacheDir);

    // Extract frame at specified time
    await mediaRepo.extractFrame(videoFile, cacheFile, time);

    return cacheFile;
  }

  async function getPublishedVideo(projectUuid) {
    const projectPath = projectRepo.getProjectPath(projectUuid);
    const publishedPath = path.join(projectPath, files.publishedVideo);

    return requirePublishedVideo(fileRepo, publishedPath);
  }

  async function deleteVideo(projectUuid) {
    const projectPath = projectRepo.getProjectPath(projectUuid);

    // Delete video-related files but keep project structure
    fileRepo.deleteDir(path.join(projectPath, dirs.resources));
    fileRepo.deleteDir(path.join(projectPath, dirs.thumbs));
    fileRepo.deleteFile(path.join(projectPath, files.original));
    fileRepo.deleteFile(path.join(projectPath, files.info));

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
    deleteVideo
  };
}

module.exports = { editorServiceCreator };
