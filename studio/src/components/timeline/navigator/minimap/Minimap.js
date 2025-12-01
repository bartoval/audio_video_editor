import { Signals, View, applyTransform3d } from '../../../../lib';

/**
 * Minimap - Shows entire timeline with viewport indicator
 *
 * Features:
 * - Shows full timeline duration at fixed scale
 * - Displays scenes as colored blocks
 * - Viewport rectangle shows current visible area
 * - Click to navigate, drag viewport to pan
 */
export default class Minimap extends View {
  #duration = 0;
  #viewportWidth = 0;
  #viewportPosX = 0;
  #barWidth = 0;
  #scaleFactorX = 1;
  #isDragging = false;
  #wasDragging = false;
  #dragStartX = 0;
  #dragStartViewportX = 0;

  #$scenesContainer = null;
  #$viewport = null;
  #$playhead = null;

  onNavigate = new Signals.Signal();

  constructor($parent) {
    super($parent);
    this.mount();
  }

  template() {
    return `
      <div class="minimap">
        <div class="minimap-track">
          <div data-ref="scenes" class="minimap-scenes"></div>
          <div data-ref="viewport" class="minimap-viewport"></div>
          <div data-ref="playhead" class="minimap-playhead"></div>
        </div>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);

    this.#$scenesContainer = this.$node.querySelector('[data-ref="scenes"]');
    this.#$viewport = this.$node.querySelector('[data-ref="viewport"]');
    this.#$playhead = this.$node.querySelector('[data-ref="playhead"]');
  }

  onMount() {
    const $track = this.$node.querySelector('.minimap-track');
    $track.addEventListener('mousedown', this.#handleMouseDown);
    $track.addEventListener('click', this.#handleClick);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  init(duration) {
    this.#duration = duration;
    this.#barWidth = this.$node.querySelector('.minimap-track').offsetWidth;
    this.#scaleFactorX = this.#barWidth / duration;

    return true;
  }

  /**
   * Update viewport position and size based on current view state
   * @param {number} viewportStartTime - Start time of visible area
   * @param {number} viewportEndTime - End time of visible area
   */
  updateViewport(viewportStartTime, viewportEndTime) {
    const startX = viewportStartTime * this.#scaleFactorX;
    const endX = viewportEndTime * this.#scaleFactorX;
    const width = Math.max(10, endX - startX); // Min 10px width

    this.#viewportPosX = startX;
    this.#viewportWidth = width;

    this.#$viewport.style.left = `${startX}px`;
    this.#$viewport.style.width = `${width}px`;
  }

  /**
   * Update playhead position
   * @param {number} time - Current playback time
   */
  updatePlayhead(time) {
    const posX = time * this.#scaleFactorX;
    applyTransform3d(this.#$playhead, posX, 0, 0);
  }

  /**
   * Render scenes on the minimap
   * @param {Array} scenes - Array of scene objects with color, startTime, durationTime
   */
  renderScenes(scenes) {
    this.#$scenesContainer.innerHTML = '';

    scenes.forEach(scene => {
      const $scene = document.createElement('div');
      $scene.className = 'minimap-scene';
      $scene.style.left = `${scene.startTime * this.#scaleFactorX}px`;
      $scene.style.width = `${scene.durationTime * this.#scaleFactorX}px`;
      $scene.style.backgroundColor = scene.color;
      this.#$scenesContainer.appendChild($scene);
    });
  }

  /**
   * Handle zoom changes - recalculate scale and update
   */
  zoom() {
    this.#barWidth = this.$node.querySelector('.minimap-track').offsetWidth;
    this.#scaleFactorX = this.#barWidth / this.#duration;
  }

  // ============================================================================
  // Private
  // ============================================================================

  #handleClick = e => {
    // Skip click if we just finished dragging
    if (this.#wasDragging) {
      this.#wasDragging = false;

      return;
    }

    const rect = this.$node.querySelector('.minimap-track').getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const time = Math.max(0, Math.min(clickX / this.#scaleFactorX, this.#duration));

    this.onNavigate.dispatch(time);
  };

  #handleMouseDown = e => {
    const rect = this.#$viewport.getBoundingClientRect();
    const clickX = e.clientX;

    // Check if clicking on viewport
    if (clickX >= rect.left && clickX <= rect.right) {
      e.preventDefault();
      e.stopPropagation();
      this.#isDragging = true;
      this.#dragStartX = clickX;
      this.#dragStartViewportX = this.#viewportPosX;

      document.addEventListener('mousemove', this.#handleMouseMove);
      document.addEventListener('mouseup', this.#handleMouseUp);
    }
  };

  #handleMouseMove = e => {
    if (!this.#isDragging) {
      return;
    }

    e.preventDefault();
    const deltaX = e.clientX - this.#dragStartX;
    let newPosX = this.#dragStartViewportX + deltaX;

    // Clamp to bounds
    newPosX = Math.max(0, Math.min(newPosX, this.#barWidth - this.#viewportWidth));

    const time = newPosX / this.#scaleFactorX;
    this.onNavigate.dispatch(time);
  };

  #handleMouseUp = () => {
    if (this.#isDragging) {
      this.#wasDragging = true;
    }

    this.#isDragging = false;
    document.removeEventListener('mousemove', this.#handleMouseMove);
    document.removeEventListener('mouseup', this.#handleMouseUp);
  };
}
