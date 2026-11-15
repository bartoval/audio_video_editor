import IndexedDB, { STORES } from './IndexedDB';
import { getUuid } from '../workspace';
import { formatDuration } from '../../lib/utils/format';

const urls = new Map();
const keyFor = (uuid, id) => `${uuid}:${id}`;
const db = () => IndexedDB.getInstance();

export const list = uuid => db().getByIndex(STORES.LOCAL_MEDIA, 'workspaceUuid', uuid);
export const get = (uuid, id) => db().get(STORES.LOCAL_MEDIA, keyFor(uuid, id));
export const put = record => db().put(STORES.LOCAL_MEDIA, record);
export const markSynced = key => db().markMediaSynced(key);

export async function store(uuid, id, blob, metadata, kind = 'audio', synced = false) {
  const record = {
    key: keyFor(uuid, id),
    workspaceUuid: uuid,
    id,
    blob,
    metadata,
    kind,
    synced,
    deleted: false,
    updatedAt: Date.now()
  };
  await put(record);
  return record;
}

export async function audioRecord(uuid, id) {
  const local = await get(uuid, id);
  if (local?.deleted) return null;
  return local || IndexedDB.getAudioBlob(uuid, id);
}

export async function audioUrl(id) {
  const uuid = getUuid();
  const record = await audioRecord(uuid, id);
  if (!record?.blob)
    throw new Error('This audio is not on this device. Use Sync server to download it.');
  const key = keyFor(uuid, id);
  if (!urls.has(key)) urls.set(key, URL.createObjectURL(record.blob));
  return urls.get(key);
}

export async function remove(uuid, id) {
  const record = await get(uuid, id);
  if (record) await put({ ...record, deleted: true, blob: null });
  else
    await put({
      key: keyFor(uuid, id),
      workspaceUuid: uuid,
      id,
      kind: 'audio',
      deleted: true,
      synced: true
    });
  const key = keyFor(uuid, id);
  if (urls.has(key)) {
    URL.revokeObjectURL(urls.get(key));
    urls.delete(key);
  }
}

export async function library(uuid = getUuid()) {
  const project = await IndexedDB.getWorkspace(uuid);
  let items = project?.audioLibrary || {};
  // Migrate an existing offline library catalogue without making a request.
  if (!project?.audioLibrary && typeof caches !== 'undefined') {
    const response = await caches.match(`/api/v1/workspaces/${uuid}/audio`);
    if (response?.ok) items = await response.json();
  }
  items = { ...items };
  for (const record of await list(uuid)) {
    if (record.kind !== 'audio') continue;
    if (record.deleted) delete items[record.id];
    else items[record.id] = record.metadata;
  }
  return items;
}

export async function importAudio(file, uuid = getUuid()) {
  const context = new AudioContext();
  let metadata;
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    metadata = {
      name: file.name.replace(/\.[^.]+$/, ''),
      duration: buffer.duration * 1000,
      durationFormatted: formatDuration(buffer.duration),
      channels: buffer.numberOfChannels,
      sampleRate: buffer.sampleRate,
      format: file.name.split('.').pop().toLowerCase(),
      fileSize: file.size,
      createdAt: new Date().toISOString()
    };
  } catch {
    throw new Error(`The browser cannot decode "${file.name}". Import a supported audio format.`);
  } finally {
    await context.close();
  }
  const extension = file.name.split('.').pop().toLowerCase();
  const id = `${crypto.randomUUID()}.${extension}`;
  metadata.id = id;
  await store(uuid, id, file, { ...metadata, filename: file.name });
  return { status: 'complete', file: id, metadata };
}

export async function importVideo(file, uuid = getUuid(), getState) {
  const video = document.createElement('video');
  const url = URL.createObjectURL(file);
  let metadata;
  try {
    metadata = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Video metadata timed out')), 15000);
      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        if (!Number.isFinite(video.duration) || video.duration <= 0 || !video.videoWidth) {
          reject(new Error('Unsupported video duration or dimensions'));
          return;
        }
        resolve({
          duration: video.duration * 1000,
          displayAspectRatio: `${video.videoWidth}:${video.videoHeight}`,
          isMuteVideo: true
        });
      };
      video.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('The browser cannot play this video format.'));
      };
      video.preload = 'metadata';
      video.src = url;
    });
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
  const id = `${crypto.randomUUID()}.${file.name.split('.').pop().toLowerCase()}`;
  const base = `/api/v1/workspaces/${uuid}/video`;
  const info = {
    ...metadata,
    id,
    name: file.name,
    localMediaId: id,
    urls: { file: `${base}/file`, offline: `${base}/small`, thumbnails: `${base}/thumbnails` }
  };
  await store(uuid, id, file, { filename: file.name, ...metadata }, 'video');
  const previous = await IndexedDB.getWorkspace(uuid);
  const project = getState ? getState() : previous;
  await IndexedDB.saveWorkspace(uuid, { videoInfo: info, isVideoLoaded: true });
  await IndexedDB.saveWorkspaceBackup(uuid, {
    video: info.urls.file,
    tracks: project?.tracks || [],
    markers: project?.markers || [],
    transcriptions: project?.transcriptions || {}
  });
  if (previous?.videoInfo?.localMediaId) await remove(uuid, previous.videoInfo.localMediaId);
  return info;
}
