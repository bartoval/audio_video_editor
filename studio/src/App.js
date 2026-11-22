/**
 * Audio Video Sync Studio
 */
import './styles/index.css';
import Library from './components/audioLibrary';
import Navigator from './components/timeline/Navigator';
import Video from './components/playback/video';
import Player from './components/playback/PlayerPresenter';
import Toast from './components/core/Toast';
import { Header } from './components/header';
import { StatusBar } from './components/footer';
import { AppLoader } from './components/loader';
import Mediator from './components/Mediator';
import { SidePanel } from './components/sidePanel';
import * as Workspace from './services/workspace';
import * as Api from './services/api';
import * as Offline from './services/offline';
import * as EventService from './services/EventService';
import * as ConfigStore from './services/ConfigStore';
import * as JobTrackerService from './services/JobTrackerService';
import * as ShortcutService from './services/ShortcutService';
import { EVENT } from './config/constants';
import { NAV } from './config/routes';
import { isWasmSupported } from './lib/audio/wasm';
import { initPersistence, transcriptionStore } from './store';
import { initStoreConnectors } from './store/storeConnectors';

class App {
  async init(workspaceUuid) {
    Workspace.init(workspaceUuid);
    await ConfigStore.load();
    await initPersistence();

    initStoreConnectors();
    ShortcutService.init();
    JobTrackerService.init();

    const root = document.querySelector('.studio');

    new Toast(root);

    if (!isWasmSupported()) {
      console.warn('[App] SharedArrayBuffer not available.');
      console.warn('[App] To enable WASM, serve with headers:');
      console.warn('  Cross-Origin-Opener-Policy: same-origin');
      console.warn('  Cross-Origin-Embedder-Policy: require-corp');
    } else {
      console.log('[App] WASM support detected');
    }

    // Tabs first: the Navigator mounts the Inspector into the side panel's Inspector pane
    new SidePanel(root.querySelector('.studio-library'));

    const library = new Library(root.querySelector('.studio-library .library'), {
      api: { list: Workspace.getRouteUrl('audio') },
      onAddToTimeline: tracks => EventService.emitLocal(EVENT.TIMELINE_ADD_TRACKS, tracks)
    });
    library.load();

    new Video(root.querySelector('.studio-preview'));
    new Player(root.querySelector('.studio-preview'));
    new Header(root.querySelector('.studio-header .container-fluid'));
    new StatusBar(root.querySelector('.studio-footer'));
    new Navigator(root.querySelector('.studio-timeline'));

    try {
      const response = await Api.load();
      const isEmpty = Object.keys(response).length === 0;

      if (!isEmpty) {
        if (response.transcriptions) {
          transcriptionStore.actions.hydrate(response.transcriptions);
        }

        if (response.video) {
          await Mediator.onLoadVideo(response.video, response);
          console.log('[App] Workspace loaded with video');
        } else {
          const maxAudioEnd = (response.tracks || []).reduce((max, track) => {
            const endTime = (track.startTime || 0) + (track.durationTime || 0);
            return Math.max(max, endTime);
          }, 0);

          await Mediator.initAudioOnly({ ...response, maxAudioEnd });
          console.log('[App] Workspace loaded (audio-only)');
        }
      } else {
        await Mediator.initAudioOnly();
        console.log('[App] Empty workspace (audio-only)');
      }
    } catch (err) {
      console.error('[App] Could not open workspace:', err);
      renderWorkspaceUnavailable(workspaceUuid, err.message);
      await AppLoader.hide();
      return false;
    }

    await AppLoader.hide();

    return true;
  }
}

function renderWorkspaceUnavailable(uuid, message) {
  const $root = document.querySelector('.studio');

  if (!$root) {
    return;
  }

  const $container = document.createElement('div');
  $container.className = 'd-flex flex-column align-items-center justify-content-center h-100';

  const $title = document.createElement('h1');
  $title.className = 'text-muted mb-3';
  $title.textContent = 'Workspace unavailable';

  const $message = document.createElement('p');
  $message.className = 'text-muted mb-4';
  $message.textContent = message || `The workspace "${uuid}" is not available on this device.`;

  const $link = document.createElement('a');
  $link.className = 'btn btn-primary';
  $link.href = NAV.home;
  $link.textContent = 'Go to Home';

  $container.append($title, $message, $link);
  $root.replaceChildren($container);
}

document.addEventListener('DOMContentLoaded', async () => {
  await Offline.init();

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const uuid = pathParts[0] || null;

  try {
    const projects = await Api.getProjects();
    if (!uuid && !projects.some(project => project.hasLocalState)) {
      const created = await Api.createProject('My project');
      window.location.href = NAV.workspace(created.uuid);
      return;
    }

    if (!uuid) {
      if (projects.length > 0) {
        window.location.href = NAV.workspace(projects.find(project => project.hasLocalState).uuid);

        return;
      }
    }

    // UUID in URL but doesn't exist → show error
    if (uuid && !projects.find(p => p.uuid === uuid)) {
      AppLoader.hide();
      renderWorkspaceUnavailable(uuid);

      return;
    }
  } catch (err) {
    console.error('Error fetching projects:', err);
  }

  try {
    await new App().init(uuid);
  } catch (err) {
    console.error('[App] Could not initialize workspace:', err);
    renderWorkspaceUnavailable(uuid, 'Connect to the server to prepare this project first.');
    await AppLoader.hide();
  }

  window.addEventListener('beforeunload', () => {
    Mediator.destroy?.();
  });
});

export default App;
