const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { execFile } = require('child_process');
const { createLogger } = require('../utils/logger');
const { fileRepositoryCreator } = require('./fileRepository');
const { probeRepositoryCreator } = require('./probeRepository');
const { thumbnailRepositoryCreator } = require('./thumbnailRepository');
const { exportRepositoryCreator } = require('./exportRepository');
const { audioProcessingRepositoryCreator } = require('./audioProcessingRepository');
const config = require('../config');

const logger = createLogger('MediaRepository');

const { fileNames, subDirs } = config.paths;

const ENCODER = {
  codec: 'libx264',
  options: ['-preset veryfast', '-crf 28', '-threads 0', '-movflags +faststart']
};

function mediaRepositoryCreator(deps = {}) {
  const fileRepo = deps.fileRepo || fileRepositoryCreator(config.projectsPath);
  const execFileFn = deps.execFile || execFile;

  const sharedDeps = { fileRepo, execFile: execFileFn };

  const probeRepo = probeRepositoryCreator();
  const thumbRepo = thumbnailRepositoryCreator(sharedDeps);
  const exportRepo = exportRepositoryCreator(sharedDeps);
  const audioRepo = audioProcessingRepositoryCreator(sharedDeps);

  async function convertVideo(inputFile, outputDir) {
    const videoTracksDir = path.join(outputDir, subDirs.videoTracks);
    const originalOutput = path.join(videoTracksDir, fileNames.videoOriginal);
    const smallOutput = path.join(videoTracksDir, fileNames.videoSmall);
    const { smallVideoHeight } = config.ffmpeg;

    logger.info('convertVideo called', { inputFile, outputDir });

    await fileRepo.ensureDir(videoTracksDir);

    return new Promise((resolve, reject) => {
      const cmd = ffmpeg(inputFile)
        .output(originalOutput)
        .videoCodec('copy')
        .noAudio()
        .output(smallOutput)
        .videoCodec(ENCODER.codec)
        .outputOptions(ENCODER.options)
        .noAudio()
        .size(`?x${smallVideoHeight}`);

      cmd
        .on('start', commandLine => {
          logger.debug('FFmpeg started', { command: commandLine.substring(0, 100) });
        })
        .on('progress', progress => {
          logger.debug('FFmpeg progress', { percent: progress.percent });
        })
        .on('error', err => {
          logger.error('FFmpeg error', { error: err.message });
          reject(err);
        })
        .on('end', () => {
          logger.info('FFmpeg conversion complete');
          resolve();
        })
        .run();
    });
  }

  return {
    probeMedia: probeRepo.probeMedia,
    getVideoDuration: probeRepo.getVideoDuration,
    extractFrame: probeRepo.extractFrame,
    generateThumbs: thumbRepo.generateThumbs,
    convertVideo,
    stretchAudio: audioRepo.stretchAudio,
    convertAudioFormat: audioRepo.convertAudioFormat,
    exportVideo: exportRepo.exportVideo,
    exportAudio: exportRepo.exportAudio
  };
}

module.exports = { mediaRepositoryCreator };
