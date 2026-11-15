import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../services/LayoutManager', () => ({
  default: {
    init: vi.fn(),
    registerVideo: vi.fn(),
    registerPlayer: vi.fn(),
    registerNavigator: vi.fn(),
    resize: vi.fn()
  }
}));

vi.mock('../../services/PlaybackController', () => ({
  default: {
    init: vi.fn(),
    registerVideo: vi.fn(),
    registerNavigator: vi.fn(),
    startLoop: vi.fn(),
    cleanup: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    resetPlayback: vi.fn(),
    rewind: vi.fn(),
    skipBack: vi.fn(),
    skipForward: vi.fn(),
    fastForward: vi.fn(),
    setTimeSlice: vi.fn(),
    moveFromNavigator: vi.fn(),
    moveFromPlayer: vi.fn()
  }
}));

vi.mock('../../services/offline', () => ({
  OfflinePrefetch: { prefetch: vi.fn() }
}));

vi.mock('../../lib', () => ({
  isOnline: () => false,
  MasterClock: {
    init: vi.fn(),
    setDuration: vi.fn()
  }
}));

const emitLocalMock = vi.fn();

vi.mock('../../services/EventService', () => {
  const listeners = new Map();
  return {
    emitLocal: vi.fn((event, payload) => {
      emitLocalMock(event, payload);
      listeners.get(event)?.forEach(cb => cb(payload));
    }),
    emitAsync: vi.fn((event, payload) => {
      const callbacks = listeners.get(event);

      if (!callbacks || callbacks.size === 0) {
        return Promise.reject(new Error(`No handler for event: ${event}`));
      }

      const handler = callbacks.values().next().value;

      try {
        const result = handler(payload);

        return result instanceof Promise ? result : Promise.resolve(result);
      } catch (err) {
        return Promise.reject(err);
      }
    }),
    on: vi.fn((event, cb) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(cb);
      return () => listeners.get(event)?.delete(cb);
    })
  };
});

describe('Mediator video events', () => {
  let Mediator;
  let workspaceStore;
  let storeConnectors;

  beforeEach(async () => {
    vi.resetModules();
    emitLocalMock.mockClear();
    document.body.innerHTML = `
      <div class="studio">
        <div class="studio-header"></div>
        <div class="studio-workspace"></div>
        <div class="studio-library"></div>
        <div class="studio-preview"></div>
        <div class="studio-timeline"></div>
      </div>
    `;
    workspaceStore = (await import('../../store')).workspaceStore;
    workspaceStore.actions.reset();
    storeConnectors = await import('../../store/storeConnectors');
    storeConnectors.initStoreConnectors();
    Mediator = (await import('../Mediator.js')).default;
  });

  afterEach(() => {
    storeConnectors?.destroyStoreConnectors();
  });

  it('adds has-video and updates workspace store on load', async () => {
    const video = {
      load: vi.fn().mockResolvedValue({
        duration: 10,
        displayAspectRatio: '16:9',
        tracks: [],
        url: '/video.mp4'
      }),
      getData: vi.fn().mockReturnValue({}),
      hasVideo: () => true
    };
    Mediator.registerVideo(video);
    Mediator.registerPlayer({ init: vi.fn() });
    Mediator.registerNavigator({
      init: vi.fn().mockResolvedValue(true),
      getData: vi.fn().mockReturnValue({}),
      tracks: { getMaxEndTime: vi.fn().mockReturnValue(0) }
    });

    await Mediator.onLoadVideo();

    expect(document.querySelector('.studio')?.classList.contains('has-video')).toBe(true);
    const state = workspaceStore.getState();
    expect(state.videoMeta?.duration).toBe(10);
    expect(state.videoMeta?.displayAspectRatio).toBe('16:9');
  });

  it('removes has-video and clears workspace store on delete', async () => {
    const navigator = {
      setThumbsLoading: vi.fn(),
      updateDuration: vi.fn(),
      tracks: { getMaxEndTime: vi.fn().mockReturnValue(0) }
    };
    const uploader = { showEmptyState: vi.fn() };
    Mediator.registerNavigator(navigator);
    Mediator.registerUploader(uploader);
    workspaceStore.actions.setVideo('/video.mp4', { duration: 5 });
    document.querySelector('.studio')?.classList.add('has-video');

    Mediator.onVideoDeleted();

    expect(document.querySelector('.studio')?.classList.contains('has-video')).toBe(false);
    expect(workspaceStore.getState().videoUrl).toBeNull();
    expect(navigator.setThumbsLoading).toHaveBeenCalledWith(true);
    expect(uploader.showEmptyState).toHaveBeenCalled();
    expect(emitLocalMock).toHaveBeenCalledWith('video:deleted', undefined);
  });

  it('initializes the saved timeline when the video is missing locally', async () => {
    const saved = {
      video: '/video/file',
      tracks: [{ id: 'track-1', startTime: 2, durationTime: 5 }],
      markers: [{ time: 3 }]
    };
    const navigator = {
      init: vi.fn().mockResolvedValue(true),
      tracks: { getMaxEndTime: vi.fn().mockReturnValue(7) }
    };
    Mediator.registerVideo({
      load: vi.fn().mockResolvedValue({ url: null, duration: 10, displayAspectRatio: '16:9' }),
      hasVideo: () => false
    });
    Mediator.registerPlayer({ init: vi.fn() });
    Mediator.registerNavigator(navigator);

    await expect(Mediator.onLoadVideo(saved.video, saved)).resolves.toEqual({ success: true });

    expect(navigator.init).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        video: '/video/file',
        tracks: saved.tracks,
        markers: saved.markers
      })
    );
    expect(workspaceStore.getState().videoMeta.duration).toBe(10);
    expect(document.querySelector('.studio').classList.contains('has-video')).toBe(true);
    expect(emitLocalMock).not.toHaveBeenCalledWith('video:deleted', undefined);
  });
});
