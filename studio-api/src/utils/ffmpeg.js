const fs = require('fs');
const { createLogger } = require('./logger');
const config = require('../config');

const logger = createLogger('FFmpegUtils');

// ============================================================================
// Encoder Configuration
// ============================================================================

/**
 * Get encoder configuration based on hardware availability
 * Validates hwEncoder against available presets and falls back to CPU if invalid
 * @returns {{ codec: string, options: string[] }}
 */
function getEncoderConfig() {
  const { hwEncoder, presets } = config.ffmpeg;

  // Validate hwEncoder and fallback to CPU if invalid
  if (hwEncoder && hwEncoder !== 'h264_nvenc') {
    logger.warn('Invalid hwEncoder configuration, falling back to CPU', {
      configured: hwEncoder,
      valid: ['h264_nvenc', null]
    });
    return {
      codec: 'libx264',
      options: [`-preset ${presets.cpu.preset}`, `-crf ${presets.cpu.crf}`, '-movflags +faststart']
    };
  }

  if (hwEncoder === 'h264_nvenc') {
    logger.info('Using NVIDIA GPU encoder', { preset: presets.nvenc.preset, cq: presets.nvenc.cq });
    return {
      codec: 'h264_nvenc',
      options: [
        `-preset ${presets.nvenc.preset}`,
        `-cq ${presets.nvenc.cq}`,
        '-rc vbr',
        '-movflags +faststart'
      ]
    };
  }

  logger.info('Using CPU encoder', { preset: presets.cpu.preset, crf: presets.cpu.crf });
  return {
    codec: 'libx264',
    options: [`-preset ${presets.cpu.preset}`, `-crf ${presets.cpu.crf}`, '-movflags +faststart']
  };
}

// ============================================================================
// FFmpeg Promise Wrapper
// ============================================================================

/**
 * Run FFmpeg command as a promise
 * @param {object} command - fluent-ffmpeg command
 * @returns {Promise<void>}
 */
function runFfmpeg(command) {
  return new Promise((resolve, reject) => {
    command
      .on('start', cmd => logger.debug('FFmpeg started', { command: cmd.substring(0, 100) }))
      .on('progress', progress => logger.debug('FFmpeg progress', { percent: progress.percent }))
      .on('error', err => reject(err))
      .on('end', () => resolve())
      .run();
  });
}

// ============================================================================
// Video Analysis
// ============================================================================

/**
 * Calculate display aspect ratio from dimensions
 * @param {number} width
 * @param {number} height
 * @returns {string|null}
 */
function calculateAspectRatio(width, height) {
  if (!width || !height) {
    return null;
  }

  const ratio = width / height;

  if (Math.abs(ratio - 16 / 9) < 0.1) {
    return '16:9';
  }

  if (Math.abs(ratio - 4 / 3) < 0.1) {
    return '4:3';
  }

  if (Math.abs(ratio - 21 / 9) < 0.1) {
    return '21:9';
  }

  return `${width}:${height}`;
}

/**
 * Check if video codec is web-compatible (can be played in browsers)
 * @param {string} codecName
 * @returns {boolean}
 */
function isWebCompatibleCodec(codecName) {
  const webCodecs = ['h264', 'avc1', 'vp8', 'vp9', 'av1'];

  return webCodecs.some(c => codecName?.toLowerCase().includes(c));
}

/**
 * Check if MP4 has moov atom at the beginning (faststart ready)
 * Reads first 1MB to check for 'moov' before 'mdat'
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function hasFaststart(filePath) {
  return new Promise(resolve => {
    const stream = fs.createReadStream(filePath, { start: 0, end: 1024 * 1024 });
    let buffer = Buffer.alloc(0);

    stream.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);

      // Look for 'moov' atom in first 1MB
      const moovIndex = buffer.indexOf('moov');
      const mdatIndex = buffer.indexOf('mdat');

      if (moovIndex !== -1 && mdatIndex !== -1) {
        stream.destroy();
        // If moov comes before mdat, it's faststart ready
        resolve(moovIndex < mdatIndex);
      }
    });

    stream.on('end', () => {
      // If we didn't find both, assume not faststart
      resolve(false);
    });

    stream.on('error', () => resolve(false));
  });
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  getEncoderConfig,
  runFfmpeg,
  calculateAspectRatio,
  isWebCompatibleCodec,
  hasFaststart
};
