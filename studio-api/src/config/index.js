const fs = require('fs');
const path = require('path');

// ROOT_PATH is studio-api folder in dev, /app in Docker
const ROOT_PATH = process.env.ROOT_PATH || path.resolve(__dirname, '../..');
const DATA_DIR = process.env.DATA_DIR || 'projects';
const TMP_CHUNKS_DIR = process.env.TMP_CHUNKS_DIR || '.tmp_chunks';
// PUBLIC_PATH: in dev it's ../public (root), in Docker it's ./public (copied there)
const PUBLIC_PATH = process.env.PUBLIC_PATH || path.resolve(ROOT_PATH, '../public');

// Ensure required directories exist on startup
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
  env: process.env.NODE_ENV || 'development',

  // Paths
  rootPath: ROOT_PATH,
  projectsPath: path.join(ROOT_PATH, DATA_DIR, '0'),
  tmpChunksPath: path.join(ROOT_PATH, TMP_CHUNKS_DIR),
  publicPath: PUBLIC_PATH,

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
    signedUrlExpiration: 300
  },

  // Thumbnail tiles configuration
  thumbTiles: {
    enabled: true, // Feature flag: true = tiles mode, false = legacy sprite
    cols: 10, // Thumbnails per row in tile
    rows: 10, // Rows per tile (total = cols × rows = 100 thumbs per tile)
    height: 80 // Thumbnail height (width auto-calculated from video ratio)
  },

  // Project structure - relative paths within project folder
  paths: {
    // Directories
    dirs: {
      resources: 'resources',
      videoTracks: 'resources/videoTracks',
      audioTracks: 'resources/audioTracks',
      library: 'library',
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

    // Thumbnail scales configuration
    thumbScales: [
      { fps: 2, scale: '0.01' },
      { fps: 1, scale: '0.02' },
      { fps: 0.4, scale: '0.05' },
      { fps: 0.2, scale: '0.1' }
    ]
  }
};
