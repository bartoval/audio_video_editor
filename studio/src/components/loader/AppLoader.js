import { LABEL } from '../../constants';

/**
 * AppLoader - fullscreen loading overlay for app initialization
 *
 * Features:
 * - Uses HTML initial loader for instant display (no JS delay)
 * - Smooth fade-out transition on hide
 * - Singleton pattern with static API
 *
 * Usage:
 *   // Loader is already visible from HTML
 *   await loadData();
 *   AppLoader.hide();
 */
class AppLoader {
  static #instance = null;

  #$initialLoader = null;
  #isVisible = true;

  constructor() {
    this.#$initialLoader = document.getElementById('initial-loader');
  }

  // ============================================================================
  // Static API
  // ============================================================================

  static getInstance() {
    if (!AppLoader.#instance) {
      AppLoader.#instance = new AppLoader();
    }

    return AppLoader.#instance;
  }

  static show() {
    return AppLoader.getInstance().show();
  }

  static hide() {
    return AppLoader.getInstance().hide();
  }

  static isVisible() {
    return AppLoader.getInstance().isVisible();
  }

  // ============================================================================
  // Instance API
  // ============================================================================

  show() {
    if (this.#isVisible || !this.#$initialLoader) {
      return this;
    }

    this.#$initialLoader.style.display = 'flex';
    this.#$initialLoader.style.opacity = '1';
    this.#isVisible = true;

    return this;
  }

  hide() {
    if (!this.#isVisible || !this.#$initialLoader) {
      return Promise.resolve();
    }

    return new Promise(resolve => {
      this.#$initialLoader.style.transition = 'opacity 0.5s ease-out';
      this.#$initialLoader.style.opacity = '0';

      const handleTransitionEnd = () => {
        this.#$initialLoader.removeEventListener('transitionend', handleTransitionEnd);
        this.#$initialLoader.style.display = 'none';
        this.#isVisible = false;
        resolve();
      };

      this.#$initialLoader.addEventListener('transitionend', handleTransitionEnd);
    });
  }

  isVisible() {
    return this.#isVisible;
  }
}

export default AppLoader;
