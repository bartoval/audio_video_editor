import { persist, rehydrate, clearPersisted } from './persist';
import aiMusicStore from './aiMusicStore';
import authStore, {
  initAuth,
  handleAuthCallback,
  login,
  logout,
  isAuthenticated,
  getUser
} from './authStore';
import playbackStore from './playbackStore';
import timelineStore from './timelineStore';
import transcriptionStore from './transcriptionStore';
import uiStore from './uiStore';
import workspaceStore from './workspaceStore';

export { playbackStore, timelineStore, transcriptionStore, workspaceStore, uiStore, authStore, aiMusicStore };
export { initAuth, handleAuthCallback, login, logout, isAuthenticated, getUser };

let persistUnsubscribers = [];

/**
 * Initialize store persistence for offline support
 *
 * Call this once on app bootstrap after IndexedDB is ready.
 * Rehydrates persisted stores and sets up auto-save.
 */
export async function initPersistence() {
  await Promise.all([rehydrate(timelineStore, 'timeline'), rehydrate(workspaceStore, 'workspace')]);

  persistUnsubscribers = [
    persist(timelineStore, { key: 'timeline', fields: ['tracks', 'selection'] }),
    persist(workspaceStore, { key: 'workspace' })
  ];
}

export function stopPersistence() {
  persistUnsubscribers.forEach(unsub => unsub());
  persistUnsubscribers = [];
}

export async function clearAllPersisted() {
  await Promise.all([clearPersisted('timeline'), clearPersisted('workspace')]);
}
