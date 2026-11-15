import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import IndexedDB, { STORES } from '../../src/services/offline/IndexedDB';
import SyncManager from '../../src/services/offline/SyncManager';
import * as LocalMedia from '../../src/services/offline/LocalMedia';
import * as Api from '../../src/services/api';
import * as Workspace from '../../src/services/workspace';
import { isOnline, on } from '../../src/services/EventService';
import { initPersistence, stopPersistence, timelineStore } from '../../src/store';

vi.mock('../../src/services/EventService', () => ({
  isOnline: vi.fn(() => true),
  on: vi.fn(() => () => {}),
  off: vi.fn(),
  connect: vi.fn(),
  emitLocal: vi.fn()
}));
vi.mock('../../src/services/ErrorHandler', () => ({ default: { handle: vi.fn() } }));
const snapshot = label => ({ video: null, markers: [], tracks: [{ label }], transcriptions: {} });
const backup = label => Api.backup({ navigator: snapshot(label) });
const response = data =>
  new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
const server = (url, options = {}) => {
  if (String(url).endsWith('/workspaces')) return Promise.resolve(response([]));
  if (String(url).endsWith('/audio') && !options.method) return Promise.resolve(response({}));
  return Promise.resolve(
    response(options.method === 'POST' ? { status: 'complete' } : { success: true })
  );
};

describe('Local projects with explicit server synchronization', () => {
  beforeEach(async () => {
    Workspace.init('first');
    isOnline.mockReturnValue(true);
    on.mockClear();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('No server')));
    await IndexedDB.init();
    for (const store of [STORES.WORKSPACES, STORES.PENDING_SYNC, STORES.LOCAL_MEDIA]) {
      await IndexedDB.getInstance().clear(store);
    }
  });
  afterEach(() => {
    stopPersistence();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates, saves and reloads locally even when online, without automatic sync', async () => {
    const project = await Api.createProject('Local project');
    Workspace.init(project.uuid);
    await backup('old');
    await backup('latest');
    SyncManager.init();
    window.dispatchEvent(new Event('online'));
    expect(await Api.load()).toEqual(snapshot('latest'));
    expect(await IndexedDB.getPendingSync()).toHaveLength(1);
    expect((await Api.getProjects())[0].title).toBe('Local project');
    expect(fetch).not.toHaveBeenCalled();
    expect(on).not.toHaveBeenCalled();
  });

  it('loads a synchronized local save without checking for a newer server copy', async () => {
    await IndexedDB.saveWorkspace('first', {
      title: 'Local',
      ...snapshot('on device'),
      serverSynced: true
    });
    expect(await Api.load()).toEqual(snapshot('on device'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rolls back a save when the pending operation cannot be committed', async () => {
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

  it('sends original media before the timeline only after explicit sync, and does not upload twice', async () => {
    await backup('edit');
    const blob = new Blob(['original bytes'], { type: 'audio/wav' });
    await LocalMedia.store('first', 'stable.wav', blob, { filename: 'Song.wav' });
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockImplementation(server);
    await SyncManager.sync();
    const calls = fetch.mock.calls;
    const upload = calls.findIndex(
      ([url, opts]) => opts.method === 'POST' && url.includes('/sync/audio/stable.wav')
    );
    const save = calls.findIndex(([url, opts]) => opts.method === 'PUT' && url.endsWith('/state'));
    expect(upload).toBeGreaterThan(-1);
    expect(save).toBeGreaterThan(upload);
    expect(await calls[upload][1].body.get('file').text()).toBe('original bytes');
    expect(await IndexedDB.getPendingSync()).toEqual([]);
    await SyncManager.sync();
    expect(fetch.mock.calls.filter(([, opts]) => opts.method === 'POST')).toHaveLength(1);
  });

  it('uploads only derived audio referenced by the saved timeline', async () => {
    await IndexedDB.saveWorkspaceBackup('first', {
      ...snapshot('edit'),
      tracks: [{ derivedId: 'used.wav' }]
    });
    for (const id of ['used.wav', 'old.wav']) {
      await LocalMedia.store('first', id, new Blob([id]), { filename: id }, 'derived');
    }
    fetch.mockImplementation(server);
    await SyncManager.sync();
    const uploads = fetch.mock.calls.filter(([, options]) => options.method === 'POST');
    expect(uploads).toHaveLength(1);
    expect(uploads[0][0]).toContain('/sync/derived/used.wav');
    expect((await LocalMedia.get('first', 'old.wav')).synced).toBe(false);
  });

  it('requires explicit media sync before server operations, without uploading automatically', async () => {
    await IndexedDB.saveWorkspace('first', { ...snapshot('synced'), serverSynced: true });
    await LocalMedia.store('first', 'new.wav', new Blob(['new original']), { filename: 'new.wav' });
    await expect(Api.startStemsSeparation('new.wav')).rejects.toThrow('Sync server first');
    await expect(
      Api.publish({ video: {}, navigator: { tracks: [{ idTrack: 'new.wav' }] } })
    ).rejects.toThrow('Sync server first');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('retains files and saves after a failed sync and retries explicitly', async () => {
    await backup('retained');
    await LocalMedia.store('first', 'song.wav', new Blob(['original']), { filename: 'Song.wav' });
    await expect(SyncManager.sync()).rejects.toThrow('No server');
    expect(await IndexedDB.getPendingSync()).toHaveLength(1);
    expect(await (await LocalMedia.get('first', 'song.wav')).blob.text()).toBe('original');
    fetch.mockImplementation(server);
    await SyncManager.sync();
    expect(await IndexedDB.getPendingSync()).toEqual([]);
  });

  it('does not acknowledge edits saved while an older sync is in flight', async () => {
    await backup('old');
    const started = Promise.withResolvers();
    const finish = Promise.withResolvers();
    fetch.mockImplementation((url, opts = {}) => {
      if (url.endsWith('/state')) {
        started.resolve();
        return finish.promise;
      }
      return server(url, opts);
    });
    const syncing = SyncManager.sync();
    await started.promise;
    await backup('new');
    finish.resolve(response({ success: true }));
    await syncing;
    expect(await Api.load()).toEqual(snapshot('new'));
    expect(await IndexedDB.getPendingSync()).toHaveLength(1);
  });

  it('deletes locally without contacting the server and filters UI records out of the catalogue', async () => {
    await IndexedDB.saveWorkspace('first', { title: 'Project', ...snapshot('saved') });
    await IndexedDB.getInstance().put(STORES.WORKSPACES, {
      uuid: 'ui:first:timeline',
      data: { selection: 'clip' }
    });
    await initPersistence();
    expect(timelineStore.getState().selection).toBe('clip');
    expect(await Api.getProjects()).toHaveLength(1);
    await LocalMedia.store('first', 'song.wav', new Blob(['original']), { filename: 'Song.wav' });
    await Api.deleteProject('first');
    expect((await LocalMedia.get('first', 'song.wav')).blob).toBeNull();
    expect(await Api.getProjects()).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
