import { LABEL } from '../../config/constants';
import Modal from '../core/Modal';
import AiMusicPresenter from './AiMusicPresenter';
import AiMusicView from './view/AiMusicView';

/**
 * AiMusicModal - wrapper that encapsulates Modal + AiMusicView + AiMusicPresenter
 *
 * Handles proper lifecycle:
 * - View is mounted once during init
 * - show() preserves body content
 * - reset() clears form state without destroying DOM
 */
export default class AiMusicModal {
  #modal = null;
  #view = null;
  #presenter = null;
  #isInitialized = false;
  #onGenerate = null;

  constructor() {
    this.#modal = new Modal({
      title: LABEL.AI_MUSIC_TITLE,
      showFooter: false,
      size: 'lg',
      className: 'ai-music-modal'
    });
  }

  init() {
    if (this.#isInitialized) {
      return;
    }

    this.#view = new AiMusicView(this.#modal.getBody());
    this.#presenter = new AiMusicPresenter(this.#view);

    this.#presenter.setOnGenerate(() => {
      this.hide();
      this.#onGenerate?.();
    });

    this.#presenter.init();
    this.#isInitialized = true;
  }

  setOnGenerate(callback) {
    this.#onGenerate = callback;

    if (this.#presenter) {
      this.#presenter.setOnGenerate(() => {
        this.hide();
        this.#onGenerate?.();
      });
    }
  }

  show() {
    if (!this.#isInitialized) {
      this.init();
    }

    this.#modal.show({ showFooter: false, preserveBody: true });
  }

  hide() {
    this.#presenter?.reset();
    this.#modal.hide();
  }

  reset() {
    this.#presenter?.reset();
  }

  destroy() {
    this.#presenter?.dispose();
    this.#modal?.destroy();

    this.#modal = null;
    this.#view = null;
    this.#presenter = null;
    this.#isInitialized = false;
  }

  isVisible() {
    return this.#modal?.$modal?.classList.contains('show') ?? false;
  }

  getModal() {
    return this.#modal;
  }

  getPresenter() {
    return this.#presenter;
  }
}
