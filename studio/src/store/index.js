import { persist, rehydrate, clearPersisted } from './persist';
import playbackStore from './playbackStore';
import timelineStore from './timelineStore';
import transcriptionStore from './transcriptionStore';
import uiStore from './uiStore';
import workspaceStore from './workspaceStore';
import { getUuid } from '../services/workspace';

export { playbackStore, timelineStore, transcriptionStore, workspaceStore, uiStore };

let persistUnsubscribers = [];

/**
 * Initialize store persistence for offline support
 *
 * Call this once on app bootstrap after IndexedDB is ready.
 * Rehydrates persisted stores and sets up auto-save.
 */
export async function initPersistence() {
  stopPersistence();
  const uuid = getUuid();
  const timelineKey = `ui:${uuid}:timeline`;
  const workspaceKey = `ui:${uuid}:workspace`;
  await Promise.all([
    rehydrate(timelineStore, timelineKey),
    rehydrate(workspaceStore, workspaceKey)
  ]);
  workspaceStore.actions.setUuid(uuid);

  persistUnsubscribers = [
    persist(timelineStore, { key: timelineKey, fields: ['tracks', 'selection'] }),
    persist(workspaceStore, { key: workspaceKey })
  ];
}

export function stopPersistence() {
  persistUnsubscribers.forEach(unsub => unsub());
  persistUnsubscribers = [];
}

export async function clearAllPersisted() {
  const uuid = getUuid();
  await Promise.all([
    clearPersisted(`ui:${uuid}:timeline`),
    clearPersisted(`ui:${uuid}:workspace`)
  ]);
}
