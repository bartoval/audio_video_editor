import * as ShortcutService from '../../../services/ShortcutService';
import * as CutService from '../../../services/CutService';
import { playbackStore } from '../../../store';

const SHORTCUT_ACTIONS = [
  'toggleInspector',
  'addMarker',
  'deleteSelectedMarker',
  'splitSelectedTrack',
  'duplicateSelectedTrack',
  'deleteSelectedTrack',
  'toggleVolumeSelectedTrack',
  'toggleMuteSelectedTrack',
  'toggleSnapSelectedTrack',
  'toggleCutMode',
  'goToPreviousMarker',
  'goToNextMarker',
  'toggleLoop',
  'zoomIn',
  'zoomOut',
  'zoomToFit'
];

/**
 * Register all navigator keyboard shortcuts.
 * Returns a cleanup function that removes all handlers.
 *
 * @param {{ inspector: any, markers: any, tracks: any, onLoopToggle: () => void, zoom: { in: () => void, out: () => void, fit: () => void } }} deps
 * @returns {() => void}
 */
export function registerNavigatorShortcuts({ inspector, markers, tracks, onLoopToggle, zoom }) {
  ShortcutService.setActionHandler('toggleInspector', () => inspector.toggle());
  ShortcutService.setActionHandler('addMarker', () => markers.addAtPlayhead());

  ShortcutService.setActionHandler('deleteSelectedMarker', () => {
    const selected = markers.getSelected();

    if (selected) {
      markers.remove(selected.getId());

      return true;
    }

    return false;
  });

  ShortcutService.setActionHandler('splitSelectedTrack', () => {
    const selected = tracks.getSelected();

    if (selected) {
      tracks.enterSplitMode(selected);
    }
  });

  ShortcutService.setActionHandler('duplicateSelectedTrack', () => {
    const selected = tracks.getSelected();

    if (selected) {
      tracks.clone(selected);
    }
  });

  ShortcutService.setActionHandler('deleteSelectedTrack', () => {
    const selected = tracks.getSelected();

    if (selected) {
      tracks.remove(selected);
    }
  });

  ShortcutService.setActionHandler('toggleVolumeSelectedTrack', () => {
    const selected = tracks.getSelected();

    if (selected) {
      tracks.toggleVolume(selected);
      selected.floatingToolbar?.setVolumeActive(selected.model?.isVolumeVisible());
    }
  });

  ShortcutService.setActionHandler('toggleMuteSelectedTrack', () => {
    const selected = tracks.getSelected();

    if (selected) {
      tracks.toggleMute(selected);
      selected.floatingToolbar?.setMuteActive(selected.isMuted());
    }
  });

  ShortcutService.setActionHandler('toggleSnapSelectedTrack', () => {
    const selected = tracks.getSelected();

    if (selected) {
      selected.toggleSnap();
    }
  });

  ShortcutService.setActionHandler('toggleCutMode', () => {
    const selected = tracks.getSelected();

    if (selected) {
      CutService.toggle();
    }
  });

  ShortcutService.setActionHandler('goToPreviousMarker', () => {
    markers.goToPrevious(playbackStore.getState().time);
  });

  ShortcutService.setActionHandler('goToNextMarker', () => {
    markers.goToNext(playbackStore.getState().time);
  });

  ShortcutService.setActionHandler('toggleLoop', () => {
    onLoopToggle();
  });

  if (zoom) {
    ShortcutService.setActionHandler('zoomIn', () => zoom.in());
    ShortcutService.setActionHandler('zoomOut', () => zoom.out());
    ShortcutService.setActionHandler('zoomToFit', () => zoom.fit());
  }

  return () => {
    SHORTCUT_ACTIONS.forEach(action => ShortcutService.clearActionHandler(action));
  };
}
