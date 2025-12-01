import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  server: {
    port: 8081,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/video': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/metaInfoAudioList': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/deleteAudio': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/libraryTrack': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/upload': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/isVideoConverted': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/convertVideo': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/uploadAudio': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/libraryAudio': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      'Config': path.resolve(__dirname, 'src/config/Config.js'),
      'Mediator': path.resolve(__dirname, 'src/components/Mediator.js'),
      'Component': path.resolve(__dirname, 'src/lib/Component.js'),
      'utils/format': path.resolve(__dirname, 'src/lib/utils/format.js'),
      'utils/time': path.resolve(__dirname, 'src/lib/utils/time.js'),
      'utils/dom': path.resolve(__dirname, 'src/lib/utils/dom.js'),
      'utils/animation': path.resolve(__dirname, 'src/lib/utils/animation.js'),
      'core/VirtualScroll': path.resolve(__dirname, 'src/lib/core/VirtualScroll.js'),
      'Project/Main': path.resolve(__dirname, 'src/lib/Project/Main.js'),
      'Audio/Ctx': path.resolve(__dirname, 'src/lib/Audio/Ctx.js'),
      'Audio/Audio': path.resolve(__dirname, 'src/lib/Audio/Audio.js'),
      'Audio/Oscilloscope': path.resolve(__dirname, 'src/lib/Audio/Oscilloscope.js'),
      'Audio/nodes/Buffer': path.resolve(__dirname, 'src/lib/Audio/nodes/Buffer.js'),
      'Audio/nodes/Pan': path.resolve(__dirname, 'src/lib/Audio/nodes/Pan.js'),
      'Audio/nodes/Volume': path.resolve(__dirname, 'src/lib/Audio/nodes/Volume.js'),
      'loader/Loader': path.resolve(__dirname, 'src/components/loader/Loader.js'),
      'timePopup/TimePopup': path.resolve(__dirname, 'src/components/timePopup/TimePopup.js'),
      'Zones/Zone': path.resolve(__dirname, 'src/lib/Zones/Zone.js'),
      'Zones/Container': path.resolve(__dirname, 'src/lib/Zones/Container.js'),
      'Libraries/Composite': path.resolve(__dirname, 'src/lib/Libraries/Composite.js'),
      'signals': path.resolve(__dirname, 'src/lib/Signal.js'),
      'MasterClock': path.resolve(__dirname, 'src/lib/MasterClock.js'),
      'mvp': path.resolve(__dirname, 'src/lib/mvp/index.js'),
      'mvp/Model': path.resolve(__dirname, 'src/lib/mvp/Model.js'),
      'mvp/View': path.resolve(__dirname, 'src/lib/mvp/View.js'),
      'mvp/Presenter': path.resolve(__dirname, 'src/lib/mvp/Presenter.js')
    }
  },
  base: '/studio/',
  build: {
    outDir: '../public/studio',
    emptyOutDir: true
  }
});
