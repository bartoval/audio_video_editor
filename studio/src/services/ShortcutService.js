/**
 * ShortcutService - Keyboard shortcut management
 */

import * as ToolMode from './ToolMode';
import * as CutService from './CutService';
import * as SuperZoomService from './SuperZoomService';
import PlaybackCommands from './playback/PlaybackCommands';
import { playbackStore } from '../store';

const shortcuts = new Map();
const actionHandlers = new Map();
let isInitialized = false;

export const init = () => {
  if (isInitialized) {
    return;
  }

  registerDefaults();
  document.addEventListener('keydown', handleKeyDown);
  isInitialized = true;
};

export const destroy = () => {
  document.removeEventListener('keydown', handleKeyDown);
  shortcuts.clear();
  actionHandlers.clear();
  isInitialized = false;
};

export const register = (key, handler, options = {}) => {
  shortcuts.set(normalizeKey(key), {
    handler,
    preventDefault: options.preventDefault ?? true,
    stopPropagation: options.stopPropagation ?? false
  });
};

export const unregister = key => {
  shortcuts.delete(normalizeKey(key));
};

export const has = key => shortcuts.has(normalizeKey(key));

export const setActionHandler = (action, handler) => {
  actionHandlers.set(action, handler);
};

export const clearActionHandler = action => {
  actionHandlers.delete(action);
};

function registerDefaults() {
  register('Escape', () => {
    if (CutService.isActive()) {
      CutService.cancel();

      return true;
    }

    if (ToolMode.isActive()) {
      ToolMode.deactivate();

      return true;
    }

    return false;
  });

  register('c', () => {
    const handler = actionHandlers.get('toggleCutMode');

    if (handler) {
      handler();

      return true;
    }

    return false;
  });

  register('d', () => {
    const handler = actionHandlers.get('duplicateSelectedTrack');

    if (handler) {
      handler();

      return true;
    }

    return false;
  });

  register('Delete', () => {
    const deleteMarker = actionHandlers.get('deleteSelectedMarker');

    if (deleteMarker && deleteMarker()) {
      return true;
    }

    const deleteTrack = actionHandlers.get('deleteSelectedTrack');

    if (deleteTrack) {
      deleteTrack();

      return true;
    }

    return false;
  });

  register('Backspace', () => {
    const deleteMarker = actionHandlers.get('deleteSelectedMarker');

    if (deleteMarker && deleteMarker()) {
      return true;
    }

    const deleteTrack = actionHandlers.get('deleteSelectedTrack');

    if (deleteTrack) {
      deleteTrack();

      return true;
    }

    return false;
  });

  register('v', () => {
    const handler = actionHandlers.get('toggleVolumeSelectedTrack');

    if (handler) {
      handler();

      return true;
    }

    return false;
  });

  register('p', () => {
    const handler = actionHandlers.get('togglePanSelectedTrack');

    if (handler) {
      handler();

      return true;
    }

    return false;
  });

  register('u', () => {
    const handler = actionHandlers.get('toggleMuteSelectedTrack');

    if (handler) {
      handler();

      return true;
    }

    return false;
  });

  register('i', () => {
    const handler = actionHandlers.get('toggleInspector');

    if (handler) {
      handler();

      return true;
    }

    return false;
  });

  register('s', () => {
    const handler = actionHandlers.get('toggleSnapSelectedTrack');

    if (handler) {
      handler();

      return true;
    }

    return false;
  });

  register('m', () => {
    const handler = actionHandlers.get('addMarker');

    if (handler) {
      handler();
    }

    return true;
  });

  register('[', () => {
    const handler = actionHandlers.get('goToPreviousMarker');

    if (handler) {
      handler();

      return true;
    }

    return false;
  });

  register(']', () => {
    const handler = actionHandlers.get('goToNextMarker');

    if (handler) {
      handler();

      return true;
    }

    return false;
  });

  register('l', () => {
    const handler = actionHandlers.get('toggleLoop');

    if (handler) {
      handler();

      return true;
    }

    return false;
  });

  register(' ', () => {
    const { isPlaying } = playbackStore.getState();

    if (isPlaying) {
      PlaybackCommands.pause();
    } else {
      PlaybackCommands.play();
    }

    return true;
  });

  register('z', () => {
    SuperZoomService.toggle();

    return true;
  });
}

function handleKeyDown(event) {
  if (event.key !== 'Escape' && isInputFocused()) {
    return;
  }

  const shortcut = shortcuts.get(buildKeyString(event));

  if (!shortcut) {
    return;
  }

  const handled = shortcut.handler(event);

  if (handled) {
    if (shortcut.preventDefault) {
      event.preventDefault();
    }

    if (shortcut.stopPropagation) {
      event.stopPropagation();
    }
  }
}

function buildKeyString(event) {
  const parts = [];

  if (event.ctrlKey || event.metaKey) {
    parts.push('Ctrl');
  }

  if (event.shiftKey) {
    parts.push('Shift');
  }

  if (event.altKey) {
    parts.push('Alt');
  }

  parts.push(event.key);

  return parts.join('+');
}

function normalizeKey(key) {
  if (!key.includes('+')) {
    return key;
  }

  const parts = key.split('+');
  const modifiers = [];
  let mainKey = '';

  parts.forEach(part => {
    const normalized = part.toLowerCase();

    if (normalized === 'ctrl' || normalized === 'cmd' || normalized === 'meta') {
      modifiers.push('Ctrl');
    } else if (normalized === 'shift') {
      modifiers.push('Shift');
    } else if (normalized === 'alt') {
      modifiers.push('Alt');
    } else {
      mainKey = part;
    }
  });

  modifiers.sort();

  return [...modifiers, mainKey].join('+');
}

function isInputFocused() {
  const { activeElement } = document;

  if (!activeElement) {
    return false;
  }

  const { tagName } = activeElement;

  return tagName === 'INPUT' || tagName === 'TEXTAREA' || activeElement.isContentEditable;
}
