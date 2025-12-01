const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { execFile } = require('child_process');
const { createLogger } = require('../utils/logger');
const { fileRepositoryCreator } = require('./fileRepository');
const { assertFiniteNumber, createSafeExec } = require('./mediaUtils');
const config = require('../config');

const logger = createLogger('ExportRepository');

function exportRepositoryCreator(deps = {}) {
  const fileRepo = deps.fileRepo || fileRepositoryCreator(config.projectsPath);
  const execFileFn = deps.execFile || execFile;
  const safeExec = createSafeExec(execFileFn);

  function buildVolumeFilter(elem, duration) {
    const { volumeValues = [], gain = 1 } = elem;
    const baseVolume = gain;

    if (volumeValues.length === 0) {
      return `volume=${baseVolume.toFixed(5)}`;
    }

    const segments = [];

    const DOWNSAMPLE_FACTOR = 10;
    const VALUE_THRESHOLD = 0.001;

    for (let j = 0; j < volumeValues.length; j++) {
      const curve = volumeValues[j];
      const { times, values } = curve.data;
      const numTimes = times.length;

      if (numTimes === 0) continue;

      const firstTime = times[0];
      const lastTime = times[numTimes - 1];
      const lastValue = values[numTimes - 1] * gain;

      if (j === 0 && firstTime > 0) {
        segments.push(
          `volume=${baseVolume.toFixed(5)}:eval=frame:enable='between(t,0,${firstTime})'`
        );
      }

      let prevValue = null;
      let segmentStart = 0;

      for (let i = 0; i < numTimes; i++) {
        const isKeyPoint = i === 0 || i === numTimes - 1 || i % DOWNSAMPLE_FACTOR === 0;
        if (!isKeyPoint) continue;

        const currentValue = values[i] * gain;

        if (prevValue !== null && Math.abs(currentValue - prevValue) < VALUE_THRESHOLD) {
          continue;
        }

        if (prevValue !== null && segmentStart < i) {
          const t1 = times[segmentStart].toFixed(5);
          const t2 = times[i].toFixed(5);
          if (t1 !== t2) {
            segments.push(
              `volume=${prevValue.toFixed(5)}:eval=frame:enable='between(t,${t1},${t2})'`
            );
          }
        }

        prevValue = currentValue;
        segmentStart = i;
      }

      const nextCurveStart =
        j < volumeValues.length - 1 ? volumeValues[j + 1].data.times[0] : duration;

      if (lastTime < nextCurveStart) {
        segments.push(
          `volume=${lastValue.toFixed(5)}:eval=frame:enable='between(t,${lastTime},${nextCurveStart})'`
        );
      }
    }

    if (segments.length === 0) {
      return `volume=${baseVolume.toFixed(5)}`;
    }

    return segments.join(',');
  }

  function buildDelayFilter(elem) {
    const startTime = elem.startTime * (1 / elem.stretchFactor) * 1000;

    return `adelay=${startTime}|${startTime}`;
  }

  function buildPanFilter(elem) {
    const { panValue } = elem;
    const gain = 1 - Math.abs(panValue);
    const c0 = panValue > 0 ? gain + '*c0' : 'c0';
    const c1 = panValue < 0 ? gain + '*c1' : 'c1';

    return `pan=stereo|FL<${c0}|FR<${c1}`;
  }

  function buildTrimArgs(elem) {
    const { isCut, startTimeBuffer = 0, durationTimeBuffer, durationTimeCut } = elem;

    if (isCut !== true) {
      return [];
    }

    const duration = durationTimeBuffer > 0 ? durationTimeBuffer : durationTimeCut;

    if (duration > 0) {
      return ['-ss', String(startTimeBuffer), '-t', String(duration)];
    }

    return [];
  }

  async function exportVideo(
    videoFile,
    outputFile,
    tracks,
    libraryDir,
    originalAudioFile,
    videoDuration
  ) {
    const publishedDir = path.dirname(outputFile);
    const tempFiles = [];

    try {
      if (!tracks || tracks.length === 0) {
        await new Promise((resolve, reject) => {
          ffmpeg(videoFile)
            .videoCodec('copy')
            .noAudio()
            .output(outputFile)
            .on('error', reject)
            .on('end', resolve)
            .run();
        });

        return outputFile;
      }

      logger.info('Export starting', { trackCount: tracks.length, duration: videoDuration });

      const processTrack = async (elem, index) => {
        const { idTrack, stretchFactor = 1, pitch = 0, startTime = 0, panValue = 0 } = elem;

        assertFiniteNumber(stretchFactor, 'stretchFactor');
        assertFiniteNumber(pitch, 'pitch');
        assertFiniteNumber(startTime, 'startTime');
        assertFiniteNumber(panValue, 'panValue');

        const trimArgs = buildTrimArgs(elem);

        logger.info(`Track ${index} export:`, {
          idTrack,
          startTime,
          stretchFactor,
          pitch,
          panValue,
          isCut: elem.isCut,
          startTimeBuffer: elem.startTimeBuffer,
          durationTimeBuffer: elem.durationTimeBuffer,
          durationTimeCut: elem.durationTimeCut,
          trimApplied: trimArgs
        });

        const src = idTrack === -1 ? originalAudioFile : path.join(libraryDir, idTrack);

        const outFile = path.join(publishedDir, `out${index}.wav`);
        const outFileZ = path.join(publishedDir, `outZ${index}.wav`);

        const ffmpegArgs = ['-y', ...trimArgs, '-i', src];

        let filterChain = buildVolumeFilter(elem, videoDuration);

        if (startTime > 0) {
          filterChain += ',' + buildDelayFilter(elem);
        }

        if (panValue !== 0) {
          filterChain += ',' + buildPanFilter(elem);
        }

        ffmpegArgs.push('-filter:a', filterChain, outFile);

        logger.info(`Track ${index} ffmpeg args:`, { args: ffmpegArgs });
        await safeExec('ffmpeg', ffmpegArgs);
        tempFiles.push(outFile);

        const stretchArgs = [
          '--ignore-clipping',
          '-t',
          String(stretchFactor),
          '-p',
          String(pitch),
          outFile,
          outFileZ
        ];
        await safeExec('rubberband', stretchArgs);
        tempFiles.push(outFileZ);

        logger.debug(`Track ${index} processed`);
      };

      await Promise.all(tracks.map((elem, index) => processTrack(elem, index)));

      logger.info('Mixing audio tracks');
      const mixedAudio = path.join(publishedDir, 'out.mp3');
      const mixArgs = ['-y'];

      for (let i = 0; i < tracks.length; i++) {
        mixArgs.push('-i', path.join(publishedDir, `outZ${i}.wav`));
      }

      mixArgs.push(
        '-t',
        String(videoDuration),
        '-filter_complex',
        `amix=inputs=${tracks.length}:dropout_transition=${videoDuration},volume=${tracks.length}[out]`,
        '-map',
        '[out]',
        mixedAudio
      );
      await safeExec('ffmpeg', mixArgs);
      tempFiles.push(mixedAudio);

      logger.info('Creating final video');
      const finalArgs = [
        '-y',
        '-i',
        videoFile,
        '-i',
        mixedAudio,
        '-t',
        String(videoDuration),
        '-vcodec',
        'copy',
        '-acodec',
        'copy',
        '-map',
        '0:v',
        '-map',
        '1:a',
        outputFile
      ];
      await safeExec('ffmpeg', finalArgs);

      logger.info('Export complete', { output: outputFile });

      for (const file of tempFiles) {
        await fileRepo.deleteFile(file);
      }

      return outputFile;
    } catch (error) {
      logger.error('Export failed', { error: error.message });

      for (const file of tempFiles) {
        await fileRepo.deleteFile(file);
      }

      throw error;
    }
  }

  async function exportAudio(outputFile, tracks, libraryDir, duration) {
    const publishedDir = path.dirname(outputFile);
    const tempFiles = [];
    const isWav = outputFile.endsWith('.wav');

    try {
      if (!tracks || tracks.length === 0) {
        throw new Error('No audio tracks to export');
      }

      if (!duration || duration <= 0) {
        throw new Error('Invalid duration for audio export');
      }

      logger.info('Audio export starting', {
        trackCount: tracks.length,
        duration,
        format: isWav ? 'wav' : 'mp3'
      });

      const processTrack = async (elem, index) => {
        const { idTrack, stretchFactor = 1, pitch = 0, startTime = 0, panValue = 0 } = elem;

        assertFiniteNumber(stretchFactor, 'stretchFactor');
        assertFiniteNumber(pitch, 'pitch');
        assertFiniteNumber(startTime, 'startTime');
        assertFiniteNumber(panValue, 'panValue');

        const trimArgs = buildTrimArgs(elem);

        logger.info(`Track ${index} audio export:`, {
          idTrack,
          startTime,
          stretchFactor,
          pitch,
          panValue,
          trimApplied: trimArgs
        });

        const src = path.join(libraryDir, idTrack);
        const outFile = path.join(publishedDir, `out${index}.wav`);
        const outFileZ = path.join(publishedDir, `outZ${index}.wav`);

        const ffmpegArgs = ['-y', ...trimArgs, '-i', src];

        let filterChain = buildVolumeFilter(elem, duration);

        if (startTime > 0) {
          filterChain += ',' + buildDelayFilter(elem);
        }

        if (panValue !== 0) {
          filterChain += ',' + buildPanFilter(elem);
        }

        ffmpegArgs.push('-filter:a', filterChain, outFile);

        logger.info(`Track ${index} ffmpeg args:`, { args: ffmpegArgs });
        await safeExec('ffmpeg', ffmpegArgs);
        tempFiles.push(outFile);

        const stretchArgs = [
          '--ignore-clipping',
          '-t',
          String(stretchFactor),
          '-p',
          String(pitch),
          outFile,
          outFileZ
        ];
        await safeExec('rubberband', stretchArgs);
        tempFiles.push(outFileZ);

        logger.debug(`Track ${index} processed`);
      };

      await Promise.all(tracks.map((elem, index) => processTrack(elem, index)));

      logger.info('Mixing audio tracks');
      const mixArgs = ['-y'];

      for (let i = 0; i < tracks.length; i++) {
        mixArgs.push('-i', path.join(publishedDir, `outZ${i}.wav`));
      }

      mixArgs.push(
        '-t',
        String(duration),
        '-filter_complex',
        `amix=inputs=${tracks.length}:dropout_transition=${duration},volume=${tracks.length}[out]`,
        '-map',
        '[out]'
      );

      if (!isWav) {
        mixArgs.push('-codec:a', 'libmp3lame', '-qscale:a', '2');
      }

      mixArgs.push(outputFile);
      await safeExec('ffmpeg', mixArgs);

      logger.info('Audio export complete', { output: outputFile, format: isWav ? 'wav' : 'mp3' });

      for (const file of tempFiles) {
        await fileRepo.deleteFile(file);
      }

      return outputFile;
    } catch (error) {
      logger.error('Audio export failed', { error: error.message });

      for (const file of tempFiles) {
        await fileRepo.deleteFile(file);
      }

      throw error;
    }
  }

  return { exportVideo, exportAudio };
}

module.exports = { exportRepositoryCreator };
