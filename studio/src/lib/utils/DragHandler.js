// @ts-check

/**
 * DragHandler - Reusable drag handling with consistent cleanup
 *
 * Encapsulates common drag patterns:
 * - mousedown/mousemove/mouseup lifecycle
 * - window.blur fallback for interrupted drags
 * - Optional pointer capture for reliable drag outside window
 * - Threshold-based drag detection
 * - Clean destroy() method
 */
export default class DragHandler {
  #element = null;
  #callbacks = {};
  #options = {};

  #isDragging = false;
  #hasMoved = false;
  #startX = 0;
  #startY = 0;
  #pointerId = null;

  /**
   * @param {HTMLElement} element - Element to attach mousedown listener
   * @param {import('@types').DragCallbacks} callbacks - Drag event callbacks
   * @param {import('@types').DragOptions} [options] - Configuration options
   */
  constructor(element, callbacks = {}, options = {}) {
    this.#element = element;
    this.#callbacks = callbacks;
    this.#options = {
      threshold: options.threshold ?? 3,
      usePointerCapture: options.usePointerCapture ?? false,
      cursor: options.cursor ?? ''
    };

    this.#element.addEventListener('mousedown', this.#handleMouseDown);
  }

  /**
   * Check if currently dragging
   * @returns {boolean}
   */
  isDragging() {
    return this.#isDragging;
  }

  /**
   * Check if drag has moved past threshold
   * @returns {boolean}
   */
  hasMoved() {
    return this.#hasMoved;
  }

  /**
   * Manually start drag (for external trigger)
   * @param {MouseEvent} event
   */
  startDrag(event) {
    this.#handleMouseDown(event);
  }

  /**
   * Force stop current drag
   */
  stopDrag() {
    if (this.#isDragging) {
      this.#cleanup();
    }
  }

  /**
   * Update callbacks dynamically
   * @param {import('@types').DragCallbacks} callbacks
   */
  setCallbacks(callbacks) {
    this.#callbacks = { ...this.#callbacks, ...callbacks };
  }

  /**
   * Clean up all event listeners
   */
  destroy() {
    this.#cleanup();

    if (this.#element) {
      this.#element.removeEventListener('mousedown', this.#handleMouseDown);
      this.#element = null;
    }

    this.#callbacks = {};
  }

  #handleMouseDown = event => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();

    this.#isDragging = true;
    this.#hasMoved = false;
    this.#startX = event.clientX;
    this.#startY = event.clientY;

    if (this.#options.cursor) {
      document.body.style.cursor = this.#options.cursor;
    }

    document.body.style.userSelect = 'none';

    if (
      this.#options.usePointerCapture &&
      event.target?.setPointerCapture &&
      event.pointerId !== undefined
    ) {
      this.#pointerId = event.pointerId;
      event.target.setPointerCapture(event.pointerId);
    }

    document.addEventListener('mousemove', this.#handleMouseMove);
    document.addEventListener('mouseup', this.#handleMouseUp);
    window.addEventListener('blur', this.#handleBlur);

    this.#callbacks.onStart?.(event, this.#startX, this.#startY);
  };

  #handleMouseMove = event => {
    if (!this.#isDragging) {
      return;
    }

    event.preventDefault();

    const deltaX = event.clientX - this.#startX;
    const deltaY = event.clientY - this.#startY;

    if (
      !this.#hasMoved &&
      (Math.abs(deltaX) > this.#options.threshold || Math.abs(deltaY) > this.#options.threshold)
    ) {
      this.#hasMoved = true;
    }

    this.#callbacks.onMove?.(event, deltaX, deltaY, this.#startX, this.#startY);
  };

  #handleMouseUp = event => {
    if (!this.#isDragging) {
      return;
    }

    const deltaX = event.clientX - this.#startX;
    const deltaY = event.clientY - this.#startY;
    const wasDragged = this.#hasMoved;

    this.#cleanup();

    this.#callbacks.onEnd?.(event, deltaX, deltaY, wasDragged);
  };

  #handleBlur = () => {
    if (!this.#isDragging) {
      return;
    }

    const wasDragged = this.#hasMoved;

    this.#cleanup();

    const syntheticEvent = new MouseEvent('mouseup', {
      clientX: this.#startX,
      clientY: this.#startY
    });

    this.#callbacks.onEnd?.(syntheticEvent, 0, 0, wasDragged);
  };

  #cleanup() {
    this.#isDragging = false;
    this.#hasMoved = false;

    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    if (this.#pointerId !== null && this.#element?.releasePointerCapture) {
      try {
        this.#element.releasePointerCapture(this.#pointerId);
      } catch {
        // Ignore if already released
      }

      this.#pointerId = null;
    }

    document.removeEventListener('mousemove', this.#handleMouseMove);
    document.removeEventListener('mouseup', this.#handleMouseUp);
    window.removeEventListener('blur', this.#handleBlur);
  }
}
