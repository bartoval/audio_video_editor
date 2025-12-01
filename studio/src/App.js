/**
 * Audio Video Sync Studio
 */
import './style.css';
import Library from './components/audioLibrary';
import Navigator from './components/timeline/Navigator';
import Video from './components/playback/Video';
import Uploader from './components/playback/Uploader';
import Player from './components/playback/Player';
import Toast from './components/core/Toast';
import { Header } from './components/header';
import { StatusBar } from './components/footer';
import { AppLoader } from './components/loader';
import Mediator from './components/Mediator';
import * as Workspace from './services/workspace';
import * as Api from './services/api';
import * as Offline from './services/offline';
import { NAV } from './config/routes';
import { isWasmSupported, setWasmEnabled } from './lib/audio/wasm';

class App {
  async init(workspaceUuid) {
    // Loader is already visible from HTML (instant display)
    Workspace.init(workspaceUuid);

    const root = document.querySelector('.studio');
    const url = Workspace.getVideoSrc();

    new Toast(root);

    // Check WASM support
    if (!isWasmSupported()) {
      console.warn('[App] SharedArrayBuffer not available.');
      console.warn('[App] To enable WASM, serve with headers:');
      console.warn('  Cross-Origin-Opener-Policy: same-origin');
      console.warn('  Cross-Origin-Embedder-Policy: require-corp');
      setWasmEnabled(false);
    } else {
      console.log('[App] WASM support detected');
    }

    // Install components
    const library = new Library(root.querySelector('.studio-library .library'), {
      api: { list: Workspace.getRouteUrl('audio') },
      onAddToTimeline: tracks => Mediator.onAddTracksToTimeline(tracks)
    });
    library.load();

    new Video(root.querySelector('.studio-preview'));
    new Uploader(root.querySelector('.studio-preview'));
    new Player(root.querySelector('.studio-preview'));
    new Navigator(root.querySelector('.studio-timeline'));
    new Header(root.querySelector('.studio-header .container-fluid'));
    new StatusBar(root.querySelector('.studio-footer'));

    // Auto-load saved workspace
    try {
      const response = await Api.load();
      const isEmpty = Object.keys(response).length === 0;

      if (!isEmpty) {
        await Mediator.onLoadVideo(response.video, response);
        console.log('[App] Workspace loaded');
      } else if (url) {
        await Mediator.onLoadVideo(url);
        console.log('[App] Video loaded');
      }
    } catch (err) {
      console.log('[App] No saved workspace:', err);

      if (url) {
        try {
          await Mediator.onLoadVideo(url);
        } catch (loadErr) {
          console.log('[App] Video load error:', loadErr);
        }
      }
    }

    // Hide loader with fade-out animation
    await AppLoader.hide();

    return true;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize offline support (Service Worker, IndexedDB, SyncManager)
  await Offline.init();

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const uuid = pathParts[0] || null;

  try {
    const projects = await Api.getProjects();

    // No UUID in URL → redirect to first project
    if (!uuid) {
      if (projects.length > 0) {
        window.location.href = NAV.workspace(projects[0].uuid);

        return;
      }
    }

    // UUID in URL but doesn't exist → show error
    if (uuid && !projects.find(p => p.uuid === uuid)) {
      AppLoader.hide();
      document.querySelector('.studio').innerHTML = `
        <div class="d-flex flex-column align-items-center justify-content-center h-100">
          <h1 class="text-muted mb-3">Workspace not found</h1>
          <p class="text-muted mb-4">The workspace "${uuid}" does not exist.</p>
          <a href="${NAV.home}" class="btn btn-primary">Go to Home</a>
        </div>
      `;

      return;
    }
  } catch (err) {
    console.error('Error fetching projects:', err);
  }

  new App().init(uuid || '0');
});

export default App;
