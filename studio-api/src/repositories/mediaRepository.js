const path = require('path');
const { exec } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const { createLogger } = require('../utils/logger');
const { fileRepositoryCreator } = require('./fileRepository');
const config = require('../config');

const logger = createLogger('MediaRepository');

// Destructure path constants
const { ext, thumbScales, fileNames, subDirs } = config.paths;
const { thumbTiles } = config;

function mediaRepositoryCreator() {
  const fileRepo = fileRepositoryCreator(config.projectsPath);

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

  // ============================================================================
  // Thumbnail Generation - Legacy (single sprite strip)
  // ============================================================================

  function generateThumbStrip(inputFile, outputFile, fps, tiles, thumbHeight) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputFile)
        .outputOptions([
          `-vf fps=${fps},scale=-1:${thumbHeight},tile=${tiles}x1`,
          `-quality ${config.ffmpeg.webpQuality}`
        ])
        .output(outputFile)
        .on('start', cmd => {
          logger.debug('Thumb generation started', { output: path.basename(outputFile) });
        })
        .on('error', err => {
          logger.warn('Thumb generation failed', {
            output: path.basename(outputFile),
            error: err.message
          });
          reject(err);
        })
        .on('end', () => {
          logger.debug('Thumb generated', { output: path.basename(outputFile) });
          resolve(outputFile);
        })
        .run();
    });
  }

  async function generateThumbsLegacy(inputFile, outputDir, duration) {
    const { thumbHeight } = config.ffmpeg;

    const promises = thumbScales.map(({ fps, scale }) => {
      const tiles = Math.ceil(duration * fps);
      const outputFile = path.join(outputDir, `${scale}${ext.thumb}`);

      return generateThumbStrip(inputFile, outputFile, fps, tiles, thumbHeight);
    });

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    const failed = results.filter(r => r.status === 'rejected').length;

    if (failed > 0) {
      logger.warn('Some thumbnails failed to generate', { failed, total: thumbScales.length });
    }

    return successful;
  }

  // ============================================================================
  // Thumbnail Generation - Tiles (Netflix-style grid sprites)
  // ============================================================================

  /**
   * Generate a single tile sprite with grid layout (cols × rows)
   * The tile filter creates a single output image grid from the input frames.
   */
  function generateThumbTile(
    inputFile,
    outputFile,
    fps,
    startTime,
    durationSecs,
    cols,
    rows,
    thumbHeight
  ) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputFile)
        .seekInput(startTime)
        .duration(durationSecs)
        .outputOptions([
          `-vf fps=${fps},scale=-1:${thumbHeight},tile=${cols}x${rows}`,
          `-frames:v 1`,
          `-quality ${config.ffmpeg.webpQuality}`
        ])
        .output(outputFile)
        .on('error', err => {
          logger.warn('Tile generation failed', {
            output: path.basename(outputFile),
            error: err.message
          });
          reject(err);
        })
        .on('end', () => {
          logger.debug('Tile generated', { output: path.basename(outputFile) });
          resolve(outputFile);
        })
        .run();
    });
  }

  /**
   * Generate tiles for a specific scale and create manifest
   */
  async function generateTilesForScale(
    inputFile,
    scaleDir,
    fps,
    scale,
    duration,
    videoWidth,
    videoHeight
  ) {
    const { cols, rows, height: thumbHeight } = thumbTiles;
    const thumbsPerTile = cols * rows;
    const totalThumbs = Math.ceil(duration * fps);
    const numTiles = Math.ceil(totalThumbs / thumbsPerTile);
    const interval = 1 / fps;

    // Calculate thumb dimensions preserving aspect ratio
    const aspectRatio = videoWidth / videoHeight;
    const thumbWidth = Math.round(thumbHeight * aspectRatio);

    // Duration covered by each tile
    const tileDuration = thumbsPerTile * interval;

    fileRepo.ensureDir(scaleDir);

    const tiles = [];
    const promises = [];

    for (let i = 0; i < numTiles; i++) {
      const startTime = i * tileDuration;
      const remainingDuration = duration - startTime;
      const tileDurationActual = Math.min(tileDuration, remainingDuration);
      const tileFile = `tile_${i}${ext.thumb}`;
      const outputFile = path.join(scaleDir, tileFile);

      tiles.push(tileFile);

      promises.push(
        generateThumbTile(
          inputFile,
          outputFile,
          fps,
          startTime,
          tileDurationActual,
          cols,
          rows,
          thumbHeight
        )
      );
    }

    await Promise.allSettled(promises);

    // Create manifest for this scale
    const manifest = {
      scale,
      fps,
      interval,
      duration,
      totalThumbs,
      thumbWidth,
      thumbHeight,
      cols,
      rows,
      thumbsPerTile,
      tiles
    };

    const manifestFile = path.join(scaleDir, 'manifest.json');
    fileRepo.writeJson(manifestFile, manifest);

    logger.info('Tiles generated for scale', { scale, numTiles, thumbWidth, thumbHeight });

    return manifest;
  }

  async function generateThumbsTiles(inputFile, outputDir, duration, videoWidth, videoHeight) {
    const scales = {};
    let thumbWidth = 0;
    let thumbHeight = 0;

    for (const { fps, scale } of thumbScales) {
      const scaleDir = path.join(outputDir, scale);

      try {
        const scaleManifest = await generateTilesForScale(
          inputFile,
          scaleDir,
          fps,
          scale,
          duration,
          videoWidth,
          videoHeight
        );

        scales[scale] = scaleManifest;

        // Store thumb dimensions (same for all scales)
        if (!thumbWidth) {
          thumbWidth = scaleManifest.thumbWidth;
          thumbHeight = scaleManifest.thumbHeight;
        }
      } catch (err) {
        logger.error('Failed to generate tiles for scale', { scale, error: err.message });
      }
    }

    // Write master manifest
    const masterManifest = {
      mode: 'tiles',
      thumbWidth,
      thumbHeight,
      scales
    };

    const masterFile = path.join(outputDir, 'manifest.json');
    fileRepo.writeJson(masterFile, masterManifest);

    return masterManifest;
  }

  // ============================================================================
  // Thumbnail Generation - Main Entry Point
  // ============================================================================

  async function generateThumbs(
    inputFile,
    outputDir,
    duration,
    videoWidth = 1920,
    videoHeight = 1080
  ) {
    if (!duration || duration <= 0) {
      logger.warn('Invalid duration for thumb generation', { duration });

      return [];
    }

    fileRepo.ensureDir(outputDir);

    if (thumbTiles.enabled) {
      logger.info('Generating tiles mode thumbnails', { duration, videoWidth, videoHeight });

      return generateThumbsTiles(inputFile, outputDir, duration, videoWidth, videoHeight);
    }

    logger.info('Generating legacy mode thumbnails', { duration });

    return generateThumbsLegacy(inputFile, outputDir, duration);
  }

  function convertVideo(inputFile, outputDir, hasAudio) {
    return new Promise((resolve, reject) => {
      const videoTracksDir = path.join(outputDir, subDirs.videoTracks);
      const audioTracksDir = path.join(outputDir, subDirs.audioTracks);
      const originalOutput = path.join(videoTracksDir, fileNames.videoOriginal);
      const smallOutput = path.join(videoTracksDir, fileNames.videoSmall);
      const { smallVideoHeight } = config.ffmpeg;

      logger.info('convertVideo called', { inputFile, outputDir, hasAudio });

      fileRepo.ensureDir(videoTracksDir);
      fileRepo.ensureDir(audioTracksDir);

      let cmd = ffmpeg(inputFile)
        .output(originalOutput)
        .videoCodec('copy')
        .noAudio()
        .output(smallOutput)
        .videoCodec('libx264')
        .outputOptions([
          '-preset veryfast',    // Much faster encoding (ultrafast/superfast/veryfast/faster/fast)
          '-crf 28',             // Quality (18-28 is good, higher = smaller/faster)
          '-threads 0',          // Use all CPU cores
          '-movflags +faststart' // Web optimization
        ])
        .noAudio()
        .size(`?x${smallVideoHeight}`);

      if (hasAudio) {
        const audioWav = path.join(audioTracksDir, fileNames.audioWav);
        const audioMp3 = path.join(audioTracksDir, fileNames.audioMp3);

        cmd = cmd.output(audioWav).output(audioMp3);
      }

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

  function stretchAudio(inputFile, outputFile, ratio, pitchValue = 0, startTime = 0, duration = 0) {
    return new Promise(async (resolve, reject) => {
      try {
        const tempDir = path.dirname(outputFile);
        const tempWav = path.join(tempDir, `temp_${Date.now()}.wav`);
        const tempStretched = path.join(tempDir, `temp_stretched_${Date.now()}.wav`);

        // Step 1: Trim audio with ffmpeg (if startTime/duration provided)
        let trimCmd;

        if (startTime > 0 || duration > 0) {
          trimCmd = `ffmpeg -y -i "${inputFile}" -ss ${startTime} -t ${duration} "${tempWav}"`;
        } else {
          // No trim, just copy to WAV
          trimCmd = `ffmpeg -y -i "${inputFile}" "${tempWav}"`;
        }

        logger.info('Step 1 - Trim/convert:', { cmd: trimCmd.substring(0, 100) });
        await execCommand(trimCmd);

        // Step 2: Apply rubberband stretch/pitch
        const stretchCmd = `rubberband --ignore-clipping -t ${ratio} -p ${pitchValue} "${tempWav}" "${tempStretched}"`;
        logger.info('Step 2 - Rubberband:', { ratio, pitchValue });
        await execCommand(stretchCmd);

        // Step 3: Convert to MP3 for smaller file size
        const mp3Cmd = `ffmpeg -y -i "${tempStretched}" -codec:a libmp3lame -qscale:a 3 "${outputFile}"`;
        logger.info('Step 3 - Convert to MP3');
        await execCommand(mp3Cmd);

        // Cleanup temp files
        fileRepo.deleteFile(tempWav);
        fileRepo.deleteFile(tempStretched);

        logger.info('Audio stretch complete', { ratio, pitchValue, startTime, duration });
        resolve(outputFile);
      } catch (err) {
        logger.error('Stretch error', { error: err.message });
        reject(err);
      }
    });
  }

  // ============================================================================
  // Export Helpers
  // ============================================================================

  /**
   * Execute shell command as promise
   */
  function execCommand(cmd) {
    return new Promise((resolve, reject) => {
      logger.debug('Executing command', { cmd: cmd.substring(0, 150) });
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          logger.error('Command failed', { error: error.message });
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  /**
   * Build volume filter string from volumeValues
   * Returns string with surrounding quotes like: "volume=...,volume=..."
   *
   * Volume timestamps in volumeValues are relative to the track's visual position
   * (from 0 to durationTime). They are applied directly to the trimmed audio output.
   */
  function buildVolumeFilter(elem, duration) {
    const { volumeValues = [] } = elem;

    if (volumeValues.length === 0) {
      return 'volume=0.5';
    }

    const segments = [];

    for (let j = 0; j < volumeValues.length; j++) {
      const curve = volumeValues[j];
      const { times, values } = curve.data;
      const numTimes = times.length;
      const firstTime = times[0];
      const lastTime = times[numTimes - 1];
      const lastValue = values[numTimes - 1];

      // Add initial volume if first curve doesn't start at 0
      if (j === 0 && firstTime > 0) {
        segments.push(`volume=0.5:eval=frame:enable='between(t,0,${firstTime})'`);
      }

      // Add volume segments for each point pair
      for (let i = 0; i < numTimes - 1; i++) {
        const t1 = times[i].toFixed(5);
        const t2 = times[i + 1].toFixed(5);
        const value = values[i].toFixed(5);

        // Skip zero-duration segments
        if (t1 === t2) {
          continue;
        }

        segments.push(`volume=${value}:eval=frame:enable='between(t,${t1},${t2})'`);
      }

      // Add final segment from last point to next curve start (or duration)
      const nextCurveStart =
        j < volumeValues.length - 1 ? volumeValues[j + 1].data.times[0] : duration;

      if (lastTime < nextCurveStart) {
        segments.push(
          `volume=${lastValue}:eval=frame:enable='between(t,${lastTime},${nextCurveStart})'`
        );
      }
    }

    if (segments.length === 0) {
      return 'volume=0.5';
    }

    return '"' + segments.join(',') + '"';
  }

  /**
   * Build delay filter string
   * Returns: adelay="startTime|startTime"
   */
  function buildDelayFilter(elem) {
    const startTime = elem.startTime * (1 / elem.stretchFactor) * 1000;

    return `adelay="${startTime}|${startTime}"`;
  }

  /**
   * Build pan filter string
   * Returns: pan="stereo|FL<c0|FR<c1"
   */
  function buildPanFilter(elem) {
    const { panValue } = elem;
    const gain = 1 - Math.abs(panValue);
    const c0 = panValue > 0 ? gain + '*c0' : 'c0';
    const c1 = panValue < 0 ? gain + '*c1' : 'c1';

    return `pan="stereo|FL<${c0}|FR<${c1}"`;
  }

  /**
   * Build trim arguments for ffmpeg
   * Uses durationTimeCut as fallback if durationTimeBuffer is invalid
   */
  function buildTrimArgs(elem) {
    const { isCut, startTimeBuffer = 0, durationTimeBuffer, durationTimeCut } = elem;

    if (isCut !== true) {
      return '';
    }

    // Use durationTimeBuffer if valid, otherwise fall back to durationTimeCut
    const duration = durationTimeBuffer > 0 ? durationTimeBuffer : durationTimeCut;

    if (duration > 0) {
      return `-ss ${startTimeBuffer} -t ${duration} `;
    }

    return '';
  }

  // ============================================================================
  // Export Video
  // ============================================================================

  /**
   * Export video with mixed audio tracks (high quality WAV pipeline)
   * @param {string} videoFile - Path to source video (without audio)
   * @param {string} outputFile - Path for output video
   * @param {Array} tracks - Array of track configs with timing info
   * @param {string} libraryDir - Path to audio library directory
   * @param {string} originalAudioFile - Path to original video's audio WAV (for idTrack === -1)
   * @param {number} videoDuration - Video duration in seconds
   */
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
        // No audio tracks - just copy video without audio
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

      // Step 1: Process each track (decode -> apply filters -> rubberband stretch)
      const processTrack = async (elem, index) => {
        const { idTrack, stretchFactor = 1, pitch = 0, startTime = 0, panValue = 0 } = elem;
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

        // Source file: WAV for original audio, library file for others
        const src = idTrack === -1 ? originalAudioFile : path.join(libraryDir, idTrack);

        const outFile = path.join(publishedDir, `out${index}.wav`);
        const outFileZ = path.join(publishedDir, `outZ${index}.wav`);

        // Build ffmpeg command - matching original structure exactly
        let cmd = 'ffmpeg -y ';
        cmd += buildTrimArgs(elem);
        cmd += `-i "${src}" `;
        cmd += '-filter:a ';
        cmd += buildVolumeFilter(elem, videoDuration);

        if (startTime > 0) {
          cmd += ',' + buildDelayFilter(elem);
        }

        if (panValue !== 0) {
          cmd += ',' + buildPanFilter(elem);
        }

        cmd += ` "${outFile}"`;

        logger.info(`Track ${index} ffmpeg cmd:`, cmd);
        await execCommand(cmd);
        tempFiles.push(outFile);

        // Apply rubberband stretch/pitch
        const stretchCmd = `rubberband --ignore-clipping -t ${stretchFactor} -p ${pitch} "${outFile}" "${outFileZ}"`;
        await execCommand(stretchCmd);
        tempFiles.push(outFileZ);

        logger.debug(`Track ${index} processed`);
      };

      // Process all tracks in parallel
      await Promise.all(tracks.map((elem, index) => processTrack(elem, index)));

      // Step 2: Mix all processed WAV tracks
      logger.info('Mixing audio tracks');
      const mixedAudio = path.join(publishedDir, 'out.mp3');
      let mixCmd = 'ffmpeg -y';

      for (let i = 0; i < tracks.length; i++) {
        mixCmd += ` -i "${path.join(publishedDir, `outZ${i}.wav`)}"`;
      }

      mixCmd += ` -t ${videoDuration} -filter_complex "amix=inputs=${tracks.length}:dropout_transition=${videoDuration},volume=${tracks.length}[out]" -map "[out]" "${mixedAudio}"`;
      await execCommand(mixCmd);
      tempFiles.push(mixedAudio);

      // Step 3: Combine video with mixed audio (copy both streams for quality)
      logger.info('Creating final video');
      const finalCmd = `ffmpeg -y -i "${videoFile}" -i "${mixedAudio}" -t ${videoDuration} -vcodec copy -acodec copy -map 0:v -map 1:a "${outputFile}"`;
      await execCommand(finalCmd);

      logger.info('Export complete', { output: outputFile });

      // Cleanup temp files
      for (const file of tempFiles) {
        fileRepo.deleteFile(file);
      }

      return outputFile;
    } catch (error) {
      logger.error('Export failed', { error: error.message });

      // Cleanup on error
      for (const file of tempFiles) {
        fileRepo.deleteFile(file);
      }

      throw error;
    }
  }

  /**
   * Extract a single frame from video at specified time
   */
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

  async function getVideoDuration(filePath) {
    const probe = await probeMedia(filePath);

    return probe.format.duration || 0;
  }

  return {
    probeMedia,
    getVideoDuration,
    generateThumbs,
    convertVideo,
    stretchAudio,
    exportVideo,
    extractFrame
  };
}

module.exports = { mediaRepositoryCreator };
