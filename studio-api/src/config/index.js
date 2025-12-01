const fs = require('fs');
const path = require('path');
const storageProvider = require('./providers');

// ============================================================================
// Environment
// ============================================================================
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================================================
// Local Paths (always needed for temp files, processing, etc.)
// ============================================================================
const ROOT_PATH = process.env.ROOT_PATH || path.resolve(__dirname, '../..');
const DATA_DIR = process.env.DATA_DIR || 'projects';
const TMP_CHUNKS_DIR = process.env.TMP_CHUNKS_DIR || '.tmp_chunks';

// Ensure required directories exist on startup
// NOTE: The '0' suffix is a legacy path convention maintained for backward compatibility
// with existing deployments. All projects are stored under: <ROOT_PATH>/<DATA_DIR>/0/<uuid>
// This allows future migration strategies without breaking existing data.
const projectsPath = path.join(ROOT_PATH, DATA_DIR, '0');
const tmpChunksPath = path.join(ROOT_PATH, TMP_CHUNKS_DIR);

[projectsPath, tmpChunksPath].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

module.exports = {
  // Server
  port: process.env.PORT || 8080,
  env: NODE_ENV,

  // Storage Provider (multi-cloud support)
  // Set STORAGE_PROVIDER env var: local, oracle, aws, gcp, hetzner
  storage: {
    provider: storageProvider.current,
    config: storageProvider.config,
    available: storageProvider.available
  },

  // Local Paths (for temp files, processing, etc.)
  rootPath: ROOT_PATH,
  projectsPath,
  tmpChunksPath,

  // Upload limits
  upload: {
    maxFileSize: 500 * 1024 * 1024, // 500MB
    allowedVideoTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
    allowedAudioTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac']
  },

  // FFmpeg
  ffmpeg: {
    thumbHeight: 80,
    smallVideoHeight: 155,
    webpQuality: 80,
    signedUrlExpiration: 300,
    hwEncoder: process.env.HW_ENCODER || null, // 'h264_nvenc' for NVIDIA GPU, null for CPU
    presets: {
      cpu: {
        preset: 'medium', // FFmpeg CPU preset: ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow
        crf: 23 // Constant Rate Factor: 0 (lossless) to 51 (worst). 23 is default, 18 is visually lossless
      },
      nvenc: {
        preset: 'p4', // NVENC preset: p1 (fastest) to p7 (highest quality)
        cq: 23 // Constant Quality: 0 (best) to 51 (worst). Similar to CRF
      }
    }
  },

  // Thumbnail tiles configuration
  thumbTiles: {
    cols: 10,
    rows: 10,
    height: 80
  },

  // Default zoom scale (used for priority thumbnail generation)
  defaultScale: '0.1',

  // AI Music (Mureka)
  aiMusic: {
    defaultModel: 'V8',
    models: [
      { id: 'V8', name: 'V8' },
      { id: 'V7.6', name: 'V7.6' },
      { id: 'O2', name: 'O2' }
    ]
  },

  // Media ML Worker (transcription, stem separation)
  mediaWorker: {
    url: process.env.MEDIA_WORKER_URL || 'http://localhost:8001',
    timeout: Number(process.env.MEDIA_WORKER_TIMEOUT) || 60000,
    sharedMediaPath: process.env.SHARED_MEDIA_PATH || '/media',
    callbackBaseUrl: process.env.INTERNAL_API_URL || 'http://localhost:8080'
  },

  // Project structure - relative paths within project folder
  paths: {
    // Directories
    dirs: {
      resources: 'resources',
      videoTracks: 'resources/videoTracks',
      audioTracks: 'resources/audioTracks',
      library: 'library',
      derived: path.join('library', 'derived'),
      thumbs: 'thumbs',
      saved: 'saved',
      published: 'published'
    },

    // Files - full relative paths from project root
    files: {
      projects: 'projects.json',
      original: 'originalWithAudio.mp4',
      video: 'video.mp4', // Mute video for streaming/export
      info: 'info.json',
      trackList: 'trackList.json',
      backup: 'saved/backup.json',
      videoOriginal: 'resources/videoTracks/original.mp4',
      videoSmall: 'resources/videoTracks/small.mp4',
      audioWav: 'resources/audioTracks/audio.wav',
      audioMp3: 'resources/audioTracks/audio.mp3',
      publishedVideo: 'published/out.mp4',
      publishedAudioMp3: 'published/out.mp3',
      publishedAudioWav: 'published/out.wav',
      coverThumb: '0.02.webp'
    },

    // File names only (for building paths dynamically)
    fileNames: {
      videoOriginal: 'original.mp4',
      videoSmall: 'small.mp4',
      audioWav: 'audio.wav',
      audioMp3: 'audio.mp3'
    },

    // Subdirectory names (for building paths within resources/)
    subDirs: {
      videoTracks: 'videoTracks',
      audioTracks: 'audioTracks'
    },

    // Extensions
    ext: {
      thumb: '.webp'
    },

    // Thumbnail scales configuration (1:1 with zoom scales)
    thumbScales: [
      { fps: 2, scale: '0.01' },
      { fps: 1, scale: '0.02' },
      { fps: 0.4, scale: '0.05' },
      { fps: 0.2, scale: '0.1' },
      { fps: 0.1, scale: '0.2' },
      { fps: 0.04, scale: '0.5' },
      { fps: 0.02, scale: '1' },
      { fps: 0.01, scale: '2' }
    ]
  }
};
