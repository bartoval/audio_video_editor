import { describe, it, expect, beforeEach, vi } from 'vitest';

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
    LABEL: { NO_VIDEO: 'No video', IMPORT_VIDEO: 'Import', CHANGE_VIDEO: 'Change' }
  };
});

describe('VideoPresenter', () => {
  let VideoPresenter;
  let EventService;
  let $parent;

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
});
