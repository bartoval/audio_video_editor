import IndexedDB from './IndexedDB';
import * as LocalMedia from './LocalMedia';
import ChunkedUploader from '../upload/ChunkedUploader';
import { buildUrl, ROUTES } from '../../config/routes';

async function request(url, options = {}) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    ...options,
    headers: { 'X-Project-Sync': '1', ...options.headers },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`Sync failed (${response.status}). Local files are retained.`);
  return response;
}
const json = data => ({
  headers: { 'Content-Type': 'application/json', 'X-Project-Sync': '1' },
  body: JSON.stringify(data)
});
const stateOf = project => ({
  video: project.video || null,
  tracks: project.tracks || [],
  markers: project.markers || [],
  transcriptions: project.transcriptions || {}
});

async function removeRemote(url) {
  const response = await fetch(url, { method: 'DELETE', signal: AbortSignal.timeout(30000) });
  if (!response.ok && response.status !== 404)
    throw new Error(`Deletion failed (${response.status}). Retry Sync server.`);
}

async function upload(uuid, record, url, extraFields = {}) {
  if (!record.blob) throw new Error(`Missing local file: ${record.id}`);
  const filename =
    record.metadata?.filename || (record.kind === 'derived' ? `${record.id}.wav` : record.id);
  const file = new File([record.blob], filename, { type: record.blob.type });
  await new ChunkedUploader(url, { parallelUploads: 1 }).upload(file, uuid, { extraFields });
}

async function pushProject(project, notify) {
  const uuid = project.uuid;
  if (project.deleted) {
    if (!project.serverDeleted) {
      await removeRemote(`${ROUTES.workspaces}/${uuid}`);
      await IndexedDB.saveWorkspace(uuid, { serverDeleted: true });
    }
    return;
  }
  if (!('tracks' in project || 'video' in project)) return;
  const state = stateOf(project);
  const pending = (await IndexedDB.getPendingSync()).filter(
    operation =>
      operation.uuid === uuid &&
      operation.type === 'backup' &&
      Object.keys(state).every(
        key => JSON.stringify(operation.data[key]) === JSON.stringify(state[key])
      )
  );
  const media = await LocalMedia.list(uuid);
  await request(`${ROUTES.workspaces}/${uuid}`, {
    method: 'PUT',
    ...json({ title: project.title || 'Untitled' })
  });

  for (const record of media) {
    if (record.kind === 'video') continue;
    if (record.kind === 'derived' && !state.tracks.some(track => track.derivedId === record.id))
      continue;
    if (record.deleted) {
      if (record.synced && record.kind === 'audio')
        await removeRemote(buildUrl('audio', uuid, `/${record.id}`));
      continue;
    }
    if (record.synced) continue;
    notify(`Uploading ${record.metadata?.filename || record.id}`);
    await upload(
      uuid,
      record,
      `${ROUTES.workspaces}/${uuid}/sync/${record.kind}/${encodeURIComponent(record.id)}`
    );
    await LocalMedia.markSynced(record.key);
  }
  // Promote cached WASM results referenced by this saved timeline, without uploading unrelated cache entries.
  for (const track of state.tracks) {
    if (!track.derivedId || (await LocalMedia.get(uuid, track.derivedId))) continue;
    const cached = await IndexedDB.getAudioBlob(uuid, track.derivedId);
    if (!cached?.blob) continue; // A server-generated derived file may already exist remotely.
    const record = await LocalMedia.store(
      uuid,
      track.derivedId,
      cached.blob,
      { filename: `${track.derivedId}.wav` },
      'derived'
    );
    await upload(
      uuid,
      record,
      `${ROUTES.workspaces}/${uuid}/sync/derived/${encodeURIComponent(record.id)}`
    );
    await LocalMedia.markSynced(record.key);
  }
  const videoId = project.videoInfo?.localMediaId;
  if (state.video && videoId && videoId !== project.syncedVideoId) {
    const record = media.find(item => item.id === videoId && !item.deleted);
    if (!record) throw new Error('The original video is missing on this device.');
    notify(`Uploading ${record.metadata.filename}`);
    await upload(uuid, record, buildUrl('videoFile', uuid), { localSync: 'true' });
    await IndexedDB.saveWorkspace(uuid, { syncedVideoId: videoId });
  } else if (!state.video && project.syncedVideoId) {
    await removeRemote(buildUrl('video', uuid));
    await IndexedDB.saveWorkspace(uuid, { syncedVideoId: null });
  }
  await request(buildUrl('state', uuid), { method: 'PUT', ...json(state) });
  await IndexedDB.saveWorkspace(uuid, { serverSynced: true });
  await downloadMissingMedia(project, notify);
  for (const operation of pending) await IndexedDB.clearPendingSync(operation.id);
}

async function downloadMissingMedia(project, notify) {
  const uuid = project.uuid;
  const library = await (await request(buildUrl('audio', uuid))).json();
  for (const [id, metadata] of Object.entries(library)) {
    const local = await LocalMedia.get(uuid, id);
    if (local?.blob || local?.deleted) continue;
    notify(`Downloading ${metadata.name || id}`);
    const blob = await (
      await request(buildUrl('audio', uuid, `/${encodeURIComponent(id)}`))
    ).blob();
    await LocalMedia.store(uuid, id, blob, { ...metadata, filename: id }, 'audio', true);
  }
  await IndexedDB.saveWorkspace(uuid, { audioLibrary: library });
  const videoId = project.videoInfo?.localMediaId;
  const localVideo = videoId ? await LocalMedia.get(uuid, videoId) : null;
  if (project.video && !localVideo?.blob) {
    const info = await (await request(buildUrl('video', uuid))).json();
    const blob = await (await request(buildUrl('videoFile', uuid))).blob();
    const id = `${crypto.randomUUID()}.mp4`;
    await LocalMedia.store(uuid, id, blob, { filename: info.name || 'video.mp4' }, 'video', true);
    await IndexedDB.saveWorkspace(
      uuid,
      { videoInfo: { ...info, localMediaId: id }, syncedVideoId: id },
      { expectedRevision: project.localRevision || 0 }
    );
  }
}

async function pullProject(remote, notify) {
  const uuid = remote.uuid;
  const current = await IndexedDB.getWorkspace(uuid);
  if (current?.deleted || current?.tracks || current?.video !== undefined) return;
  notify(`Downloading ${remote.title}`);
  const state = await (await request(buildUrl('state', uuid))).json();
  const library = await (await request(buildUrl('audio', uuid))).json();
  for (const [id, metadata] of Object.entries(library)) {
    if ((await LocalMedia.get(uuid, id))?.blob) continue;
    const blob = await (
      await request(buildUrl('audio', uuid, `/${encodeURIComponent(id)}`))
    ).blob();
    await LocalMedia.store(uuid, id, blob, { ...metadata, filename: id }, 'audio', true);
  }
  for (const track of state.tracks || []) {
    if (!track.derivedId || (await LocalMedia.get(uuid, track.derivedId))?.blob) continue;
    const blob = await (
      await request(buildUrl('audio', uuid, `/derived/${encodeURIComponent(track.derivedId)}`))
    ).blob();
    await LocalMedia.store(
      uuid,
      track.derivedId,
      blob,
      { filename: `${track.derivedId}.wav` },
      'derived',
      true
    );
  }
  let videoInfo = null;
  if (state.video) {
    videoInfo = await (await request(buildUrl('video', uuid))).json();
    let response = await fetch(buildUrl('video', uuid, '/original'), {
      headers: { 'X-Project-Sync': '1' },
      signal: AbortSignal.timeout(30000)
    });
    const original = response.ok;
    if (!original) response = await request(buildUrl('videoFile', uuid));
    const blob = await response.blob();
    const id = `${crypto.randomUUID()}.mp4`;
    await LocalMedia.store(
      uuid,
      id,
      blob,
      { filename: videoInfo.name || 'video.mp4' },
      'video',
      true
    );
    videoInfo = { ...videoInfo, localMediaId: id, isMuteVideo: videoInfo.isMuteVideo };
  }
  await IndexedDB.saveWorkspace(
    uuid,
    {
      ...remote,
      video: null,
      tracks: [],
      markers: [],
      ...state,
      audioLibrary: library,
      videoInfo,
      syncedVideoId: videoInfo?.localMediaId || null,
      serverSynced: true
    },
    { expectedRevision: current?.localRevision || 0 }
  );
}

export async function syncProjects(notify = () => {}) {
  const projects = (await IndexedDB.getAllWorkspaces()).filter(record => !('data' in record));
  let successCount = 0;
  for (const project of projects) {
    notify(`Synchronizing ${project.title || 'project'}`);
    await pushProject(project, notify);
    successCount++;
  }
  const remote = await (await request(ROUTES.workspaces)).json();
  for (const project of remote) await pullProject(project, notify);
  return { successCount, failCount: 0 };
}
