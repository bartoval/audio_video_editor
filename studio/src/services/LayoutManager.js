// @ts-check

/**
 * LayoutManager - App layout and resize logic
 *
 * Handles responsive layout calculations:
 * - registerVideo/Player/Navigator: component registration
 * - resize: recalculate layout from video dimensions
 * - init: setup window resize listener
 */
import { EVENT } from '../config/constants';
import * as EventService from './EventService';

const SELECTORS = {
  root: '.studio',
  header: '.studio-header',
  workspace: '.studio-workspace',
  library: '.studio-library',
  preview: '.studio-preview',
  timeline: '.studio-timeline'
};

class LayoutManager {
  #$root = null;
  #$header = null;
  #$workspace = null;
  #$library = null;
  #$preview = null;
  #$timeline = null;
  #video = null;
  #player = null;
  #navigator = null;
  #unsubscribeResize = null;
  #unsubscribeVideoResized = null;
  #videoDimensions = { width: 0, height: 0 };
  #boundOnWindowResize = null;

  registerVideo(videoInstance) {
    this.#video = videoInstance;
  }

  registerPlayer(playerInstance) {
    this.#player = playerInstance;
  }

  registerNavigator(navigatorInstance) {
    this.#navigator = navigatorInstance;
  }

  resize() {
    if (!this.#videoDimensions.width) {
      return;
    }

    const $header = this.#$header || document.querySelector(SELECTORS.header);
    const $workspace = this.#$workspace || document.querySelector(SELECTORS.workspace);
    const $library = this.#$library || document.querySelector(SELECTORS.library);
    const $preview = this.#$preview || document.querySelector(SELECTORS.preview);
    const $timeline = this.#$timeline || document.querySelector(SELECTORS.timeline);
    const $root = this.#$root || document.querySelector(SELECTORS.root);

    const totalHeight = $root.offsetHeight;
    const headerHeight = $header.offsetHeight;

    $preview.style.width = '';
    const previewHeight = $preview.offsetHeight;

    if (previewHeight) {
      $library.style.height = `${previewHeight}px`;
    }

    const workspaceHeight = $workspace.offsetHeight;
    const availableTimelineHeight = totalHeight - headerHeight - workspaceHeight;
    const minTimelineHeight = 200;
    $timeline.style.height = Math.max(minTimelineHeight, availableTimelineHeight) + 'px';

    if (this.#player) {
      this.#player.resize();
    }

    if (this.#navigator) {
      this.#navigator.resize();
    }
  }

  resizeFromVideo(height) {
    if (!this.#video) {
      return;
    }

    if (typeof height === 'number' && height > 0) {
      this.#video.resize(height);
    } else {
      const fallbackHeight = this.#$workspace?.offsetHeight || 400;
      this.#video.resize(fallbackHeight);
    }

    this.resize();
  }

  resizeFromWindow() {
    if (!this.#video || !this.#videoDimensions.height) {
      return;
    }

    this.#video.resize(this.#videoDimensions.height);
  }

  reset() {
    this.#videoDimensions = { width: 0, height: 0 };

    const $library = this.#$library || document.querySelector(SELECTORS.library);
    const $preview = this.#$preview || document.querySelector(SELECTORS.preview);
    const $timeline = this.#$timeline || document.querySelector(SELECTORS.timeline);

    $library.style.width = '';
    $library.style.height = '';
    $library.style.top = '';
    $library.style.bottom = '';
    $library.style.left = '';
    $preview.style.width = '';
    $timeline.style.height = '';
  }

  init() {
    this.#$root = document.querySelector(SELECTORS.root);
    this.#$header = document.querySelector(SELECTORS.header);
    this.#$workspace = document.querySelector(SELECTORS.workspace);
    this.#$library = document.querySelector(SELECTORS.library);
    this.#$preview = document.querySelector(SELECTORS.preview);
    this.#$timeline = document.querySelector(SELECTORS.timeline);

    this.#boundOnWindowResize = () => this.onWindowResize();
    window.addEventListener('resize', this.#boundOnWindowResize);

    this.#unsubscribeResize = EventService.on(EVENT.LAYOUT_RESIZE, payload => {
      const height = payload?.height;
      this.resizeFromVideo(height);
    });

    this.#unsubscribeVideoResized = EventService.on(EVENT.VIDEO_RESIZED, ({ width, height }) => {
      this.#videoDimensions = { width, height };
      this.resize();
    });
  }

  onWindowResize() {
    this.resizeFromWindow();
  }

  destroy() {
    if (this.#boundOnWindowResize) {
      window.removeEventListener('resize', this.#boundOnWindowResize);
      this.#boundOnWindowResize = null;
    }

    if (this.#unsubscribeResize) {
      this.#unsubscribeResize();
      this.#unsubscribeResize = null;
    }

    if (this.#unsubscribeVideoResized) {
      this.#unsubscribeVideoResized();
      this.#unsubscribeVideoResized = null;
    }

    this.#video = null;
    this.#player = null;
    this.#navigator = null;
    this.#$root = null;
    this.#$header = null;
    this.#$workspace = null;
    this.#$library = null;
    this.#$preview = null;
    this.#$timeline = null;
  }
}

export default new LayoutManager();
