import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../../../services/offline/IndexedDB', () => ({
  default: {
    saveWorkspace: vi.fn().mockResolvedValue(undefined),
    getWorkspace: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../../../../services/offline/LocalMedia', () => ({ get: vi.fn() }));

vi.mock('../../../Mediator', () => ({
  default: {
    registerVideo: vi.fn(),
    registerUploader: vi.fn(),
    onVideoDeleted: vi.fn(),
    onLoadVideo: vi.fn()
  }
}));

vi.mock('../../../../services/workspace', () => ({
  getRouteUrl: vi.fn(() => '/api/video'),
  getUuid: vi.fn(() => 'test-uuid'),
  getTrackUrl: vi.fn(id => `/audio/${id}`),
  getDerivedTrackUrl: vi.fn(id => `/audio/derived/${id}`),
  invalidateCache: vi.fn()
}));

vi.mock('../../../../lib', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    MasterClock: { registerVideo: vi.fn() },
    isOnline: () => true
  };
});

const eventListeners = new Map();

vi.mock('../../../../services/EventService', () => ({
  on: vi.fn((event, callback) => {
    if (!eventListeners.has(event)) eventListeners.set(event, new Set());
    eventListeners.get(event).add(callback);
    return () => eventListeners.get(event)?.delete(callback);
  }),
  emitLocal: vi.fn((event, payload) => {
    eventListeners.get(event)?.forEach(cb => cb(payload));
  })
}));

vi.mock('../../../../config/ui', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    RESIZE_BOUNDS: { defaultHeightPercent: 0.4, minHeightPercent: 0.2 },
    UPLOAD: { VIDEO_EXTENSIONS: '.mp4,.webm,.mov' }
  };
});

vi.mock('../../../../config/constants', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    LABEL: { ...actual.LABEL, NO_VIDEO: 'No video', IMPORT_VIDEO: 'Import', CHANGE_VIDEO: 'Change' }
  };
});

describe('VideoPresenter', () => {
  let VideoPresenter;
  let EventService;
  let $parent;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(async () => {
    vi.resetModules();
    eventListeners.clear();
    document.body.innerHTML = '<div class="studio-preview"></div>';
    $parent = document.querySelector('.studio-preview');
    VideoPresenter = (await import('../VideoPresenter.js')).default;
    EventService = await import('../../../../services/EventService');
  });

  it('hides empty state on VIDEO_LOADED event', () => {
    new VideoPresenter($parent);
    const emptyState = $parent.querySelector('.video-empty-state');

    expect(emptyState.classList.contains('hide')).toBe(false);

    EventService.emitLocal('video:loaded', {});

    expect(emptyState.classList.contains('hide')).toBe(true);
  });

  it('shows empty state on VIDEO_DELETED event', () => {
    new VideoPresenter($parent);
    const emptyState = $parent.querySelector('.video-empty-state');

    EventService.emitLocal('video:loaded', {});
    expect(emptyState.classList.contains('hide')).toBe(true);

    EventService.emitLocal('video:deleted', {});
    expect(emptyState.classList.contains('hide')).toBe(false);
  });

  it('hides video container on VIDEO_DELETED event', () => {
    new VideoPresenter($parent);
    const videoContainer = $parent.querySelector('.content-video');

    videoContainer.classList.remove('hide');
    expect(videoContainer.classList.contains('hide')).toBe(false);

    EventService.emitLocal('video:deleted', {});
    expect(videoContainer.classList.contains('hide')).toBe(true);
  });

  it('restores video metadata and falls back to the cached preview when the server is unavailable', async () => {
    const IndexedDB = (await import('../../../../services/offline/IndexedDB')).default;
    const urls = { file: '/video/file', offline: '/video/small' };
    IndexedDB.getWorkspace.mockResolvedValueOnce({
      videoInfo: { duration: 10000, displayAspectRatio: '16:9', urls }
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    vi.stubGlobal('caches', {
      match: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(new Response('cached video'))
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cached-video');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const presenter = new VideoPresenter($parent);

    try {
      expect(await presenter.load()).toMatchObject({ duration: 10, urls });
      await vi.waitFor(() => {
        expect($parent.querySelector('source').getAttribute('src')).toBe('blob:cached-video');
      });
      expect(fetch).not.toHaveBeenCalled();
      expect(caches.match).toHaveBeenCalledWith(
        new URL('/video/small', window.location.origin).href
      );
    } finally {
      presenter.destroy();
    }
  });

  it('keeps missing video metadata available for saving and opens without a server request', async () => {
    const IndexedDB = (await import('../../../../services/offline/IndexedDB')).default;
    const LocalMedia = await import('../../../../services/offline/LocalMedia');
    const { MasterClock } = await import('../../../../lib');
    const urls = { file: '/video/file', offline: '/video/small' };
    IndexedDB.getWorkspace.mockResolvedValue({
      video: urls.file,
      videoInfo: { duration: 10000, displayAspectRatio: '16:9', localMediaId: 'missing', urls }
    });
    LocalMedia.get.mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('caches', { match: vi.fn().mockResolvedValue(undefined) });
    const presenter = new VideoPresenter($parent);

    try {
      expect(await presenter.load()).toMatchObject({ url: null, duration: 10, urls });
      expect(presenter.hasVideo()).toBe(false);
      expect(presenter.getData()).toMatchObject({ src: urls.file, duration: 10, urls });
      expect($parent.textContent).toContain('Use Sync server');
      expect($parent.querySelector('.content-video').classList.contains('hide')).toBe(false);
      expect($parent.querySelector('source').hasAttribute('src')).toBe(false);
      expect(MasterClock.registerVideo).toHaveBeenLastCalledWith(null);
      expect(fetch).not.toHaveBeenCalled();

      LocalMedia.get.mockResolvedValue({ blob: new Blob(['downloaded video']) });
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:downloaded-video');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      expect(await presenter.load()).toMatchObject({ url: 'blob:downloaded-video', duration: 10 });
      expect(presenter.hasVideo()).toBe(true);
      expect($parent.querySelector('source').getAttribute('src')).toBe('blob:downloaded-video');
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      presenter.destroy();
    }
  });

  it('preserves the video reference when an older project has no local video metadata', async () => {
    const IndexedDB = (await import('../../../../services/offline/IndexedDB')).default;
    IndexedDB.getWorkspace.mockResolvedValue({
      video: '/video/file',
      tracks: [{ startTime: 600, durationTime: 100 }]
    });
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('caches', { match: vi.fn().mockResolvedValue(undefined) });
    const presenter = new VideoPresenter($parent);
    try {
      expect(await presenter.load()).toMatchObject({ url: null, duration: 700 });
      expect(presenter.getData()).toMatchObject({ src: '/video/file', duration: 700 });
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      presenter.destroy();
    }
  });
});
