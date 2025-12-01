import { createElement, View, createFileInput } from '../../../lib';
import { RESIZE_BOUNDS, UPLOAD, CSS_CLASS } from '../../../config/ui';
import { EVENT } from '../../../config/constants';
import * as EventService from '../../../services/EventService';
import {
  createPlayer,
  createResizer,
  createOfflineOverlay,
  createQualityBadge,
  createEmptyState,
  createUploadProgress,
  createVideoActions
} from './view';

export default class VideoView extends View {
  #$videoContainer = null;
  #$uploaderContainer = null;
  #$fileInput = null;
  #player = null;
  #offlineOverlay = null;
  #qualityBadge = null;
  #emptyState = null;
  #uploadProgress = null;
  #videoActions = null;
  #displayAspectRatio = '';

  handlers = {};

  constructor($parent) {
    super($parent);
  }

  render() {
    this.#$fileInput = createFileInput({
      accept: UPLOAD.VIDEO_EXTENSIONS,
      parent: this.$parent
    });

    this.#$fileInput.addEventListener('change', event => {
      this.handlers.onFileSelect?.(event.target.files);
      event.target.value = '';
    });

    this.#$videoContainer = createElement('div', {
      className: `${CSS_CLASS.VIDEO_CONTAINER} ${CSS_CLASS.HIDE}`,
      parent: this.$parent
    });

    this.#player = createPlayer(this.#$videoContainer);
    createResizer(this.#$videoContainer, () => this.#$videoContainer.getBoundingClientRect());
    this.#offlineOverlay = createOfflineOverlay(this.#$videoContainer);
    this.#qualityBadge = createQualityBadge(this.#$videoContainer);

    this.#$uploaderContainer = createElement('div', {
      className: CSS_CLASS.VIDEO_UPLOADER,
      parent: this.$parent
    });

    this.#emptyState = createEmptyState(this.#$uploaderContainer);
    this.#emptyState.bind({
      onImport: () => this.openFilePicker()
    });

    this.#uploadProgress = createUploadProgress(this.#$uploaderContainer);

    this.#videoActions = createVideoActions(this.#$uploaderContainer);
    this.#videoActions.bind({
      onChange: () => this.openFilePicker(),
      onDelete: () => this.handlers.onDelete?.(),
      onSceneDetect: () => this.handlers.onSceneDetect?.()
    });

    this.$node = this.#$videoContainer;
  }

  openFilePicker() {
    this.#$fileInput?.click();
  }

  show() {
    this.#$videoContainer.classList.remove(CSS_CLASS.HIDE);
  }

  hide() {
    this.#$videoContainer.classList.add(CSS_CLASS.HIDE);
  }

  setLoading(isLoading) {
    this.#$videoContainer.classList.toggle(CSS_CLASS.LOADING, isLoading);
  }

  setDisplayAspectRatio(ratio) {
    this.#displayAspectRatio = ratio;
  }

  getDisplayAspectRatio() {
    return this.#displayAspectRatio;
  }

  resize(requestedHeight = 0) {
    if (!this.#displayAspectRatio) {
      return;
    }

    const bounds = RESIZE_BOUNDS;
    const [widthRatio, heightRatio] = this.#displayAspectRatio.split(':');
    const aspectRatio = heightRatio / widthRatio;

    const viewportHeight = window.innerHeight;
    const defaultHeight = viewportHeight * bounds.defaultHeightPercent;
    const maxWidth = document.body.offsetWidth * 0.6;
    const minHeight = viewportHeight * bounds.minHeightPercent;

    const targetHeight = requestedHeight === 0 ? defaultHeight : requestedHeight;
    let calculatedWidth = targetHeight / aspectRatio;
    let calculatedHeight = targetHeight;

    if (calculatedWidth > maxWidth) {
      calculatedWidth = maxWidth;
      calculatedHeight = calculatedWidth * aspectRatio;
    }

    if (calculatedHeight < minHeight) {
      return;
    }

    this.#$videoContainer.style.width = calculatedWidth + 'px';
    this.#$videoContainer.style.height = calculatedHeight + 'px';

    EventService.emitLocal(EVENT.VIDEO_RESIZED, {
      width: calculatedWidth,
      height: calculatedHeight
    });
  }

  getPlayerElement() {
    return this.#player.el;
  }

  setSrc(url) {
    this.#player.setSrc(url);
  }

  play() {
    this.#player.play();
  }

  pause() {
    this.#player.pause();
  }

  setCurrentTime(time) {
    this.#player.setCurrentTime(time);
  }

  getCurrentTime() {
    return this.#player.getCurrentTime();
  }

  getDuration() {
    return this.#player.getDuration();
  }

  isPlaying() {
    return this.#player.isPlaying();
  }

  resetPlayer() {
    this.#player.reset();
    this.setLoading(true);
  }

  showOfflineOverlay() {
    this.#offlineOverlay.show();
    this.#player.hide();
  }

  hideOfflineOverlay() {
    this.#offlineOverlay.hide();
    this.#player.show();
  }

  showQualityBadge() {
    this.#qualityBadge.show();
  }

  hideQualityBadge() {
    this.#qualityBadge.hide();
  }

  showEmptyState() {
    this.#emptyState.show();
    this.#videoActions.hide();
    this.#uploadProgress.hide();
  }

  showVideoActions() {
    this.#emptyState.hide();
    this.#uploadProgress.hide();
    this.#videoActions.show();
  }

  showUploadProgress(fileName, fileSize) {
    this.#emptyState.hide();
    this.#videoActions.hide();
    this.#uploadProgress.show(fileName, fileSize);
  }

  updateUploadProgress(percent, fileName) {
    this.#uploadProgress.updateProgress(percent, fileName);
  }

  showConversionProgress() {
    this.#emptyState.hide();
    this.#uploadProgress.showConverting();
  }

  hideUploadProgress() {
    this.#uploadProgress.hide();
  }
}
