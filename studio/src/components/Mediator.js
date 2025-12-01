// @ts-check

/**
 * Mediator - central coordinator for component communication
 *
 * Implements mediator pattern to decouple components. Handles:
 * - Component registration (video, player, navigator, uploader)
 * - Playback control delegation to PlaybackController
 * - Video loading and lifecycle events
 * - Event bus wiring for cross-component communication
 */
import { EVENT, AUDIO_ONLY, WARNING } from '../config/constants';
import { isOnline } from '../lib';
import LayoutManager from '../services/LayoutManager';
import PlaybackController from '../services/PlaybackController';
import { OfflinePrefetch } from '../services/offline';
import * as EventService from '../services/EventService';
import { playbackStore, workspaceStore, uiStore, transcriptionStore } from '../store';

class Mediator {
  /** @type {any} */
  #player = null;
  /** @type {any} */
  #navigator = null;
  /** @type {any} */
  #video = null;
  /** @type {any} */
  #uploader = null;
  /** @type {Array<() => void>} */
  #eventUnsubscribes = [];

  constructor() {
    LayoutManager.init();
    PlaybackController.startLoop();

    this.#eventUnsubscribes = [
      EventService.on(EVENT.WORKSPACE_GET_DATA, () => {
        const stageData = this.#navigator.getData();
        const videoData = this.#video.getData();
        const { duration } = playbackStore.getState();
        const { transcriptions } = transcriptionStore.getState();

        return { navigator: stageData, video: videoData, duration, transcriptions };
      }),
      EventService.on(EVENT.WORKSPACE_LOAD_VIDEO, async ({ url, config }) => {
        try {
          const params = await this.#video.load(url);
          config.duration = params.duration;
          config.url = params.url;
          config.displayAspectRatio = params.displayAspectRatio;
          config.tracks = config.tracks === undefined ? params.tracks : config.tracks;
          workspaceStore.actions.setVideo(config.url || null, {
            duration: config.duration,
            displayAspectRatio: config.displayAspectRatio
          });

          await this.#initPlayback(config);

          if (isOnline()) {
            const stageData = this.#navigator?.getData() || {};
            const videoData = this.#video?.getData() || {};
            OfflinePrefetch.prefetch({ navigator: stageData, video: videoData });
          }

          EventService.emitLocal(EVENT.VIDEO_LOADED, { video: config, duration: config.duration });

          const maxAudioEnd = this.#navigator?.tracks?.getMaxEndTime() || 0;

          if (maxAudioEnd > config.duration) {
            uiStore.actions.pushToast({
              type: 'warning',
              msg: WARNING.AUDIO_EXCEEDS_VIDEO
            });
          }

          return { success: true };
        } catch (err) {
          if (this.#uploader) {
            EventService.emitLocal(EVENT.VIDEO_DELETED);
          }

          throw err;
        }
      }),
      EventService.on(EVENT.WORKSPACE_INIT_AUDIO_ONLY, async config => {
        const { DEFAULT_DURATION, MIN_DURATION } = AUDIO_ONLY;
        const maxAudioEnd = config.maxAudioEnd || 0;
        const duration = Math.max(MIN_DURATION, DEFAULT_DURATION, maxAudioEnd);

        config.duration = duration;

        PlaybackController.init(duration);
        this.#player.initAudioOnly(duration);

        await this.#navigator.init(duration, config);

        LayoutManager.resize();

        return { success: true };
      })
    ];
  }

  /** @param {any} videoInstance */
  registerVideo(videoInstance) {
    this.#video = videoInstance;
    LayoutManager.registerVideo(videoInstance);
    PlaybackController.registerVideo(videoInstance);
  }

  /** @param {any} playerInstance */
  registerPlayer(playerInstance) {
    this.#player = playerInstance;
    LayoutManager.registerPlayer(playerInstance);
  }

  /** @param {any} navigatorInstance */
  registerNavigator(navigatorInstance) {
    this.#navigator = navigatorInstance;
    LayoutManager.registerNavigator(navigatorInstance);
    PlaybackController.registerNavigator(navigatorInstance);
  }

  /** @param {any} uploaderInstance */
  registerUploader(uploaderInstance) {
    this.#uploader = uploaderInstance;
  }

  getData() {
    const stageData = this.#navigator.getData();
    const videoData = this.#video.getData();
    const { duration } = playbackStore.getState();
    const { transcriptions } = transcriptionStore.getState();

    return { navigator: stageData, video: videoData, duration, transcriptions };
  }

  hasVideo() {
    const state = workspaceStore.getState();

    return Boolean(state.videoUrl || state.videoMeta);
  }

  isAudioOnly() {
    const hasVideoLoaded = this.#video?.hasVideo?.() ?? false;

    return !hasVideoLoaded;
  }

  onLoadVideo(url, config = {}) {
    return EventService.emitAsync(EVENT.WORKSPACE_LOAD_VIDEO, { url, config });
  }

  initAudioOnly(config = {}) {
    return EventService.emitAsync(EVENT.WORKSPACE_INIT_AUDIO_ONLY, config);
  }

  onVideoDeleted() {
    const { DEFAULT_DURATION, MIN_DURATION } = AUDIO_ONLY;

    if (this.#navigator) {
      this.#navigator.setThumbsLoading(true);

      const maxAudioEnd = this.#navigator.tracks?.getMaxEndTime() || 0;
      const newDuration = Math.max(MIN_DURATION, DEFAULT_DURATION, maxAudioEnd);

      playbackStore.actions.updateDuration(newDuration);
      this.#navigator.updateDuration(newDuration);
    }

    if (this.#uploader) {
      this.#uploader.showEmptyState();
    }

    workspaceStore.actions.clearVideo();
    EventService.emitLocal(EVENT.VIDEO_DELETED);
  }

  destroy() {
    this.#eventUnsubscribes.forEach(unsub => unsub?.());
    PlaybackController.destroy();
  }

  /**
   * @param {Object} metaInfo
   * @returns {Promise<boolean>}
   */
  async #initPlayback(metaInfo) {
    const { duration } = metaInfo;

    PlaybackController.init(duration);
    this.#player.init(duration, metaInfo);

    await this.#navigator.init(duration, metaInfo);

    LayoutManager.resize();

    return true;
  }
}

export default new Mediator();
