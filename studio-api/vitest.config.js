const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    root: '.',
    include: ['src/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: [
        'src/**/*.test.js',
        'src/**/index.js',
        'src/handlers/**',
        'src/routes/**',
        'src/storage/**',
        'src/config/providers/oracle.js',
        'src/config/auth.js',
        'src/services/editorService.js',
        'src/services/eventService.js',
        'src/services/streamService.js',
        'src/services/videoConversionService.js',
        'src/services/mediaWorkerService.js',
        'src/services/aiMusicService.js',
        'src/repositories/chunkRepository.js',
        'src/repositories/fileRepository.js',
        'src/repositories/projectRepository.js',
        'src/repositories/probeRepository.js',
        'src/repositories/thumbnailRepository.js',
        'src/middleware/cors.js',
        'src/middleware/upload.js'
      ]
    }
  }
});
