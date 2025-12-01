/**
 * Audio Video Sync Studio
 */
import './style.css';
import Library from './components/audioLibrary';
import Navigator from './components/timeline/Navigator';
import Video from './components/playback/video';
import Player from './components/playback/PlayerPresenter';
import Toast from './components/core/Toast';
import { Header } from './components/header';
import { StatusBar } from './components/footer';
import { TranscriptSearchPresenter } from './components/timeline/navigator/search';
import { AppLoader } from './components/loader';
import Mediator from './components/Mediator';
import * as Workspace from './services/workspace';
import * as Api from './services/api';
import * as Offline from './services/offline';
import * as EventService from './services/EventService';
import * as ConfigStore from './services/ConfigStore';
import * as JobTrackerService from './services/JobTrackerService';
import * as ShortcutService from './services/ShortcutService';
import AiMusicService from './services/aiMusic/AiMusicService';
import { EVENT } from './config/constants';
import { NAV } from './config/routes';
import { isWasmSupported, setWasmEnabled } from './lib/audio/wasm';
import { initPersistence, transcriptionStore } from './store';
import { initStoreConnectors } from './store/storeConnectors';

class App {
  async init(workspaceUuid) {
    await ConfigStore.load();
    await initPersistence();

    initStoreConnectors();
    ShortcutService.init();
    JobTrackerService.init();

    Workspace.init(workspaceUuid);

    const root = document.querySelector('.studio');

    new Toast(root);

    if (!isWasmSupported()) {
      console.warn('[App] SharedArrayBuffer not available.');
      console.warn('[App] To enable WASM, serve with headers:');
      console.warn('  Cross-Origin-Opener-Policy: same-origin');
      console.warn('  Cross-Origin-Embedder-Policy: require-corp');
      setWasmEnabled(false);
    } else {
      console.log('[App] WASM support detected');
    }

    const library = new Library(root.querySelector('.studio-library .library'), {
      api: { list: Workspace.getRouteUrl('audio') },
      onAddToTimeline: tracks => EventService.emitLocal(EVENT.TIMELINE_ADD_TRACKS, tracks)
    });
    library.load();

    new Video(root.querySelector('.studio-preview'));
    new Player(root.querySelector('.studio-preview'));
    new Header(root.querySelector('.studio-header .container-fluid'));
    new StatusBar(root.querySelector('.studio-footer'));
    new TranscriptSearchPresenter(root.querySelector('[data-ref="search-slot"]'));
    new Navigator(root.querySelector('.studio-timeline'));

    try {
      const response = await Api.load();
      const isEmpty = Object.keys(response).length === 0;

      if (!isEmpty) {
        if (response.transcriptions) {
          transcriptionStore.actions.hydrate(response.transcriptions);
        }

        let audioList = {};
        try {
          audioList = await Api.getAudioList();
        } catch (error) {
          console.warn('Audio list fetch failed, skipping orphan filter', error);
        }

        if (response.tracks && Array.isArray(response.tracks) && audioList) {
          const before = response.tracks.length;
          response.tracks = response.tracks.filter(track => audioList[track.idTrack]);
          const removed = before - response.tracks.length;
          if (removed > 0) {
            console.warn(`Removed ${removed} orphan tracks (missing audio files)`);
          }
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
      console.log('[App] No saved workspace:', err);
      await Mediator.initAudioOnly();
    }

    await AppLoader.hide();
    EventService.connect();
    AiMusicService.recover();

    return true;
  }
}

function renderWorkspaceNotFound(uuid) {
  const $root = document.querySelector('.studio');

  if (!$root) {
    return;
  }

  const $container = document.createElement('div');
  $container.className = 'd-flex flex-column align-items-center justify-content-center h-100';

  const $title = document.createElement('h1');
  $title.className = 'text-muted mb-3';
  $title.textContent = 'Workspace not found';

  const $message = document.createElement('p');
  $message.className = 'text-muted mb-4';
  $message.textContent = `The workspace "${uuid}" does not exist.`;

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

    if (!uuid) {
      if (projects.length > 0) {
        window.location.href = NAV.workspace(projects[0].uuid);

        return;
      }
    }

    // UUID in URL but doesn't exist → show error
    if (uuid && !projects.find(p => p.uuid === uuid)) {
      AppLoader.hide();
      renderWorkspaceNotFound(uuid);

      return;
    }
  } catch (err) {
    console.error('Error fetching projects:', err);
  }

  new App().init(uuid);

  window.addEventListener('beforeunload', () => {
    Mediator.destroy?.();
  });
});

export default App;
