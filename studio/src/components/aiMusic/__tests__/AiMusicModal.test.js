import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockModalInstance = {
  $modal: {
    classList: {
      add: vi.fn(),
      contains: vi.fn(() => false)
    }
  },
  getBody: vi.fn(() => document.createElement('div')),
  show: vi.fn(),
  hide: vi.fn(),
  destroy: vi.fn()
};

const mockPresenterInstance = {
  init: vi.fn(),
  setOnGenerate: vi.fn(),
  reset: vi.fn(),
  dispose: vi.fn()
};

const mockViewInstance = {
  mount: vi.fn(),
  destroy: vi.fn()
};

vi.mock('../../core/Modal', () => {
  const MockModal = vi.fn(function () {
    Object.assign(this, mockModalInstance);
  });

  return { default: MockModal };
});

vi.mock('../AiMusicPresenter', () => {
  const MockPresenter = vi.fn(function () {
    Object.assign(this, mockPresenterInstance);
  });

  return { default: MockPresenter };
});

vi.mock('../view/AiMusicView', () => {
  const MockView = vi.fn(function () {
    Object.assign(this, mockViewInstance);
  });

  return { default: MockView };
});

vi.mock('../../../config/constants', () => ({
  LABEL: {
    AI_MUSIC_TITLE: 'AI Music'
  }
}));

import AiMusicModal from '../AiMusicModal';
import Modal from '../../core/Modal';
import AiMusicPresenter from '../AiMusicPresenter';
import AiMusicView from '../view/AiMusicView';

describe('AiMusicModal', () => {
  let modal;

  beforeEach(() => {
    vi.clearAllMocks();
    mockModalInstance.$modal.classList.contains.mockReturnValue(false);
  });

  afterEach(() => {
    modal?.destroy();
    modal = null;
  });

  describe('constructor', () => {
    it('should create Modal with correct options', () => {
      modal = new AiMusicModal();

      expect(Modal).toHaveBeenCalledWith({
        title: 'AI Music',
        showFooter: false,
        size: 'lg',
        className: 'ai-music-modal'
      });
    });

    it('should not create view and presenter until init', () => {
      modal = new AiMusicModal();

      expect(AiMusicView).not.toHaveBeenCalled();
      expect(AiMusicPresenter).not.toHaveBeenCalled();
    });
  });

  describe('init', () => {
    it('should create view with modal body', () => {
      modal = new AiMusicModal();
      modal.init();

      expect(mockModalInstance.getBody).toHaveBeenCalled();
      expect(AiMusicView).toHaveBeenCalled();
    });

    it('should create presenter with view instance', () => {
      modal = new AiMusicModal();
      modal.init();

      expect(AiMusicPresenter).toHaveBeenCalled();
    });

    it('should call presenter.init', () => {
      modal = new AiMusicModal();
      modal.init();

      expect(mockPresenterInstance.init).toHaveBeenCalled();
    });

    it('should only initialize once', () => {
      modal = new AiMusicModal();
      modal.init();
      modal.init();

      expect(AiMusicView).toHaveBeenCalledTimes(1);
      expect(AiMusicPresenter).toHaveBeenCalledTimes(1);
    });
  });

  describe('show', () => {
    it('should initialize if not already initialized', () => {
      modal = new AiMusicModal();
      modal.show();

      expect(AiMusicView).toHaveBeenCalled();
      expect(AiMusicPresenter).toHaveBeenCalled();
    });

    it('should call modal.show with preserveBody', () => {
      modal = new AiMusicModal();
      modal.show();

      expect(mockModalInstance.show).toHaveBeenCalledWith({
        showFooter: false,
        preserveBody: true
      });
    });

    it('should not reinitialize on subsequent shows', () => {
      modal = new AiMusicModal();
      modal.show();
      modal.show();

      expect(AiMusicView).toHaveBeenCalledTimes(1);
    });
  });

  describe('hide', () => {
    it('should call modal.hide', () => {
      modal = new AiMusicModal();
      modal.hide();

      expect(mockModalInstance.hide).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should call presenter.reset when initialized', () => {
      modal = new AiMusicModal();
      modal.init();
      modal.reset();

      expect(mockPresenterInstance.reset).toHaveBeenCalled();
    });

    it('should not throw when not initialized', () => {
      modal = new AiMusicModal();

      expect(() => modal.reset()).not.toThrow();
    });
  });

  describe('setOnGenerate', () => {
    it('should wrap callback with hide', () => {
      modal = new AiMusicModal();
      modal.init();

      const callback = vi.fn();
      modal.setOnGenerate(callback);

      expect(mockPresenterInstance.setOnGenerate).toHaveBeenCalled();

      const wrappedCallback = mockPresenterInstance.setOnGenerate.mock.calls[0][0];
      wrappedCallback();

      expect(mockModalInstance.hide).toHaveBeenCalled();
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('isVisible', () => {
    it('should return true when modal has show class', () => {
      modal = new AiMusicModal();
      mockModalInstance.$modal.classList.contains.mockReturnValue(true);

      expect(modal.isVisible()).toBe(true);
    });

    it('should return false when modal does not have show class', () => {
      modal = new AiMusicModal();
      mockModalInstance.$modal.classList.contains.mockReturnValue(false);

      expect(modal.isVisible()).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should dispose presenter', () => {
      modal = new AiMusicModal();
      modal.init();
      modal.destroy();

      expect(mockPresenterInstance.dispose).toHaveBeenCalled();
    });

    it('should destroy modal', () => {
      modal = new AiMusicModal();
      modal.destroy();

      expect(mockModalInstance.destroy).toHaveBeenCalled();
    });
  });

  describe('getModal', () => {
    it('should return modal instance with expected properties', () => {
      modal = new AiMusicModal();
      const modalInstance = modal.getModal();

      expect(modalInstance).toHaveProperty('show');
      expect(modalInstance).toHaveProperty('hide');
      expect(modalInstance).toHaveProperty('getBody');
    });
  });

  describe('getPresenter', () => {
    it('should return presenter when initialized', () => {
      modal = new AiMusicModal();
      modal.init();
      const presenter = modal.getPresenter();

      expect(presenter).toHaveProperty('init');
      expect(presenter).toHaveProperty('reset');
    });

    it('should return null when not initialized', () => {
      modal = new AiMusicModal();

      expect(modal.getPresenter()).toBeNull();
    });
  });
});
