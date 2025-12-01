import { View } from '../../../../../lib';

const DEFAULT_FADE_DURATION = 0;
const MIN_FADE_DURATION = 0;

/**
 * FadeHandles - Triangle handles for fade in/out on tracks
 * Positioned at top corners, drag horizontally to set fade duration
 */
export default class FadeHandles extends View {
  #fadeInDuration = DEFAULT_FADE_DURATION;
  #fadeOutDuration = DEFAULT_FADE_DURATION;
  #trackDuration = 0;
  #trackWidth = 0;
  #$fadeIn = null;
  #$fadeOut = null;
  #$fadeInOverlay = null;
  #$fadeOutOverlay = null;
  #isDragging = false;
  #dragType = null;
  #dragStartX = 0;
  #dragStartDuration = 0;

  onFadeChange = null;

  constructor(config, $parent, callbacks = {}) {
    super($parent);
    this.id = config.id;
    this.#trackDuration = config.duration || 0;
    this.#fadeInDuration = config.fadeIn || DEFAULT_FADE_DURATION;
    this.#fadeOutDuration = config.fadeOut || DEFAULT_FADE_DURATION;
    this.onFadeChange = callbacks.onFadeChange || (() => {});
    this.mount();
  }

  render() {
    this.#$fadeIn = document.createElement('div');
    this.#$fadeIn.className = 'fade-handle fade-handle-in';
    this.#$fadeIn.setAttribute('data-zone-id', this.id);
    this.#$fadeIn.setAttribute('data-fade-type', 'in');
    this.#$fadeIn.style.left = '0px';
    this.$parent.appendChild(this.#$fadeIn);

    this.#$fadeOut = document.createElement('div');
    this.#$fadeOut.className = 'fade-handle fade-handle-out';
    this.#$fadeOut.setAttribute('data-zone-id', this.id);
    this.#$fadeOut.setAttribute('data-fade-type', 'out');
    this.#$fadeOut.style.right = '0px';
    this.$parent.appendChild(this.#$fadeOut);

    this.#$fadeInOverlay = document.createElement('div');
    this.#$fadeInOverlay.className = 'fade-overlay fade-overlay-in';
    this.$parent.appendChild(this.#$fadeInOverlay);

    this.#$fadeOutOverlay = document.createElement('div');
    this.#$fadeOutOverlay.className = 'fade-overlay fade-overlay-out';
    this.$parent.appendChild(this.#$fadeOutOverlay);

    this.#updateOverlays();
  }

  onMount() {
    this.#$fadeIn.addEventListener('mousedown', this.#handleMouseDown);
    this.#$fadeOut.addEventListener('mousedown', this.#handleMouseDown);
  }

  updateLayout(trackWidth, trackDuration) {
    this.#trackWidth = trackWidth;
    this.#trackDuration = trackDuration;
    this.#updateOverlays();
  }

  setFadeIn(duration) {
    this.#fadeInDuration = Math.max(MIN_FADE_DURATION, duration);
    this.#updateOverlays();
  }

  setFadeOut(duration) {
    this.#fadeOutDuration = Math.max(MIN_FADE_DURATION, duration);
    this.#updateOverlays();
  }

  getFadeIn() {
    return this.#fadeInDuration;
  }

  getFadeOut() {
    return this.#fadeOutDuration;
  }

  // Visibility controlled by parent volume-zone
  show() {
    return true;
  }

  hide() {
    return true;
  }

  #updateOverlays() {
    if (this.#trackWidth <= 0 || this.#trackDuration <= 0) {
      return;
    }

    const pixelsPerSecond = this.#trackWidth / this.#trackDuration;

    const fadeInWidth = this.#fadeInDuration * pixelsPerSecond;
    this.#$fadeInOverlay.style.width = `${fadeInWidth}px`;
    this.#$fadeIn.style.left = `${fadeInWidth}px`;

    const fadeOutWidth = this.#fadeOutDuration * pixelsPerSecond;
    this.#$fadeOutOverlay.style.width = `${fadeOutWidth}px`;
    this.#$fadeOut.style.right = `${fadeOutWidth}px`;
  }

  #handleMouseDown = event => {
    event.preventDefault();
    event.stopPropagation();

    this.#isDragging = true;
    this.#dragType = event.target.getAttribute('data-fade-type');
    this.#dragStartX = event.clientX;
    this.#dragStartDuration =
      this.#dragType === 'in' ? this.#fadeInDuration : this.#fadeOutDuration;

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', this.#handleMouseMove);
    document.addEventListener('mouseup', this.#handleMouseUp);
  };

  #handleMouseMove = event => {
    if (!this.#isDragging || this.#trackWidth <= 0) {
      return;
    }

    const deltaX = event.clientX - this.#dragStartX;
    const pixelsPerSecond = this.#trackWidth / this.#trackDuration;
    const deltaDuration = deltaX / pixelsPerSecond;

    if (this.#dragType === 'in') {
      const newDuration = Math.max(MIN_FADE_DURATION, this.#dragStartDuration + deltaDuration);
      const maxFadeIn = this.#trackDuration - this.#fadeOutDuration;
      this.#fadeInDuration = Math.min(newDuration, maxFadeIn);
    } else {
      const newDuration = Math.max(MIN_FADE_DURATION, this.#dragStartDuration - deltaDuration);
      const maxFadeOut = this.#trackDuration - this.#fadeInDuration;
      this.#fadeOutDuration = Math.min(newDuration, maxFadeOut);
    }

    this.#updateOverlays();
  };

  #handleMouseUp = () => {
    if (this.#isDragging) {
      this.onFadeChange({
        type: this.#dragType,
        fadeIn: this.#fadeInDuration,
        fadeOut: this.#fadeOutDuration
      });
    }

    this.#isDragging = false;
    this.#dragType = null;

    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    document.removeEventListener('mousemove', this.#handleMouseMove);
    document.removeEventListener('mouseup', this.#handleMouseUp);
  };

  onDestroy() {
    this.#$fadeIn?.removeEventListener('mousedown', this.#handleMouseDown);
    this.#$fadeOut?.removeEventListener('mousedown', this.#handleMouseDown);
    document.removeEventListener('mousemove', this.#handleMouseMove);
    document.removeEventListener('mouseup', this.#handleMouseUp);
    super.onDestroy();
  }
}
