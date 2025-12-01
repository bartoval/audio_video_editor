/**
 * LayoutManager - handles app layout and resize logic
 */

// DOM selectors
const SELECTORS = {
  root: '.studio',
  header: '.studio-header',
  workspace: '.studio-workspace',
  library: '.studio-library',
  preview: '.studio-preview',
  timeline: '.studio-timeline'
};

class LayoutManager {
  #video = null;
  #player = null;
  #navigator = null;

  /**
   * Register video component for resize calculations
   */
  registerVideo(videoInstance) {
    this.#video = videoInstance;
  }

  /**
   * Register player component
   */
  registerPlayer(playerInstance) {
    this.#player = playerInstance;
  }

  /**
   * Register navigator component
   */
  registerNavigator(navigatorInstance) {
    this.#navigator = navigatorInstance;
  }

  /**
   * Recalculate and apply layout dimensions
   */
  resize() {
    // Only resize when video is loaded - empty state uses CSS defaults
    if (!this.#video || !this.#video.$node.offsetWidth) {
      return;
    }

    const $header = document.querySelector(SELECTORS.header);
    const $workspace = document.querySelector(SELECTORS.workspace);
    const $library = document.querySelector(SELECTORS.library);
    const $preview = document.querySelector(SELECTORS.preview);
    const $timeline = document.querySelector(SELECTORS.timeline);
    const $root = document.querySelector(SELECTORS.root);

    const totalHeight = $root.offsetHeight;
    const headerHeight = $header.offsetHeight;

    const previewStyle = getComputedStyle($preview);
    const previewPadding =
      parseFloat(previewStyle.paddingLeft) + parseFloat(previewStyle.paddingRight);

    const previewWidth = this.#video.$node.offsetWidth + previewPadding;
    $preview.style.width = previewWidth + 'px';
    $library.style.width = document.querySelector('body').offsetWidth - previewWidth + 'px';

    const workspaceHeight = $workspace.offsetHeight;
    $timeline.style.height = totalHeight - headerHeight - workspaceHeight + 'px';

    if (this.#player) {
      this.#player.resize();
    }

    if (this.#navigator) {
      this.#navigator.resize();
    }
  }

  /**
   * Resize from video dimension change
   */
  resizeFromVideo(height) {
    if (!this.#video) {
      return;
    }

    this.#video.resize(height);
    this.resize();
  }

  /**
   * Handle window resize event
   */
  onWindowResize() {
    if (!this.#video) {
      return;
    }

    const $workspace = document.querySelector(SELECTORS.workspace);
    this.#video.resize($workspace.offsetHeight);
    this.resize();
  }

  /**
   * Reset layout to CSS defaults (used when video is deleted)
   */
  reset() {
    const $library = document.querySelector(SELECTORS.library);
    const $preview = document.querySelector(SELECTORS.preview);
    const $timeline = document.querySelector(SELECTORS.timeline);

    // Clear inline styles to use CSS defaults
    $library.style.width = '';
    $preview.style.width = '';
    $timeline.style.height = '';
  }

  /**
   * Initialize window resize listener
   */
  init() {
    window.addEventListener('resize', () => this.onWindowResize());
  }
}

export default new LayoutManager();
