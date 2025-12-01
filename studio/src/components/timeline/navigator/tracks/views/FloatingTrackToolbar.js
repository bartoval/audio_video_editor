import { applyTransform3d } from '../../../../../lib';
import { LABEL, TRACK_ACTION } from '../../../../../config/constants';
import * as ToolMode from '../../../../../services/ToolMode';
import * as CutService from '../../../../../services/CutService';
import * as SuperZoomService from '../../../../../services/SuperZoomService';

/**
 * FloatingTrackToolbar - Contextual toolbar that appears below selected track
 *
 * Features:
 * - Glass effect styling
 * - Follows mouse X position within track bounds
 * - Fade-in/out animation
 * - Actions: Split, Cut, Copy, Delete, Volume, Pan, Snap
 */
export default class FloatingTrackToolbar {
  #$root = null;
  #$toolbar = null;
  #$parent = null;
  #isVisible = false;
  #isHovering = false;
  #callbacks = {};
  #volumeActive = false;
  #panActive = false;
  #muteActive = false;
  #snapActive = true;
  #cutActive = false;
  #superzoomActive = false;
  #lastMouseX = 0;
  #pendingMouseX = null;
  #rafId = null;
  #unsubscribeToolMode = null;
  #unsubscribeSuperZoom = null;

  constructor($parent, callbacks = {}) {
    this.#$parent = $parent;
    this.#callbacks = callbacks;
    this.#render($parent);
    this.#bindEvents();
    this.#unsubscribeToolMode = ToolMode.onModeChange(this.#handleToolModeChange);
    this.#unsubscribeSuperZoom = SuperZoomService.onChange(this.#handleSuperZoomChange);
  }

  #render($parent) {
    this.#$root = document.createElement('div');
    this.#$root.className = 'floating-track-toolbar';
    this.#$root.innerHTML = `
      <div class="floating-toolbar-inner">
        <button data-action="cut" class="toolbar-btn" title="${LABEL.TOOLBAR_CUT}">
          <i class="bi bi-scissors"></i>
        </button>
        <button data-action="copy" class="toolbar-btn" title="${LABEL.TOOLBAR_DUPLICATE}">
          <i class="bi bi-copy"></i>
        </button>
        <button data-action="delete" class="toolbar-btn toolbar-btn-danger" title="${LABEL.TOOLBAR_DELETE}">
          <i class="bi bi-trash"></i>
        </button>
        <div class="toolbar-separator"></div>
        <button data-action="mute" class="toolbar-btn" title="${LABEL.TOOLBAR_MUTE}">
          <i class="bi bi-volume-up"></i>
        </button>
        <button data-action="volume" class="toolbar-btn" title="${LABEL.TOOLBAR_VOLUME}">
          <i class="bi bi-sliders"></i>
        </button>
        <button data-action="pan" class="toolbar-btn" title="${LABEL.TOOLBAR_PAN}">
          <i class="bi bi-arrows-expand"></i>
        </button>
        <div class="toolbar-separator"></div>
        <button data-action="inspector" class="toolbar-btn" title="${LABEL.TOOLBAR_INSPECTOR}">
          <i class="bi bi-gear"></i>
        </button>
        <button data-action="snap" class="toolbar-btn active" title="${LABEL.TOOLBAR_SNAP}">
          <i class="bi bi-magnet"></i>
        </button>
        <button data-action="superzoom" class="toolbar-btn" title="${LABEL.TOOLBAR_SUPERZOOM}">
          <i class="bi bi-zoom-in"></i>
        </button>
      </div>
    `;

    this.#$toolbar = this.#$root.querySelector('.floating-toolbar-inner');
    $parent.appendChild(this.#$root);
  }

  #bindEvents() {
    this.#$toolbar.addEventListener('click', this.#handleClick);
    this.#$toolbar.addEventListener('mousedown', event => {
      event.stopPropagation();
    });
    this.#$toolbar.addEventListener('mouseenter', () => {
      this.#isHovering = true;
    });
    this.#$toolbar.addEventListener('mouseleave', () => {
      this.#isHovering = false;
    });
    this.#$parent.addEventListener('mousemove', this.#handleMouseMove);
    this.#$parent.addEventListener('mousedown', this.#handleMouseDown);
  }

  #handleMouseDown = event => {
    const parentRect = this.#$parent.getBoundingClientRect();
    this.#lastMouseX = event.clientX - parentRect.left;
  };

  #handleMouseMove = event => {
    const parentRect = this.#$parent.getBoundingClientRect();
    this.#lastMouseX = event.clientX - parentRect.left;

    if (!this.#isVisible || this.#isHovering) {
      return;
    }

    this.#pendingMouseX = this.#lastMouseX;

    if (!this.#rafId) {
      this.#rafId = requestAnimationFrame(() => {
        this.#rafId = null;
        const mouseX = this.#pendingMouseX ?? this.#lastMouseX;
        this.#pendingMouseX = null;
        this.#updatePosition(mouseX);
      });
    }
  };

  #updatePosition(mouseX) {
    const toolbarWidth = this.#$toolbar.offsetWidth;
    const parentWidth = this.#$parent.offsetWidth || 0;

    const minX = 8;
    const maxX = parentWidth - toolbarWidth - 8;
    const leftAlignedX = mouseX - toolbarWidth;
    const clampedX = Math.max(minX, Math.min(leftAlignedX, maxX));

    applyTransform3d(this.#$toolbar, clampedX, 0, 0);
  }

  #handleClick = event => {
    const $btn = event.target.closest('[data-action]');

    if (!$btn) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();

    const { action } = $btn.dataset;

    switch (action) {
      case 'cut':
        this.#toggleCut();
        break;

      case 'copy':
        this.#callbacks.onCopy?.();
        break;

      case 'delete':
        this.#callbacks.onDelete?.();
        break;

      case 'mute':
        this.#toggleMute();
        break;

      case 'volume':
        this.#toggleVolume();
        break;

      case 'pan':
        this.#togglePan();
        break;

      case 'inspector':
        this.#callbacks.onInspectorToggle?.();
        break;

      case 'snap':
        this.#toggleSnap();
        break;

      case 'superzoom':
        this.#toggleSuperZoom();
        break;
    }
  };

  #toggleVolume() {
    this.#volumeActive = !this.#volumeActive;

    if (this.#volumeActive && this.#panActive) {
      this.#panActive = false;
      this.#updateButtonState('pan', false);
    }

    this.#updateButtonState('volume', this.#volumeActive);
    this.#callbacks.onVolumeToggle?.(this.#volumeActive);
  }

  #togglePan() {
    this.#panActive = !this.#panActive;

    if (this.#panActive && this.#volumeActive) {
      this.#volumeActive = false;
      this.#updateButtonState('volume', false);
    }

    this.#updateButtonState('pan', this.#panActive);
    this.#callbacks.onPanToggle?.(this.#panActive);
  }

  #toggleMute() {
    this.#muteActive = !this.#muteActive;
    this.#updateMuteIcon();
    this.#callbacks.onMuteToggle?.(this.#muteActive);
  }

  #toggleSnap() {
    this.#snapActive = !this.#snapActive;
    this.#updateButtonState('snap', this.#snapActive);
    this.#callbacks.onSnapToggle?.(this.#snapActive);
  }

  #toggleCut() {
    CutService.toggle();
  }

  #toggleSuperZoom() {
    SuperZoomService.toggle();
  }

  #handleToolModeChange = mode => {
    this.#cutActive = mode === TRACK_ACTION.CUT;
    this.#updateButtonState('cut', this.#cutActive);
  };

  #handleSuperZoomChange = state => {
    this.#superzoomActive = state.isEnabled;
    this.#updateButtonState('superzoom', this.#superzoomActive);
  };

  #updateMuteIcon() {
    const $btn = this.#$toolbar.querySelector('[data-action="mute"]');

    if ($btn) {
      const $icon = $btn.querySelector('i');
      $icon.className = this.#muteActive ? 'bi bi-volume-mute' : 'bi bi-volume-up';
      $btn.classList.toggle('active', this.#muteActive);
    }
  }

  #updateButtonState(action, isActive) {
    const $btn = this.#$toolbar.querySelector(`[data-action="${action}"]`);

    if ($btn) {
      $btn.classList.toggle('active', isActive);
    }
  }

  show() {
    if (this.#isVisible) {
      return;
    }

    this.#isVisible = true;
    this.#updatePosition(this.#lastMouseX);
    this.#$root.classList.add('visible');
  }

  hide() {
    if (!this.#isVisible) {
      return;
    }

    this.#isVisible = false;
    this.#volumeActive = false;
    this.#panActive = false;
    this.#updateButtonState('volume', false);
    this.#updateButtonState('pan', false);
    this.#$root.classList.remove('visible');
  }

  setVolumeActive(active) {
    this.#volumeActive = active;
    this.#updateButtonState('volume', active);
  }

  setPanActive(active) {
    this.#panActive = active;
    this.#updateButtonState('pan', active);
  }

  setMuteActive(active) {
    this.#muteActive = active;
    this.#updateMuteIcon();
  }

  setSnapActive(active) {
    this.#snapActive = active;
    this.#updateButtonState('snap', active);
  }

  getRoot() {
    return this.#$root;
  }

  destroy() {
    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }

    if (this.#unsubscribeToolMode) {
      this.#unsubscribeToolMode();
      this.#unsubscribeToolMode = null;
    }

    if (this.#unsubscribeSuperZoom) {
      this.#unsubscribeSuperZoom();
      this.#unsubscribeSuperZoom = null;
    }

    this.#$toolbar.removeEventListener('click', this.#handleClick);
    this.#$parent.removeEventListener('mousemove', this.#handleMouseMove);
    this.#$parent.removeEventListener('mousedown', this.#handleMouseDown);
    this.#$root.remove();
    this.#$root = null;
    this.#$toolbar = null;
    this.#$parent = null;
  }
}
