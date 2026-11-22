import { applyTransform3d } from '../../../../../lib';
import { LABEL, TRACK_ACTION } from '../../../../../config/constants';
import * as ToolMode from '../../../../../services/ToolMode';
import * as CutService from '../../../../../services/CutService';
import * as SuperZoomService from '../../../../../services/SuperZoomService';

/**
 * FloatingTrackToolbar - Contextual toolbar for the selected track
 *
 * Features:
 * - Docks into the timeline's fixed tool bar (.timeline-dock) when present
 * - Otherwise floats below the track and follows the mouse X position
 * - Fade-in/out animation
 * - Actions: Cut, Volume, Duplicate, Mute, Delete, Snap, SuperZoom
 */
export default class FloatingTrackToolbar {
  #$root = null;
  #$toolbar = null;
  #$parent = null;
  #isVisible = false;
  #isDocked = false;
  #isHovering = false;
  #callbacks = {};
  #volumeActive = false;
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
    // Three kinds of control, grouped so they read differently:
    // modes (change what the mouse does), actions (act now), options (persistent toggles).
    this.#$root.innerHTML = `
      <div class="floating-toolbar-inner">
        <div class="toolbar-group toolbar-group--modes" role="group" aria-label="Edit mode">
          <button data-action="cut" class="toolbar-btn" title="${LABEL.TOOLBAR_CUT}">
            <i class="bi bi-scissors"></i><span class="toolbar-btn__label">Cut</span>
          </button>
          <button data-action="volume" class="toolbar-btn" title="${LABEL.TOOLBAR_VOLUME}">
            <i class="bi bi-sliders"></i><span class="toolbar-btn__label">Volume</span>
          </button>
        </div>
        <div class="toolbar-separator"></div>
        <div class="toolbar-group toolbar-group--actions" role="group" aria-label="Clip actions">
          <button data-action="copy" class="toolbar-btn" title="${LABEL.TOOLBAR_DUPLICATE}">
            <i class="bi bi-copy"></i><span class="toolbar-btn__label">Duplicate</span>
          </button>
          <button data-action="mute" class="toolbar-btn" title="${LABEL.TOOLBAR_MUTE}" aria-label="Mute">
            <i class="bi bi-volume-up"></i>
          </button>
          <button data-action="delete" class="toolbar-btn toolbar-btn-danger" title="${LABEL.TOOLBAR_DELETE}" aria-label="Delete">
            <i class="bi bi-trash"></i>
          </button>
        </div>
        <div class="toolbar-spacer"></div>
        <div class="toolbar-group toolbar-group--options" role="group" aria-label="Options">
          <button data-action="snap" class="toolbar-btn active" title="${LABEL.TOOLBAR_SNAP}">
            <i class="bi bi-magnet"></i><span class="toolbar-btn__label">Snap</span>
          </button>
          <button data-action="superzoom" class="toolbar-btn" title="${LABEL.TOOLBAR_SUPERZOOM}" aria-label="SuperZoom">
            <i class="bi bi-search"></i>
          </button>
        </div>
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

    if (!this.#isVisible || this.#isHovering || this.#isDocked) {
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
    this.#updateButtonState('volume', this.#volumeActive);
    this.#callbacks.onVolumeToggle?.(this.#volumeActive);
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
    this.#dockIfPossible();

    if (!this.#isDocked) {
      this.#updatePosition(this.#lastMouseX);
    }

    this.#$root.classList.add('visible');
  }

  /**
   * Move the toolbar into the timeline's fixed tool bar (.timeline-dock) when there is one,
   * so selecting a clip never covers or shifts the tracks. Without a dock it keeps floating.
   */
  #dockIfPossible() {
    const $dock = this.#$parent?.closest('.timeline')?.querySelector('.timeline-dock');

    if (!$dock) {
      return;
    }

    if (this.#$root.parentElement !== $dock) {
      $dock.appendChild(this.#$root);
    }

    this.#isDocked = true;
    this.#$root.classList.add('docked');
  }

  hide() {
    if (!this.#isVisible) {
      return;
    }

    this.#isVisible = false;
    this.#volumeActive = false;
    this.#updateButtonState('volume', false);
    this.#$root.classList.remove('visible');
  }

  setVolumeActive(active) {
    this.#volumeActive = active;
    this.#updateButtonState('volume', active);
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
