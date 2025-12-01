const ffmpeg = require('fluent-ffmpeg');
const { createLogger } = require('../utils/logger');

const logger = createLogger('ProbeRepository');

function probeRepositoryCreator() {
  function probeMedia(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, meta) => {
        if (err) {
          reject(err);

          return;
        }

        resolve({
          filename: meta.format.filename,
          format: meta.format,
          streams: meta.streams,
          metadata: meta.format.tags || {}
        });
      });
    });
  }

  async function getVideoDuration(filePath) {
    const probe = await probeMedia(filePath);

    return probe.format.duration || 0;
  }

  function extractFrame(inputFile, outputFile, time, height = 180) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputFile)
        .seekInput(time)
        .frames(1)
        .outputOptions([`-vf scale=-1:${height}`])
        .output(outputFile)
        .on('error', err => {
          logger.warn('Frame extraction failed', { time, error: err.message });
          reject(err);
        })
        .on('end', () => {
          resolve(outputFile);
        })
        .run();
    });
  }

  return { probeMedia, getVideoDuration, extractFrame };
}

module.exports = { probeRepositoryCreator };
