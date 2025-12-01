const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { createLogger } = require('../utils/logger');
const { fileRepositoryCreator } = require('./fileRepository');
const config = require('../config');

const logger = createLogger('ThumbnailRepository');

const { ext, thumbScales } = config.paths;
const { thumbTiles } = config;

function thumbnailRepositoryCreator(deps = {}) {
  const fileRepo = deps.fileRepo || fileRepositoryCreator(config.projectsPath);

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
      if (durationSecs <= 0) {
        return resolve(null);
      }

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

  async function generateTilesForScale(
    inputFile,
    scaleDir,
    fps,
    scale,
    duration,
    videoWidth,
    videoHeight,
    onTileComplete = null
  ) {
    const { cols, rows, height: thumbHeight } = thumbTiles;
    const thumbsPerTile = cols * rows;
    const totalThumbs = Math.ceil(duration * fps);
    const numTiles = Math.ceil(totalThumbs / thumbsPerTile);
    const interval = 1 / fps;

    const aspectRatio = videoWidth / videoHeight;
    const thumbWidth = Math.round(thumbHeight * aspectRatio);

    const tileDuration = thumbsPerTile * interval;

    await fileRepo.ensureDir(scaleDir);

    const tiles = [];

    for (let i = 0; i < numTiles; i++) {
      const startTime = i * tileDuration;
      const remainingDuration = duration - startTime;
      const tileDurationActual = Math.min(tileDuration, remainingDuration);
      const tileFile = `tile_${i}${ext.thumb}`;
      const outputFile = path.join(scaleDir, tileFile);

      tiles.push(tileFile);

      try {
        await generateThumbTile(
          inputFile,
          outputFile,
          fps,
          startTime,
          tileDurationActual,
          cols,
          rows,
          thumbHeight
        );

        if (onTileComplete) {
          onTileComplete(scale, i, numTiles, tileFile);
        }
      } catch (err) {
        logger.warn('Tile generation failed, continuing', { scale, tile: i, error: err.message });
      }
    }

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
    await fileRepo.writeJson(manifestFile, manifest);

    logger.info('Tiles generated for scale', { scale, numTiles, thumbWidth, thumbHeight });

    return manifest;
  }

  async function generateThumbsTiles(
    inputFile,
    outputDir,
    duration,
    videoWidth,
    videoHeight,
    callbacks = {}
  ) {
    const { onProgress, onScaleComplete, priorityScale } = callbacks;
    const scales = {};
    let thumbWidth = 0;
    let thumbHeight = 0;

    const orderedScales = [...thumbScales];

    if (priorityScale) {
      const priorityIndex = orderedScales.findIndex(s => s.scale === priorityScale);

      if (priorityIndex > 0) {
        const [priority] = orderedScales.splice(priorityIndex, 1);
        orderedScales.unshift(priority);
        logger.info('Prioritizing scale', { priorityScale });
      }
    }

    const { cols, rows } = thumbTiles;
    const thumbsPerTile = cols * rows;

    logger.info('Thumbnail generation starting', { priorityScale });

    for (const { fps, scale } of orderedScales) {
      const totalThumbs = Math.ceil(duration * fps);
      const totalTilesForScale = Math.ceil(totalThumbs / thumbsPerTile);

      let completedTilesForScale = 0;
      let lastPercentSent = -1;

      if (onProgress) {
        onProgress({ percent: 0, scale, isChunkReady: false });
      }

      const onTileComplete = onProgress
        ? () => {
            completedTilesForScale++;
            const percent = Math.round((completedTilesForScale / totalTilesForScale) * 100);

            if (percent === lastPercentSent) {
              return;
            }

            lastPercentSent = percent;
            onProgress({ percent, scale, isChunkReady: true });
          }
        : null;
      const scaleDir = path.join(outputDir, scale);

      try {
        const manifest = await generateTilesForScale(
          inputFile,
          scaleDir,
          fps,
          scale,
          duration,
          videoWidth,
          videoHeight,
          onTileComplete
        );

        scales[scale] = manifest;

        if (!thumbWidth) {
          thumbWidth = manifest.thumbWidth;
          thumbHeight = manifest.thumbHeight;
        }

        const intermediateManifest = {
          mode: 'tiles',
          thumbWidth,
          thumbHeight,
          scales,
          scalesReady: Object.keys(scales)
        };

        const masterFile = path.join(outputDir, 'manifest.json');
        await fileRepo.writeJson(masterFile, intermediateManifest);

        if (onScaleComplete) {
          onScaleComplete(scale);
        }

        logger.info('Scale complete', { scale });
      } catch (err) {
        logger.error('Failed to generate tiles for scale', { scale, error: err.message });
      }
    }

    return {
      mode: 'tiles',
      thumbWidth,
      thumbHeight,
      scales,
      scalesReady: Object.keys(scales)
    };
  }

  async function generateThumbs(
    inputFile,
    outputDir,
    duration,
    videoWidth = 1920,
    videoHeight = 1080,
    callbacks = {}
  ) {
    if (!duration || duration <= 0) {
      logger.warn('Invalid duration for thumb generation', { duration });

      return [];
    }

    await fileRepo.ensureDir(outputDir);
    logger.info('Generating thumbnails', {
      duration,
      videoWidth,
      videoHeight,
      priorityScale: callbacks.priorityScale
    });

    return generateThumbsTiles(inputFile, outputDir, duration, videoWidth, videoHeight, callbacks);
  }

  return { generateThumbs };
}

module.exports = { thumbnailRepositoryCreator };
