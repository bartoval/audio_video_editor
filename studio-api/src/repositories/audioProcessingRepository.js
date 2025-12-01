const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { execFile } = require('child_process');
const { createLogger } = require('../utils/logger');
const { fileRepositoryCreator } = require('./fileRepository');
const { assertFiniteNumber, createSafeExec } = require('./mediaUtils');
const config = require('../config');

const logger = createLogger('AudioProcessingRepository');

function audioProcessingRepositoryCreator(deps = {}) {
  const fileRepo = deps.fileRepo || fileRepositoryCreator(config.projectsPath);
  const execFileFn = deps.execFile || execFile;
  const safeExec = createSafeExec(execFileFn);

  async function stretchAudio(
    inputFile,
    outputFile,
    ratio,
    pitchValue = 0,
    startTime = 0,
    duration = 0
  ) {
    const tempDir = path.dirname(outputFile);
    const tempWav = path.join(tempDir, `temp_${Date.now()}.wav`);
    const tempStretched = path.join(tempDir, `temp_stretched_${Date.now()}.wav`);
    const cleanup = async () => {
      await fileRepo.deleteFile(tempWav);
      await fileRepo.deleteFile(tempStretched);
    };

    try {
      assertFiniteNumber(ratio, 'ratio');
      assertFiniteNumber(pitchValue, 'pitchValue');
      assertFiniteNumber(startTime, 'startTime');
      assertFiniteNumber(duration, 'duration');

      const trimArgs = ['-y'];

      if (startTime > 0 || duration > 0) {
        trimArgs.push('-ss', String(startTime), '-t', String(duration));
      }

      trimArgs.push('-i', inputFile, tempWav);
      logger.info('Step 1 - Trim/convert:', { args: trimArgs });
      await safeExec('ffmpeg', trimArgs);

      const stretchArgs = [
        '--ignore-clipping',
        '-t',
        String(ratio),
        '-p',
        String(pitchValue),
        tempWav,
        tempStretched
      ];
      logger.info('Step 2 - Rubberband:', { ratio, pitchValue });
      await safeExec('rubberband', stretchArgs);

      const mp3Args = [
        '-y',
        '-i',
        tempStretched,
        '-codec:a',
        'libmp3lame',
        '-qscale:a',
        '3',
        outputFile
      ];
      logger.info('Step 3 - Convert to MP3');
      await safeExec('ffmpeg', mp3Args);

      await cleanup();
      logger.info('Audio stretch complete', { ratio, pitchValue, startTime, duration });

      return outputFile;
    } catch (err) {
      await cleanup();
      logger.error('Stretch error', { error: err.message });
      throw err;
    }
  }

  async function convertAudioFormat(inputFile, outputFile, format = 'mp3') {
    return new Promise((resolve, reject) => {
      const cmd = ffmpeg(inputFile);

      if (format === 'wav') {
        cmd.audioCodec('pcm_s16le').audioFrequency(44100).audioChannels(2);
      } else {
        cmd.audioCodec('libmp3lame').audioBitrate('320k');
      }

      cmd
        .output(outputFile)
        .on('error', err => {
          logger.error('Audio conversion failed', { format, error: err.message });
          reject(err);
        })
        .on('end', () => {
          logger.info('Audio conversion complete', { format, output: outputFile });
          resolve(outputFile);
        })
        .run();
    });
  }

  return { stretchAudio, convertAudioFormat };
}

module.exports = { audioProcessingRepositoryCreator };
