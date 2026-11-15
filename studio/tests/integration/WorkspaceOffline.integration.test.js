import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import IndexedDB, { STORES } from '../../src/services/offline/IndexedDB';
import SyncManager from '../../src/services/offline/SyncManager';
import * as Api from '../../src/services/api';
import * as Workspace from '../../src/services/workspace';
import { isOnline, on } from '../../src/services/EventService';
import { initPersistence, stopPersistence, timelineStore, workspaceStore } from '../../src/store';

vi.mock('../../src/services/EventService', () => ({
  isOnline: vi.fn(() => false),
  on: vi.fn(() => () => {}),
  off: vi.fn(),
  emitLocal: vi.fn()
}));
vi.mock('../../src/services/ErrorHandler', () => ({ default: { handle: vi.fn() } }));

const snapshot = label => ({ video: null, markers: [], tracks: [{ label }], transcriptions: {} });
const backup = label => Api.backup({ navigator: snapshot(label) });

describe('Offline workspaces with real IndexedDB', () => {
  beforeEach(async () => {
    Workspace.init('first');
    isOnline.mockReturnValue(false);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await IndexedDB.init();
    await IndexedDB.getInstance().clear(STORES.WORKSPACES);
    await IndexedDB.clearAllPendingSync();
  });

  afterEach(() => {
    stopPersistence();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps the latest saved recipe and project title, with one pending backup per project', async () => {
    await IndexedDB.saveWorkspace('first', { title: 'First project' });
    await backup('old edit');
    await backup('latest edit');
    Workspace.init('second');
    await backup('second project');
    Workspace.init('first');

    expect(await Api.load()).toEqual(snapshot('latest edit'));
    expect((await IndexedDB.getWorkspace('first')).title).toBe('First project');
    expect(await IndexedDB.getPendingSync()).toHaveLength(2);
    expect(fetch).not.toHaveBeenCalled();

    await IndexedDB.saveWorkspace('first', snapshot('stale server copy'));
    expect((await IndexedDB.getWorkspace('first')).tracks).toEqual([{ label: 'latest edit' }]);
  });

  it('rolls back the local state if its pending backup cannot be committed', async () => {
    await IndexedDB.saveWorkspace('first', snapshot('before'));
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (record) {
      if (this.name === STORES.PENDING_SYNC) {
        this.transaction.abort();
        return;
      }
      return put.call(this, record);
    });

    await expect(backup('unsaved')).rejects.toThrow();
    expect((await IndexedDB.getWorkspace('first')).tracks).toEqual([{ label: 'before' }]);
    expect(await IndexedDB.getPendingSync()).toEqual([]);
  });

  it('serializes saves arriving during synchronization and drains the latest backup', async () => {
    await backup('first save');
    const started = Promise.withResolvers();
    const finish = Promise.withResolvers();
    isOnline.mockReturnValue(true);
    fetch
      .mockImplementationOnce(() => {
        started.resolve();
        return finish.promise;
      })
      .mockResolvedValue({ ok: true });

    const syncing = SyncManager.sync();
    await started.promise;
    await IndexedDB.saveWorkspaceBackup('first', snapshot('new save'));
    const concurrent = SyncManager.sync();
    expect(concurrent).toBe(syncing);
    finish.resolve({ ok: true });
    await syncing;

    expect(fetch.mock.calls.map(([, options]) => JSON.parse(options.body).tracks[0].label)).toEqual(
      ['first save', 'new save']
    );
    expect(await IndexedDB.getPendingSync()).toEqual([]);
  });

  it('keeps a failed backup for retry instead of reporting it as synchronized', async () => {
    isOnline.mockReturnValue(true);
    fetch.mockResolvedValue({ ok: false, status: 500 });
    expect(await backup('retained')).toEqual({ success: true, offline: true });
    expect(await IndexedDB.getPendingSync()).toHaveLength(1);

    fetch.mockResolvedValue({ ok: true });
    await SyncManager.sync();
    expect(await IndexedDB.getPendingSync()).toEqual([]);
  });

  it('does not replace a newer local save with a delayed server response, even after sync', async () => {
    await IndexedDB.saveWorkspace('first', snapshot('original'));
    const started = Promise.withResolvers();
    const response = Promise.withResolvers();
    fetch.mockImplementation(() => {
      started.resolve();
      return response.promise;
    });
    const loading = Api.load();
    await started.promise;
    await backup('new edit');
    // Simulate acknowledgement before the older GET finishes.
    await IndexedDB.clearAllPendingSync();
    response.resolve({ ok: true, json: async () => snapshot('old server response') });

    expect(await loading).toEqual(snapshot('new edit'));
    expect((await IndexedDB.getWorkspace('first')).tracks).toEqual([{ label: 'new edit' }]);
  });

  it('restores saved state without the server and excludes UI records from the project list', async () => {
    await IndexedDB.saveWorkspace('first', { title: 'Saved project', ...snapshot('saved') });
    await IndexedDB.saveWorkspace('second', { title: 'Not opened yet' });
    await IndexedDB.getInstance().put(STORES.WORKSPACES, { uuid: 'timeline', data: {} });
    await IndexedDB.getInstance().put(STORES.WORKSPACES, { uuid: 'ui:first:timeline', data: {} });

    expect(await Api.load()).toEqual(snapshot('saved'));
    expect(await Api.getProjects()).toEqual([
      { uuid: 'first', title: 'Saved project', isVideoLoaded: false, hasLocalState: true },
      { uuid: 'second', title: 'Not opened yet', isVideoLoaded: false, hasLocalState: false }
    ]);
    Workspace.init('second');
    await expect(Api.load()).rejects.toThrow('no local save');
  });

  it('rehydrates UI state using the current project UUID', async () => {
    const db = IndexedDB.getInstance();
    await db.put(STORES.WORKSPACES, {
      uuid: 'ui:first:timeline',
      data: { selection: 'first-track' }
    });
    await db.put(STORES.WORKSPACES, {
      uuid: 'ui:second:timeline',
      data: { selection: 'second-track' }
    });
    await initPersistence();
    expect(timelineStore.getState().selection).toBe('first-track');
    expect(workspaceStore.getState().uuid).toBe('first');

    Workspace.init('second');
    await initPersistence();
    expect(timelineStore.getState().selection).toBe('second-track');
    expect(workspaceStore.getState().uuid).toBe('second');
  });

  it('retries pending saves on the first successful server connection', async () => {
    await backup('saved before connecting');
    SyncManager.init();
    const connected = on.mock.calls.find(([event]) => event === 'connected')[1];
    isOnline.mockReturnValue(true);
    fetch.mockResolvedValue({ ok: true });

    await connected();
    await vi.waitFor(
      async () => {
        expect(await IndexedDB.getPendingSync()).toEqual([]);
      },
      { timeout: 2000 }
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(snapshot('saved before connecting'));
  });
});
