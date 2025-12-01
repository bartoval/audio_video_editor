// @ts-check

/**
 * Store Connectors - wire EventService (SSE) to stores
 */
import { CSS_CLASS, SELECTOR } from '../config/ui';
import { ERROR_CONTEXT, EVENT, THUMBS_STATUS } from '../config/constants';
import * as EventService from '../services/EventService';
import * as Workspace from '../services/workspace';

import timelineStore from './timelineStore';
import transcriptionStore from './transcriptionStore';
import uiStore from './uiStore';
import workspaceStore from './workspaceStore';

let unsubscribers = [];

export function initStoreConnectors() {
  unsubscribers = [
    connectThumbnailsEvents(),
    connectConnectionEvents(),
    connectToolModeEffect(),
    connectVideoClassEffect(),
    connectTranscriptionEvents(),
    connectSceneDetectionEvents()
  ];
}

export function destroyStoreConnectors() {
  unsubscribers.forEach(unsub => unsub());
  unsubscribers = [];
}

function connectThumbnailsEvents() {
  return EventService.on(EVENT.THUMBNAILS, data => {
    const { status, progress } = data;

    if (status === 'generating' && progress) {
      const { percent, scale } = progress;

      timelineStore.actions.setThumbsLoading(true);
      timelineStore.actions.setThumbsStatus(THUMBS_STATUS.PROCESSING);
      timelineStore.actions.setThumbsProgress({ percent, scale });

      uiStore.actions.setTaskStatus('thumbnails', {
        status: `Thumbnails ${scale}x`,
        progress: percent,
        type: 'info'
      });
    } else if (status === 'scale_complete') {
      const { scale } = data.progress || {};

      Workspace.invalidateCache();

      const currentState = timelineStore.getState();
      if (scale) {
        const scalesReady = [...currentState.thumbs.scalesReady, scale];
        timelineStore.actions.setScalesReady(scalesReady);
      }
    } else if (status === 'complete') {
      timelineStore.actions.setThumbsLoading(false);
      timelineStore.actions.setThumbsStatus(THUMBS_STATUS.READY);
      timelineStore.actions.setThumbsProgress({ percent: 100 });

      uiStore.actions.clearTaskStatus('thumbnails');
      Workspace.invalidateCache();
    } else if (status === 'error') {
      timelineStore.actions.setThumbsLoading(false);
      timelineStore.actions.setThumbsStatus(THUMBS_STATUS.ERROR);

      uiStore.actions.clearTaskStatus('thumbnails');
      uiStore.actions.pushToast({
        type: 'error',
        msg: ERROR_CONTEXT.THUMBNAIL_GENERATION,
        details: data.error || undefined
      });
    }
  });
}

function connectConnectionEvents() {
  return EventService.on(EVENT.CONNECTION, () => {});
}

function connectToolModeEffect() {
  let previousMode = null;

  return uiStore.subscribe(state => {
    const { toolMode } = state;

    if (toolMode === previousMode) {
      return;
    }

    const { classList } = document.body;

    classList.remove('tool-volume', 'tool-pan', 'tool-cut');

    if (toolMode) {
      classList.add(`tool-${toolMode}`);
    }

    previousMode = toolMode;
  });
}

function connectTranscriptionEvents() {
  return EventService.on(EVENT.TRANSCRIPTION_READY, ({ audioId, result }) => {
    transcriptionStore.actions.setTranscription({ audioId, data: result });
  });
}

function connectSceneDetectionEvents() {
  return EventService.on(EVENT.SCENE_DETECTION_READY, ({ scenes }) => {
    EventService.emitLocal(EVENT.MARKERS_CHANGED, { scenes, source: 'scene-detect' });
  });
}

function connectVideoClassEffect() {
  let previousHasVideo = null;
  const $root = document.querySelector(SELECTOR.STUDIO);

  return workspaceStore.subscribe(state => {
    const hasVideo = Boolean(state.videoUrl);

    if (hasVideo === previousHasVideo) {
      return;
    }

    if (hasVideo) {
      $root?.classList.add(CSS_CLASS.HAS_VIDEO);
    } else {
      $root?.classList.remove(CSS_CLASS.HAS_VIDEO);
    }

    previousHasVideo = hasVideo;
  });
}
