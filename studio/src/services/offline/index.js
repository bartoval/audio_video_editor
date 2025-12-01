/**
 * Offline Module - centralizes all offline-first functionality
 *
 * Exports:
 * - init(): Initialize all offline services
 * - ServiceWorker: SW registration and communication
 * - IndexedDB: Local data persistence
 * - SyncManager: Sync pending operations when online
 * - MediaPrefetch: Pre-cache audio tracks from editor
 * - showAudioOfflineWarning(): Show warning when audio unavailable offline
 * - showCacheClearedToast(): Show toast when cache is cleared
 * - getAudioCacheInfo(): Get audio cache size info
 */
import { uiStore } from '../../store';
import { NOTIFY_TYPE } from '../../config/constants';
import { TOAST_DURATION } from '../../config/ui';

export { default as ServiceWorker } from './ServiceWorker';
export { default as IndexedDB, STORES, AUDIO_CACHE_LIMIT } from './IndexedDB';
export { default as SyncManager } from './SyncManager';
export { default as MediaPrefetch } from './MediaPrefetch';
export { default as OfflinePrefetch } from './OfflinePrefetch';

/**
 * Initialize all offline services
 */
export const init = async () => {
  const { default: ServiceWorker } = await import('./ServiceWorker');
  const { default: IndexedDB } = await import('./IndexedDB');
  const { default: SyncManager } = await import('./SyncManager');
  const { default: OfflinePrefetch } = await import('./OfflinePrefetch');

  ServiceWorker.register();
  await IndexedDB.init();
  SyncManager.init();
  OfflinePrefetch.init();

  // Handle sync events with toasts
  SyncManager.onSyncComplete(handleSyncEvent);
};

const handleSyncEvent = event => {
  const { type, successCount, failCount } = event;

  switch (type) {
    case 'online':
      uiStore.actions.pushToast({
        type: NOTIFY_TYPE.INFO,
        msg: 'Back online - syncing changes...',
        timeHide: TOAST_DURATION.short
      });
      break;

    case 'complete':
      if (successCount > 0) {
        uiStore.actions.pushToast({
          type: NOTIFY_TYPE.SUCCESS,
          msg: `Synced ${successCount} change${successCount > 1 ? 's' : ''}`,
          timeHide: TOAST_DURATION.short
        });
      }

      if (failCount > 0) {
        uiStore.actions.pushToast({
          type: NOTIFY_TYPE.WARNING,
          msg: `${failCount} sync operation${failCount > 1 ? 's' : ''} failed`,
          timeHide: TOAST_DURATION.short
        });
      }
      break;

    // Audio prefetch events
    case 'audio-prefetch-start':
      uiStore.actions.setTaskStatus('audio-prefetch', {
        status: `Caching audio (0/${event.count})...`,
        progress: 0,
        type: 'info'
      });
      break;

    case 'audio-prefetch-progress':
      uiStore.actions.setTaskStatus('audio-prefetch', {
        status: `Caching audio (${event.completed}/${event.total})...`,
        progress: event.percent,
        type: 'info'
      });
      break;

    case 'audio-prefetch-complete':
      uiStore.actions.clearTaskStatus('audio-prefetch');

      if (successCount > 0 && failCount === 0) {
        uiStore.actions.pushToast({
          type: NOTIFY_TYPE.SUCCESS,
          msg: `Cached ${successCount} audio track${successCount > 1 ? 's' : ''} for offline`,
          timeHide: TOAST_DURATION.short
        });
      } else if (failCount > 0) {
        uiStore.actions.pushToast({
          type: NOTIFY_TYPE.WARNING,
          msg: `Audio cache: ${successCount} OK, ${failCount} failed`,
          details: 'Some tracks may not be available offline',
          timeHide: TOAST_DURATION.medium
        });
      }
      break;
  }
};

// Audio Offline UX Helpers

/**
 * Show warning when audio is not available offline
 * @param {string} trackName - Name of the track (optional)
 */
export const showAudioOfflineWarning = trackName => {
  const msg = trackName
    ? `Audio "${trackName}" not available offline`
    : 'Audio not available offline';

  uiStore.actions.pushToast({
    type: NOTIFY_TYPE.WARNING,
    msg,
    details: 'Connect to the internet to load this audio',
    timeHide: TOAST_DURATION.medium
  });
};

/**
 * Show toast when audio cache is cleared
 * @param {number} clearedCount - Number of items cleared
 */
export const showCacheClearedToast = clearedCount => {
  uiStore.actions.pushToast({
    type: NOTIFY_TYPE.SUCCESS,
    msg:
      clearedCount > 0
        ? `Cleared ${clearedCount} cached audio file${clearedCount > 1 ? 's' : ''}`
        : 'Audio cache already empty',
    timeHide: TOAST_DURATION.short
  });
};

/**
 * Get audio cache size information
 * @returns {Promise<{used: number, limit: number, percent: number, formatted: string}>}
 */
export const getAudioCacheInfo = async () => {
  const { default: IndexedDB } = await import('./IndexedDB');

  const used = await IndexedDB.getAudioBlobsTotalSize();
  const limit = IndexedDB.getAudioCacheLimit();
  const percent = Math.round((used / limit) * 100);

  const formatSize = bytes => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return {
    used,
    limit,
    percent,
    formatted: `${formatSize(used)} / ${formatSize(limit)}`
  };
};
