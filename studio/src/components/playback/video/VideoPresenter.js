import Mediator from '../../Mediator';
import ConfirmModal from '../../core/ConfirmModal';
import { getUuid } from '../../../services/workspace';
import IndexedDB from '../../../services/offline/IndexedDB';
import * as LocalMedia from '../../../services/offline/LocalMedia';
import { MasterClock, isOnline } from '../../../lib';
import { ERROR_CONTEXT, EVENT, LABEL } from '../../../config/constants';
import ErrorHandler from '../../../services/ErrorHandler';
import * as EventService from '../../../services/EventService';
import * as apiService from '../../../services/api';
import * as JobTrackerService from '../../../services/JobTrackerService';
import VideoView from './VideoView';
import VideoUpload from './VideoUpload';

export default class VideoPresenter {
  #view = null;
  #localUrl = null;
  #upload = null;
  #hasVideo = false;
  #urls = null;
  #usingOfflineVideo = false;
  #unsubscribeVideoLoaded = null;
  #unsubscribeVideoDeleted = null;

  constructor($parent) {
    this.#view = new VideoView($parent);
    this.#upload = new VideoUpload();

    this.#upload.setView(this.#view);
    this.#upload.setCallbacks({
      getState: () => {
        const current = Mediator.getData();
        return { ...current.navigator, transcriptions: current.transcriptions };
      },
      onLoadVideo: async () => {
        const saved = await apiService.load();
        await Mediator.onLoadVideo(null, saved);
      }
    });

    this.#view.render();
    this.#bindViewHandlers();
    this.#bindEvents();

    Mediator.registerVideo(this);
    Mediator.registerUploader(this);
  }

  #bindViewHandlers() {
    this.#view.getPlayerElement().addEventListener('error', this.#handlePlaybackError, true);
    this.#view.handlers = {
      onFileSelect: files => this.#upload.handleFileSelect(files),
      onDelete: () => this.#handleDelete(),
      onSceneDetect: () => this.#handleSceneDetect()
    };
  }

  #bindEvents() {
    this.#unsubscribeVideoLoaded = EventService.on(EVENT.VIDEO_LOADED, () => {
      this.#view.showVideoActions();
    });

    this.#unsubscribeVideoDeleted = EventService.on(EVENT.VIDEO_DELETED, () => {
      this.#view.hide();
      this.#view.showEmptyState();
    });
  }

  hasVideo() {
    return this.#hasVideo;
  }

  show() {
    this.#view.show();
  }

  hide() {
    this.#view.hide();
  }

  resize(height = 0) {
    this.#view.resize(height);
  }

  async load() {
    try {
      const response = (await IndexedDB.getWorkspace(getUuid()))?.videoInfo;
      if (!response)
        throw new Error('Video metadata is not on this device. Use Sync server first.');

      if (Object.keys(response).length === 0) {
        this.#hasVideo = false;
        throw Error('no video found');
      }

      this.#hasVideo = true;
      this.#view.setLoading(false);
      this.#view.show();
      this.#view.hideOfflineOverlay();
      this.#view.hideQualityBadge();

      const duration = response.duration / 1000;
      this.#view.setDisplayAspectRatio(response.displayAspectRatio);
      this.#urls = response.urls;
      this.#usingOfflineVideo = false;

      if (this.#localUrl) URL.revokeObjectURL(this.#localUrl);
      this.#localUrl = null;
      const local = response.localMediaId
        ? await LocalMedia.get(getUuid(), response.localMediaId)
        : null;
      let videoSrc;
      if (local?.blob) {
        this.#localUrl = URL.createObjectURL(local.blob);
        videoSrc = this.#localUrl;
      } else {
        videoSrc = await this.#getOfflineVideoSrc();
        if (!this.#usingOfflineVideo)
          throw new Error('Video is not on this device. Use Sync server first.');
      }
      this.#view.getPlayerElement().volume = response.isMuteVideo ? 0 : 1;
      this.#view.setSrc(videoSrc);
      this.#view.resize();

      MasterClock.registerVideo(this.#view.getPlayerElement());

      return {
        url: videoSrc,
        duration,
        displayAspectRatio: response.displayAspectRatio,
        tracks: [],
        urls: this.#urls
      };
    } catch (err) {
      this.#hasVideo = false;

      if (!isOnline()) {
        this.#view.show();
        this.#view.showOfflineOverlay();
      } else {
        this.#view.hide();
      }

      throw err;
    }
  }

  async #getOfflineVideoSrc() {
    if (!this.#urls) {
      return null;
    }

    const offlineSrc = this.#urls.offline;

    try {
      const url = new URL(offlineSrc, window.location.origin);
      const cacheKey = url.origin + url.pathname;
      const cached = await caches.match(cacheKey);

      if (cached) {
        this.#usingOfflineVideo = true;
        this.#view.showQualityBadge();
        return offlineSrc;
      }
    } catch (err) {
      console.log('[Video] Cache check failed:', err);
    }

    return this.#urls.file;
  }

  #handlePlaybackError = async () => {
    if (!this.#urls) return;
    if (this.#localUrl) {
      this.#view.showOfflineOverlay();
      return;
    }

    if (!this.#usingOfflineVideo) {
      const source = await this.#getOfflineVideoSrc();
      if (this.#usingOfflineVideo) {
        this.#view.setSrc(source);
        return;
      }
    }

    this.#view.showOfflineOverlay();
  };

  async #handleSceneDetect() {
    try {
      const { jobId } = await apiService.startSceneDetection();

      if (!jobId) {
        throw new Error('Failed to start scene detection');
      }

      JobTrackerService.track(jobId, {
        type: 'scene-detect',
        audioId: 'video',
        filename: 'video',
        audioDurationMs: (this.getDuration() || 0) * 1000
      });
    } catch (error) {
      ErrorHandler.handle(error, ERROR_CONTEXT.SCENE_DETECTION);
    }
  }

  async #handleDelete() {
    const confirmed = await ConfirmModal.show({
      title: LABEL.DELETE_VIDEO,
      message: LABEL.DELETE_VIDEO + '?',
      confirmText: LABEL.DELETE,
      danger: true
    });

    if (!confirmed) return;

    try {
      const previous = await IndexedDB.getWorkspace(getUuid());
      const current = Mediator.getData();
      const project = { ...current.navigator, transcriptions: current.transcriptions };
      await IndexedDB.saveWorkspace(getUuid(), { videoInfo: null, isVideoLoaded: false });
      await IndexedDB.saveWorkspaceBackup(getUuid(), {
        video: null,
        tracks: project?.tracks || [],
        markers: project?.markers || [],
        transcriptions: project?.transcriptions || {}
      });
      if (previous?.videoInfo?.localMediaId)
        await LocalMedia.remove(getUuid(), previous.videoInfo.localMediaId);
      if (this.#localUrl) URL.revokeObjectURL(this.#localUrl);
      this.#localUrl = null;
      this.#view.resetPlayer();
      this.#hasVideo = false;
      this.#urls = null;
      Mediator.onVideoDeleted();
    } catch (err) {
      console.error('Failed to delete video:', err);
    }
  }

  getDuration() {
    return this.#view.getDuration();
  }

  setCurrentTime(time) {
    if (isNaN(time) || time < 0) {
      throw new Error('wrong input: current time is ' + time);
    }

    this.#view.setCurrentTime(time);
    return true;
  }

  getCurrentTime() {
    return this.#view.getCurrentTime();
  }

  isPlaying() {
    return this.#view.isPlaying();
  }

  play() {
    this.#view.play();
    return true;
  }

  stop(time) {
    if (isNaN(time) || time < 0) {
      throw new Error('wrong input: current time is ' + time);
    }

    this.#view.pause();
    this.#view.setCurrentTime(time);
    return true;
  }

  getData() {
    return {
      src: this.#urls?.file || '',
      duration: this.getDuration(),
      displayAspectRatio: this.#view.getDisplayAspectRatio(),
      urls: this.#urls
    };
  }

  reset() {
    this.#view.resetPlayer();
    this.#hasVideo = false;
  }

  showEmptyState() {
    this.#view.showEmptyState();
  }

  isActive() {
    return this.#upload.isActive();
  }

  openFilePicker() {
    this.#view.openFilePicker();
  }

  destroy() {
    if (this.#localUrl) URL.revokeObjectURL(this.#localUrl);
    this.#view.getPlayerElement().removeEventListener('error', this.#handlePlaybackError, true);
    this.#unsubscribeVideoLoaded?.();
    this.#unsubscribeVideoDeleted?.();
  }
}
