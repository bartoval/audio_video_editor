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
import { RESIZE_BOUNDS, CSS_CLASS } from '../config/ui';
import * as EventService from './EventService';

const DEFAULT_MIN_TIMELINE_HEIGHT = 320;

const SELECTORS = {
  root: '.studio',
  header: '.studio-header',
  workspace: '.studio-workspace',
  library: '.studio-library',
  preview: '.studio-preview',
  timeline: '.studio-timeline',
  footer: '.studio-footer'
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
  #isShrinking = false;
  /** Height the video wants (default or user-chosen); it may be shrunk below it. */
  #preferredVideoHeight = 0;

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
    const rootStyle = getComputedStyle($root);
    const rootPadding =
      (parseFloat(rootStyle.paddingTop) || 0) + (parseFloat(rootStyle.paddingBottom) || 0);
    const footerHeight =
      /** @type {HTMLElement | null} */ (document.querySelector(SELECTORS.footer))?.offsetHeight ||
      0;
    const availableTimelineHeight =
      totalHeight - rootPadding - headerHeight - workspaceHeight - footerHeight;
    const minTimelineHeight = this.#getMinTimelineHeight($root);

    // The timeline must never be squeezed below its minimum: shrink the video instead.
    // Only once the video is mounted: before that the panels have placeholder sizes.
    if (
      $root.classList.contains(CSS_CLASS.HAS_VIDEO) &&
      availableTimelineHeight < minTimelineHeight &&
      this.#shrinkVideoBy(minTimelineHeight - availableTimelineHeight)
    ) {
      return;
    }

    $timeline.style.height = Math.max(minTimelineHeight, availableTimelineHeight) + 'px';

    if (this.#player) {
      this.#player.resize();
    }

    if (this.#navigator) {
      this.#navigator.resize();
    }
  }

  /**
   * Minimum timeline height, read from the --timeline-min-height token.
   * @param {HTMLElement} $root
   * @returns {number}
   */
  #getMinTimelineHeight($root) {
    const value = parseFloat(getComputedStyle($root).getPropertyValue('--timeline-min-height'));

    return Number.isFinite(value) && value > 0 ? value : DEFAULT_MIN_TIMELINE_HEIGHT;
  }

  /**
   * Shrink the video so the timeline gains `deficit` pixels.
   * The resulting VIDEO_RESIZED event re-runs resize() with the new layout.
   * @param {number} deficit
   * @returns {boolean} true when the video actually changed size
   */
  #shrinkVideoBy(deficit) {
    if (!this.#video || this.#isShrinking) {
      return false;
    }

    const previousHeight = this.#videoDimensions.height;
    // VideoView refuses heights below this bound: shrink as far as it allows.
    const minVideoHeight = Math.ceil(window.innerHeight * RESIZE_BOUNDS.minHeightPercent);
    const targetHeight = Math.max(previousHeight - deficit, minVideoHeight);

    if (targetHeight >= previousHeight) {
      return false;
    }

    this.#isShrinking = true;

    try {
      this.#video.resize(targetHeight);
    } finally {
      this.#isShrinking = false;
    }

    return this.#videoDimensions.height !== previousHeight;
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

    this.#video.resize(this.#preferredVideoHeight || this.#videoDimensions.height);
  }

  reset() {
    this.#videoDimensions = { width: 0, height: 0 };
    this.#preferredVideoHeight = 0;

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

      if (!this.#isShrinking) {
        this.#preferredVideoHeight = height;
      }

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
