/**
 * Offline Module - centralizes all offline-first functionality
 *
 * Exports:
 * - init(): Initialize all offline services
 * - ServiceWorker: SW registration and communication
 * - IndexedDB: Local data persistence
 * - SyncManager: Sync pending operations when online
 * - MediaPrefetch: Pre-cache audio tracks from editor
 */
import Mediator from '../../components/Mediator';
import { NOTIFY_TYPE } from '../../constants';
import { TOAST_DURATION } from '../../config/ui';

export { default as ServiceWorker } from './ServiceWorker';
export { default as IndexedDB, STORES } from './IndexedDB';
export { default as SyncManager } from './SyncManager';
export { default as MediaPrefetch } from './MediaPrefetch';

/**
 * Initialize all offline services
 */
export const init = async () => {
  const { default: ServiceWorker } = await import('./ServiceWorker');
  const { default: IndexedDB } = await import('./IndexedDB');
  const { default: SyncManager } = await import('./SyncManager');

  ServiceWorker.register();
  await IndexedDB.init();
  SyncManager.init();

  // Handle sync events with toasts
  SyncManager.onSyncComplete(handleSyncEvent);
};

const handleSyncEvent = event => {
  const { type, successCount, failCount } = event;

  switch (type) {
    case 'online':
      Mediator.showToast({
        type: NOTIFY_TYPE.INFO,
        msg: 'Back online - syncing changes...',
        timeHide: TOAST_DURATION.short
      });
      break;

    case 'complete':
      if (successCount > 0) {
        Mediator.showToast({
          type: NOTIFY_TYPE.SUCCESS,
          msg: `Synced ${successCount} change${successCount > 1 ? 's' : ''}`,
          timeHide: TOAST_DURATION.short
        });
      }

      if (failCount > 0) {
        Mediator.showToast({
          type: NOTIFY_TYPE.WARNING,
          msg: `${failCount} sync operation${failCount > 1 ? 's' : ''} failed`,
          timeHide: TOAST_DURATION.short
        });
      }
      break;
  }
};
