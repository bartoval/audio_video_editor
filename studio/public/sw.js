/**
 * Service Worker - Offline-first caching strategy
 *
 * Caching strategies:
 * - Static assets (JS, CSS, fonts): Cache-first
 * - API responses: Network-first with cache fallback
 * - Media files (video, audio): Cache-first for performance
 */

const CACHE_VERSION = 'v17';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
// Retain previously downloaded media/catalogues when updating the app shell.
const API_CACHE = 'api-v15';
const MEDIA_CACHE = 'media-v15';

// Max cache size in bytes (500MB)
const MAX_MEDIA_CACHE_SIZE = 500 * 1024 * 1024;
const AUDIO_DB_NAME = 'audio-video-sync';
const AUDIO_STORE = 'audioBlobs';
const AUDIO_CACHE_LIMIT = 500 * 1024 * 1024; // aligns with client IDB limit

// ============================================================================
// Static Assets to Precache
// ============================================================================

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.png',
  '/rubberband.wasm',
  '/rubberband.umd.min.js',
  '/rubberband-worker.js',
  '/audio-processor-worker.js',
  '/waveform-worker.js'
];

// ============================================================================
// Cache Patterns
// ============================================================================

/**
 * Worker files and WASM - must be cached for offline support
 */
const isWorkerFile = (url) =>
  url.pathname.endsWith('-worker.js') ||
  url.pathname.includes('worker.') ||
  url.pathname.endsWith('.wasm');

const isStaticAsset = (url) =>
  !isWorkerFile(url) && (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.wasm') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico')
  );

const isApiRequest = (url) =>
  url.pathname.startsWith('/api/');

const isMediaRequest = (url) =>
  url.pathname.startsWith('/api/video') ||
  url.pathname.startsWith('/api/studio/video') ||
  url.pathname.includes('/video/stream') ||        // /api/v1/workspaces/{uuid}/video/stream
  url.pathname.includes('/video/small') ||         // /api/v1/workspaces/{uuid}/video/small (offline version)
  url.pathname.includes('/video/file') ||          // /api/v1/workspaces/{uuid}/video/file (main video)
  (url.pathname.includes('/audio/') && (url.pathname.endsWith('/file') || url.pathname.includes('/derived/'))) ||  // Audio original (/audio/:id/file) and derived (/audio/:id/derived/:did)
  (url.pathname.includes('/video/thumbnails/') && !url.pathname.endsWith('.json'));  // Thumbnail tiles only (not manifests)

/**
 * Dynamic thumbnail generation - requires server, cannot work offline
 * Path: /api/studio/thumb/:uuid/:time (without 's')
 */
const isDynamicThumb = (url) =>
  url.pathname.match(/^\/api\/studio\/thumb\/[^/]+\/[\d.]+$/);

const isProjectsApi = (url) =>
  url.pathname === '/api/projects' ||
  url.pathname.startsWith('/api/projects/') ||
  url.pathname === '/api/v1/workspaces' ||
  url.pathname.startsWith('/api/v1/workspaces/');

const isWorkspaceLoadApi = (url) =>
  url.pathname.includes('/api/studio/load/') ||
  url.pathname.match(/\/api\/v1\/workspaces\/[^/]+$/);

const isAudioRequest = (url) =>
  url.pathname.includes('/audio/') &&
  (url.pathname.endsWith('/file') || url.pathname.includes('/derived/'));

/**
 * State endpoint - bypasses SW cache completely
 * Offline state is managed by IndexedDB in the app, not SW cache
 * Path: /api/v1/workspaces/:uuid/state
 */
const isStateEndpoint = (url) =>
  url.pathname.endsWith('/state');

/**
 * SSE (Server-Sent Events) endpoint - cannot be cached (streaming response)
 * Path: /api/v1/workspaces/:uuid/events
 */
const isSSEEndpoint = (url) =>
  url.pathname.endsWith('/events');

// ============================================================================
// Install Event
// ============================================================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing v15...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(async cache => {
        await cache.addAll(PRECACHE_ASSETS);

        // On the first visit JS/CSS may load before this worker takes control.
        // Vite's production manifest includes those files and their dependencies.
        const response = await fetch('/.vite/manifest.json', { cache: 'no-cache' });
        if (response.ok && response.headers.get('Content-Type')?.includes('application/json')) {
          const manifest = await response.json();
          const assets = Object.values(manifest).flatMap(entry =>
            [entry.file, ...(entry.css || []), ...(entry.assets || [])]
          );
          await cache.addAll([...new Set(assets)].map(asset => `/${asset}`));
        }
      })
      .then(() => {
        console.log('[SW] Precache complete, skipping waiting');

        return self.skipWaiting();
      })
  );
});

// ============================================================================
// Activate Event
// ============================================================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v15...');

  event.waitUntil(
    caches.keys()
      .then(keys => {
        const oldCaches = keys.filter(key =>
          key !== STATIC_CACHE && key !== API_CACHE && key !== MEDIA_CACHE
        );

        console.log('[SW] Deleting', oldCaches.length, 'old caches');

        return Promise.all(oldCaches.map(key => caches.delete(key)));
      })
      .then(() => {
        console.log('[SW] Claiming clients');

        return self.clients.claim();
      })
  );
});

// ============================================================================
// Fetch Event
// ============================================================================

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Explicit synchronization must reach the server, never accept cached success.
  if (event.request.headers.has('X-Project-Sync')) return;

  // Skip non-GET requests (POST, DELETE, etc.)
  if (event.request.method !== 'GET') {
    return;
  }

  // Worker files and WASM: Cache-first (needed for offline support)
  if (isWorkerFile(url)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));

    return;
  }

  // Skip dynamic thumbnails - require server-side generation, cannot cache
  if (isDynamicThumb(url)) {
    return;
  }

  // Skip state endpoint - offline state managed by IndexedDB, not SW cache
  if (isStateEndpoint(url)) {
    return;
  }

  // Skip SSE endpoint - streaming responses cannot be cached
  if (isSSEEndpoint(url)) {
    return;
  }

  // Media files: Cache-first (large files, don't re-download)
  if (isMediaRequest(url)) {
    // Audio: try IndexedDB (audioBlobs) first, then cache/network
    if (isAudioRequest(url)) {
      event.respondWith(audioFirst(event.request, MEDIA_CACHE));
    } else {
      event.respondWith(cacheFirst(event.request, MEDIA_CACHE));
    }

    return;
  }

  // Projects/Load API: Network-first with cache fallback
  if (isProjectsApi(url) || isWorkspaceLoadApi(url)) {
    event.respondWith(networkFirst(event.request, API_CACHE));

    return;
  }

  // Other API requests: Network-first
  if (isApiRequest(url)) {
    event.respondWith(networkFirst(event.request, API_CACHE));

    return;
  }

  // Static assets: Cache-first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));

    return;
  }

  // HTML pages: Network-first with offline fallback to cached index.html (SPA)
  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigation(event.request));

    return;
  }

  // Default: Network-first
  event.respondWith(networkFirst(event.request, STATIC_CACHE));
});

// ============================================================================
// Caching Strategies
// ============================================================================

/**
 * Audio-first strategy:
 * 1) Try IndexedDB audioBlobs
 * 2) Cache API
 * 3) Network (and cache)
 */
async function audioFirst(request, cacheName) {
  const url = new URL(request.url);
  const cacheKey = url.origin + url.pathname; // strip query for cache match

  // 1) IndexedDB lookup
  try {
    const blob = await getAudioFromIDB(url);

    if (blob) {
      return new Response(blob, {
        status: 200,
        headers: { 'Content-Type': blob.type || 'audio/mpeg' }
      });
    }
  } catch (err) {
    console.warn('[SW] IDB audio lookup failed:', err?.message || err);
  }

  // 2) Cache API
  const cache = await caches.open(cacheName);
  const cached = await cache.match(cacheKey);

  if (cached) {
    const rangeHeader = request.headers.get('Range');
    if (rangeHeader) {
      return createRangeResponse(cached, rangeHeader);
    }

    return cached;
  }

  // 3) Network
  try {
    const response = await fetch(request);

    if (!response || !response.ok) {
      return response;
    }

    // Cache the full response (clone to avoid locking body)
    cache.put(cacheKey, response.clone());
    trimMediaCache(cache, MAX_MEDIA_CACHE_SIZE);

    // Save to IDB (fire and forget)
    response.clone().blob().then(blob => {
      saveAudioToIDB(url, blob).catch(err => {
        console.warn('[SW] Failed to save audio to IDB:', err?.message || err);
      });
    });

    return response;
  } catch (error) {
    console.warn('[SW] Audio fetch failed:', error);

    return new Response('Offline', { status: 503 });
  }
}

/**
 * Cache-first: Try cache, fallback to network
 * For media files, ignores query string (?t=timestamp) when matching cache
 *
 * Special handling for video/audio Range requests:
 * - If cached: serve from cache (slicing for Range requests)
 * - If online: pass request through for streaming, cache full file in background
 * - If offline: return 503
 */
async function cacheFirst(request, cacheName) {
  // Create a cache key without query string for consistent matching
  const url = new URL(request.url);
  const cacheKey = url.origin + url.pathname;

  const cache = await caches.open(cacheName);
  const cached = await cache.match(cacheKey);

  // If cached, serve from cache
  if (cached) {
    const rangeHeader = request.headers.get('Range');

    if (rangeHeader) {
      return createRangeResponse(cached, rangeHeader);
    }

    return cached;
  }

  // Not in cache - try network
  try {
    // Pass original request through for normal streaming
    const response = await fetch(request);

    // If we got a complete response (200), cache it
    if (response.ok && response.status === 200) {
      try {
        await cache.put(cacheKey, response.clone());
        console.log('[SW] Cached media:', cacheKey);
      } catch (cacheError) {
        // Ignore cache errors
      }
    }

    // If we got partial (206), trigger background cache of full file
    if (response.status === 206) {
      cacheFullMedia(cacheKey, request.url, cache);
    }

    return response;
  } catch (error) {
    console.log('[SW] Cache-first fetch failed:', error);

    return new Response('Offline', { status: 503 });
  }
}

/**
 * Trim media cache to a size limit (best-effort)
 */
async function trimMediaCache(cache, maxBytes) {
  if (!cache || !maxBytes || maxBytes <= 0) {
    return;
  }

  try {
    const entries = await cache.keys();
    const sizes = [];

    for (const request of entries) {
      const res = await cache.match(request);
      const blob = res ? await res.blob() : null;
      sizes.push({
        request,
        size: blob?.size || 0,
        timestamp: res?.headers.get('Date') ? Date.parse(res.headers.get('Date')) : 0
      });
    }

    let total = sizes.reduce((sum, item) => sum + item.size, 0);

    sizes
      .sort((a, b) => a.timestamp - b.timestamp)
      .forEach(item => {
        if (total <= maxBytes) {
          return;
        }
        cache.delete(item.request);
        total -= item.size;
      });
  } catch (err) {
    // Best effort; ignore errors
  }
}

/**
 * Background cache of full media file (for Range requests)
 * Only caches ONE video at a time - clears old videos before caching new one
 */
async function cacheFullMedia(cacheKey, url, cache) {
  try {
    // Check if already cached
    const existing = await cache.match(cacheKey);

    if (existing) {
      return;
    }

    // If this is a video, clear other videos first (keep only current project)
    if (cacheKey.includes('/video/') || cacheKey.includes('/studio/video')) {
      await clearOtherVideos(cache, cacheKey);
    }

    // Fetch full file without Range header
    const response = await fetch(url, {
      headers: {} // No Range = full response
    });

    if (response.ok && response.status === 200) {
      await cache.put(cacheKey, response);
      console.log('[SW] Background cached:', cacheKey);
    }
  } catch (error) {
    console.log('[SW] Background cache failed:', cacheKey, error.message);
  }
}

/**
 * Clear all cached videos except the current one
 * Ensures only ONE video is cached at a time
 */
async function clearOtherVideos(cache, keepKey) {
  try {
    const keys = await cache.keys();

    for (const request of keys) {
      const url = request.url;

      // If it's a video and NOT the one we want to keep, delete it
      if ((url.includes('/video/') || url.includes('/studio/video')) && url !== keepKey) {
        await cache.delete(request);
        console.log('[SW] Cleared old video:', url);
      }
    }
  } catch (error) {
    console.log('[SW] Error clearing videos:', error.message);
  }
}

/**
 * Create a 206 Partial Content response from a full cached response
 */
async function createRangeResponse(fullResponse, rangeHeader) {
  const blob = await fullResponse.blob();
  const totalSize = blob.size;

  // Parse Range header: "bytes=0-" or "bytes=0-1023"
  const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);

  if (!match) {
    return fullResponse;
  }

  const start = match[1] ? parseInt(match[1], 10) : 0;
  const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;

  // Ensure valid range
  const actualEnd = Math.min(end, totalSize - 1);
  const slice = blob.slice(start, actualEnd + 1);

  return new Response(slice, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': fullResponse.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Length': slice.size,
      'Content-Range': `bytes ${start}-${actualEnd}/${totalSize}`,
      'Accept-Ranges': 'bytes'
    }
  });
}

// ============================================================================
// IndexedDB helpers for audio blobs (offline media)
// ============================================================================

const AUDIO_ORIGINAL_REGEX = /\/api\/(?:v1\/)?workspaces\/([^/]+)\/audio\/([^/]+)\/file/;
const AUDIO_DERIVED_REGEX = /\/api\/(?:v1\/)?workspaces\/([^/]+)\/audio\/derived\/([^/]+)/;

function buildAudioKeyFromUrl(url) {
  const derivedMatch = url.pathname.match(AUDIO_DERIVED_REGEX);

  if (derivedMatch) {
    const [, workspaceUuid, idTrack] = derivedMatch;

    return {
      key: `${workspaceUuid}:derived:${idTrack}`,
      workspaceUuid,
      idTrack,
      isDerived: true
    };
  }

  const match = url.pathname.match(AUDIO_ORIGINAL_REGEX);

  if (!match) return null;

  const [, workspaceUuid, idTrack] = match;

  return {
    key: `${workspaceUuid}:${idTrack}`,
    workspaceUuid,
    idTrack,
    isDerived: false
  };
}

async function openAudioDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(AUDIO_DB_NAME);

    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        const audioStore = db.createObjectStore(AUDIO_STORE, { keyPath: 'key' });
        audioStore.createIndex('workspaceUuid', 'workspaceUuid', { unique: false });
        audioStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        audioStore.createIndex('isDerived', 'isDerived', { unique: false });
      }
    };
  });
}

async function getAudioFromIDB(url) {
  const info = buildAudioKeyFromUrl(url);
  if (!info) return null;

  try {
    const db = await openAudioDB();
    const tx = db.transaction(AUDIO_STORE, 'readonly');
    const store = tx.objectStore(AUDIO_STORE);

    return await new Promise((resolve, reject) => {
      const req = store.get(info.key);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result?.blob || null);
    });
  } catch (err) {
    console.warn('[SW] IDB get failed:', err?.message || err);

    return null;
  }
}

async function saveAudioToIDB(url, blob) {
  const info = buildAudioKeyFromUrl(url);
  if (!info) return;

  try {
    const db = await openAudioDB();
    const tx = db.transaction(AUDIO_STORE, 'readwrite');
    const store = tx.objectStore(AUDIO_STORE);
    const record = {
      key: info.key,
      workspaceUuid: info.workspaceUuid,
      idTrack: info.idTrack,
      blob,
      size: blob.size,
      mimeType: blob.type || 'audio/mpeg',
      isDerived: Boolean(info.isDerived),
      sourceHash: null,
      updatedAt: Date.now()
    };

    return await new Promise((resolve, reject) => {
      const req = store.put(record);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  } catch (err) {
    console.warn('[SW] IDB save failed:', err?.message || err);
  }
}

/**
 * Handle navigation requests (SPA)
 * Network-first with fallback to cached index.html
 * For SPA, ANY route should serve index.html (client-side routing)
 */
async function handleNavigation(request) {
  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);

      // Cache as both the actual URL and root for SPA fallback
      try {
        await cache.put(request, response.clone());
        await cache.put('/', response.clone());
        await cache.put('/index.html', response.clone());
      } catch (cacheError) {
        // Ignore cache errors
      }
    }

    return response;
  } catch (error) {
    console.log('[SW] Navigation offline, serving cached index.html');

    // For SPA, always serve index.html when offline (any route)
    const cache = await caches.open(STATIC_CACHE);

    // Try multiple cache keys - SPA should work from any cached HTML
    const cached = await cache.match('/index.html') ||
                   await cache.match('/') ||
                   await caches.match('/index.html') ||
                   await caches.match('/');

    if (cached) {
      return cached;
    }

    // Return a minimal offline page with loader (prevents browser's "No Internet" page)
    return new Response(`<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Loading...</title>
  <style>
    body{margin:0;background:#212529;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column}
    .loader{width:60px;height:60px;border:3px solid transparent;border-top-color:#0dcaf0;border-radius:50%;animation:spin 1s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    .msg{color:#6c757d;margin-top:20px;text-align:center;font-family:system-ui}
  </style>
</head>
<body>
  <div class="loader"></div>
  <p class="msg">Waiting for connection...</p>
  <script>window.addEventListener('online',()=>location.reload())</script>
</body>
</html>`, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

/**
 * Network-first: Try network, fallback to cache
 * For API requests, strips query string from cache key for consistent matching
 */
async function networkFirst(request, cacheName) {
  // Create cache key without query string for API requests
  const url = new URL(request.url);
  const cacheKey = url.pathname.startsWith('/api/') ? url.origin + url.pathname : request;

  try {
    const response = await fetch(request);

    // Only cache complete responses (not 206 partial content)
    if (response.ok && response.status === 200) {
      const cache = await caches.open(cacheName);

      try {
        await cache.put(cacheKey, response.clone());
      } catch (cacheError) {
        // Ignore cache errors (opaque responses, quota exceeded, etc.)
      }
    }

    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);

    const cached = await caches.match(cacheKey);

    if (cached) {
      return cached;
    }

    // Return offline response for API requests
    if (request.url.includes('/api/')) {
      return new Response(
        JSON.stringify({ offline: true, error: 'No cached data available' }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response('Offline', { status: 503 });
  }
}

// ============================================================================
// Message Handler (for cache invalidation from main thread)
// ============================================================================

self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CLEAR_CACHE':
      caches.keys().then(keys =>
        Promise.all(keys.map(key => caches.delete(key)))
      );
      break;

    case 'CLEAR_API_CACHE':
      caches.delete(API_CACHE);
      break;

    case 'CACHE_WORKSPACE':
      if (payload?.uuid) {
        cacheWorkspaceData(payload.uuid);
      }
      break;

    case 'PREFETCH_OFFLINE':
      if (payload?.uuid) {
        prefetchOffline(payload.uuid, payload.audioUrls || [], payload.videoUrls || null, event.source);
      }
      break;

    case 'CHECK_OFFLINE_STATUS':
      if (payload?.uuid) {
        checkOfflineStatus(payload.uuid, event.source);
      }
      break;

    case 'INVALIDATE_AUDIO':
      // Invalidate specific audio from Cache API
      // IDB invalidation is handled by the client
      if (payload?.uuid && payload?.idTrack) {
        invalidateAudioCache(payload.uuid, payload.idTrack);
      }
      break;

    case 'INVALIDATE_WORKSPACE_AUDIO':
      // Invalidate all audio for a workspace from Cache API
      if (payload?.uuid) {
        invalidateWorkspaceAudioCache(payload.uuid);
      }
      break;

    case 'CLEAR_DERIVED_AUDIO':
      // Clear derived/processed audio from Cache API
      // Client handles IDB cleanup via IndexedDB.deleteDerivedAudioBlobs()
      if (payload?.uuid) {
        clearDerivedAudioCache(payload.uuid);
      }
      break;
  }
});

/**
 * Prefetch and cache workspace data
 */
async function cacheWorkspaceData(uuid) {
  const cache = await caches.open(API_CACHE);
  const urls = [
    `/api/studio/load/${uuid}`,
    `/api/projects`
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        await cache.put(url, response);
      }
    } catch (e) {
      console.log('[SW] Failed to cache:', url);
    }
  }
}

// ============================================================================
// Offline Prefetch
// ============================================================================

// Track current prefetch operation (for cancellation on workspace change)
let currentPrefetchUuid = null;
let prefetchAbortController = null;

/**
 * Prefetch all media for offline use (video small, audio tracks, thumbnail manifest)
 * Reports progress back to client via postMessage
 */
async function prefetchOffline(uuid, audioUrls, videoUrls, client) {
  // Cancel any existing prefetch
  if (prefetchAbortController) {
    prefetchAbortController.abort();
  }

  prefetchAbortController = new AbortController();
  currentPrefetchUuid = uuid;

  const cache = await caches.open(MEDIA_CACHE);

  // Clear other workspaces first (1 workspace only policy)
  await clearOtherWorkspaces(cache, uuid);

  // Build list of URLs to prefetch
  const urls = [];

  // Always prefetch video metadata (needed for offline urls)
  urls.push({ url: `/api/v1/workspaces/${uuid}/video`, type: 'metadata', cache: 'api' });

  // Use videoUrls from backend if available, otherwise fallback to hardcoded paths
  if (videoUrls?.offline) {
    urls.push({ url: videoUrls.offline, type: 'video' });
  } else {
    urls.push({ url: `/api/v1/workspaces/${uuid}/video/small`, type: 'video' });
  }

  if (videoUrls?.thumbnails) {
    urls.push({ url: `${videoUrls.thumbnails}/manifest.json`, type: 'manifest' });
  } else {
    urls.push({ url: `/api/v1/workspaces/${uuid}/video/thumbnails/manifest.json`, type: 'manifest' });
  }

  // Add audio library tracks
  for (const audioUrl of audioUrls) {
    urls.push({ url: audioUrl, type: 'audio' });
  }

  const total = urls.length;
  let completed = 0;
  let failed = 0;

  const sendProgress = (status) => {
    if (client) {
      client.postMessage({
        type: 'PREFETCH_PROGRESS',
        payload: {
          uuid,
          completed,
          total,
          failed,
          percent: Math.round((completed / total) * 100),
          status
        }
      });
    }
  };

  sendProgress('starting');

  const apiCache = await caches.open(API_CACHE);

  for (const item of urls) {
    const { url, type } = item;
    const targetCache = item.cache === 'api' ? apiCache : cache;

    // Check if aborted (workspace changed)
    if (prefetchAbortController.signal.aborted || currentPrefetchUuid !== uuid) {
      console.log('[SW] Prefetch aborted for:', uuid);
      sendProgress('aborted');

      return;
    }

    try {
      const cacheKey = new URL(url, self.location.origin).origin + new URL(url, self.location.origin).pathname;

      // Skip if already cached
      const existing = await targetCache.match(cacheKey);

      if (existing) {
        completed++;
        sendProgress('progress');

        continue;
      }

      // Fetch and cache
      const response = await fetch(url, { signal: prefetchAbortController.signal });

      if (response.ok) {
        await targetCache.put(cacheKey, response);
        console.log('[SW] Prefetch cached:', type, url);
      } else {
        console.log('[SW] Prefetch failed (non-ok):', type, url, response.status);
        failed++;
      }

      completed++;
      sendProgress('progress');
    } catch (error) {
      if (error.name === 'AbortError') {
        sendProgress('aborted');

        return;
      }

      console.log('[SW] Prefetch error:', type, url, error.message);
      failed++;
      completed++;
      sendProgress('progress');
    }
  }

  sendProgress('complete');
  console.log('[SW] Prefetch complete for:', uuid, { completed, failed });
}

/**
 * Check if workspace media is cached for offline use
 */
async function checkOfflineStatus(uuid, client) {
  const cache = await caches.open(MEDIA_CACHE);

  const videoSmallUrl = `/api/v1/workspaces/${uuid}/video/small`;
  const cacheKey = self.location.origin + videoSmallUrl;

  const cached = await cache.match(cacheKey);

  if (client) {
    client.postMessage({
      type: 'OFFLINE_STATUS',
      payload: {
        uuid,
        available: !!cached
      }
    });
  }
}

/**
 * Clear all cached media for workspaces other than the specified one
 * Implements "1 workspace only" policy
 */
async function clearOtherWorkspaces(cache, keepUuid) {
  try {
    const keys = await cache.keys();

    for (const request of keys) {
      const url = request.url;

      // Check if this is a workspace-specific media URL
      const workspaceMatch = url.match(/\/api\/v1\/workspaces\/([^/]+)\//);

      if (workspaceMatch) {
        const cachedUuid = workspaceMatch[1];

        // Delete if it's from a different workspace
        if (cachedUuid !== keepUuid) {
          await cache.delete(request);
          console.log('[SW] Cleared media from other workspace:', cachedUuid);
        }
      }
    }
  } catch (error) {
    console.log('[SW] Error clearing other workspaces:', error.message);
  }
}

// ============================================================================
// Audio Cache Invalidation
// ============================================================================

/**
 * Invalidate a specific audio track from Cache API
 * Called when audio source is modified/replaced
 *
 * @param {string} uuid - Workspace UUID
 * @param {string} idTrack - Track ID
 */
async function invalidateAudioCache(uuid, idTrack) {
  try {
    const cache = await caches.open(MEDIA_CACHE);
    const keys = await cache.keys();

    let deleted = 0;

    for (const request of keys) {
      const url = request.url;

      // Match audio URLs containing the track ID
      // Pattern: /api/v1/workspaces/{uuid}/audio/{idTrack}/file
      // Or: /api/audio/{idTrack}/file (legacy)
      if (url.includes(`/audio/${idTrack}/`) || url.includes(`/audio/${idTrack}`)) {
        await cache.delete(request);
        deleted++;
        console.log('[SW] Invalidated audio cache:', url);
      }
    }

    if (deleted === 0) {
      console.log('[SW] No cached audio found for track:', idTrack);
    }
  } catch (error) {
    console.log('[SW] Error invalidating audio cache:', error.message);
  }
}

/**
 * Invalidate all audio for a workspace from Cache API
 * Called when workspace is deleted or audio needs full refresh
 *
 * @param {string} uuid - Workspace UUID
 */
async function invalidateWorkspaceAudioCache(uuid) {
  try {
    const cache = await caches.open(MEDIA_CACHE);
    const keys = await cache.keys();

    let deleted = 0;

    for (const request of keys) {
      const url = request.url;

      // Match workspace-specific audio URLs
      if (url.includes(`/workspaces/${uuid}/`) && url.includes('/audio/')) {
        await cache.delete(request);
        deleted++;
      }
    }

    console.log('[SW] Invalidated', deleted, 'audio entries for workspace:', uuid);
  } catch (error) {
    console.log('[SW] Error invalidating workspace audio:', error.message);
  }
}

/**
 * Clear derived/processed audio from Cache API
 * Note: SW Cache API doesn't distinguish derived from source -
 * this clears all audio for the workspace. The client handles
 * IDB cleanup via IndexedDB.deleteDerivedAudioBlobs() which
 * does distinguish derived from source.
 *
 * @param {string} uuid - Workspace UUID
 */
async function clearDerivedAudioCache(uuid) {
  // For Cache API, we don't have metadata to distinguish derived from source
  // The client-side IDB has this metadata and handles selective cleanup
  // Here we just log for debugging - actual cleanup happens on IDB side
  console.log('[SW] clearDerivedAudioCache called for:', uuid);
  console.log('[SW] Note: Derived audio cleanup handled by client IndexedDB');

  // Optionally clear all audio if needed (uncomment if desired)
  // await invalidateWorkspaceAudioCache(uuid);
}
