import { TRACKS } from '../../../../../config/constants';
import { clamp, show, hide, setEnabled, View, getRelativePos } from '../../../../../lib';

const { ENVELOPE_HEIGHT_PERCENT } = TRACKS;

/**
 * VolumeView - Handles DOM rendering for volume envelope
 * Pure view component, no business logic
 */
export default class VolumeView extends View {
  #dragState = null;
  #drawDragState = null;
  #callbacks = {};
  #clickTimeout = null;
  #isDragging = false;
  #justDragged = false;

  constructor(config, $parent, callbacks = {}) {
    super($parent);
    this.id = config.id;
    this.$path = null;
    this.$volumeArea = null;
    this.$keyframesGroup = null;

    this.#callbacks = callbacks;

    this.maxPosX = $parent.offsetWidth;
    this.maxValue = ~~(($parent.offsetHeight * ENVELOPE_HEIGHT_PERCENT) / 100);

    this.mount();
  }

  render() {
    const { maxValue, maxPosX } = this;

    this.$node = document.createElement('div');
    this.$node.className = 'volume-zone hide';
    this.$node.setAttribute('data-zone-id', this.id);
    this.$parent.appendChild(this.$node);

    this.$volumeArea = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.$volumeArea.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    this.$volumeArea.setAttribute('class', 'volume-area');
    this.$volumeArea.setAttribute('width', maxPosX);
    this.$volumeArea.setAttribute('viewBox', `0 0 ${maxPosX} ${maxValue}`);
    this.$volumeArea.setAttribute('preserveAspectRatio', 'none');
    this.$volumeArea.setAttribute('data-zone-id', this.id);
    this.$node.appendChild(this.$volumeArea);

    this.$hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.$hitArea.setAttribute('class', 'volume-hit-area');
    this.$hitArea.setAttribute('d', '');
    this.$volumeArea.appendChild(this.$hitArea);

    this.$path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.$path.setAttribute('class', 'volume-line');
    this.$path.setAttribute('d', '');
    this.$volumeArea.appendChild(this.$path);

    this.$keyframesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.$keyframesGroup.setAttribute('class', 'keyframes-group');
    this.$volumeArea.appendChild(this.$keyframesGroup);

    this.$refLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.$refLine.setAttribute('class', 'volume-ref-line');
    this.$refLine.setAttribute('x1', '0');
    this.$refLine.setAttribute('x2', maxPosX);
    this.$refLine.setAttribute('y1', maxValue / 2);
    this.$refLine.setAttribute('y2', maxValue / 2);
    this.$refLine.style.display = 'none';
    this.$volumeArea.appendChild(this.$refLine);

    this.$tooltip = document.createElement('div');
    this.$tooltip.className = 'glass-tooltip volume-ref-label';
    this.$tooltip.style.display = 'none';
    this.$node.appendChild(this.$tooltip);
  }

  onMount() {
    this.$volumeArea.addEventListener('contextmenu', this.#handleContextMenu);
    this.$volumeArea.addEventListener('mousedown', this.#handleAreaMouseDown);
    this.$volumeArea.addEventListener('click', this.#handleAreaClick);
    this.$keyframesGroup.addEventListener('mousedown', this.#handleKeyframeMouseDown);
    this.$volumeArea.addEventListener('mousemove', this.#handleMouseMove);
    this.$volumeArea.addEventListener('mouseleave', this.#handleMouseLeave);
  }

  #handleMouseMove = event => {
    const { x: posX, y: relY, rect } = getRelativePos(event, this.$volumeArea);

    if (this.#isDragging) {
      return;
    }

    const posY = relY * (this.maxValue / rect.height);
    const clampedY = clamp(posY, 0, this.maxValue);

    // Update reference line position
    this.$refLine.setAttribute('y1', clampedY);
    this.$refLine.setAttribute('y2', clampedY);
    this.$refLine.style.display = 'block';

    const labelY = (clampedY / this.maxValue) * rect.height;
    this.#showTooltipAt(posX, labelY, clampedY);
  };

  #handleMouseLeave = () => {
    this.$refLine.style.display = 'none';

    if (!this.#isDragging) {
      this.$tooltip.style.display = 'none';
    }
  };

  #handleAreaMouseDown = event => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target;

    if (target.classList.contains('keyframe-point')) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const { x: posX, y: relY, rect } = getRelativePos(event, this.$volumeArea);
    const posY = relY * (this.maxValue / rect.height);

    this.#drawDragState = { rect, startX: posX, startY: posY, started: false };

    document.addEventListener('mousemove', this.#handleDrawDragMove);
    document.addEventListener('mouseup', this.#handleDrawDragEnd);
  };

  #handleDrawDragMove = event => {
    if (!this.#drawDragState) {
      return;
    }

    const { rect, startX, startY, started } = this.#drawDragState;
    const posX = event.clientX - rect.left;
    const relY = event.clientY - rect.top;
    const posY = relY * (this.maxValue / rect.height);

    if (!started) {
      this.#drawDragState.started = true;
      this.#isDragging = true;
      this.#callbacks.onDrawStart?.(startX, startY);
    }

    const clampedY = clamp(posY, 0, this.maxValue);
    const cssY = (clampedY / this.maxValue) * rect.height;
    this.#showTooltipAt(posX, cssY, clampedY);

    this.#callbacks.onDraw?.(posX, posY);
  };

  #handleDrawDragEnd = () => {
    const wasDragging = this.#drawDragState?.started;

    this.#drawDragState = null;
    this.#isDragging = false;
    this.$tooltip.style.display = 'none';

    document.removeEventListener('mousemove', this.#handleDrawDragMove);
    document.removeEventListener('mouseup', this.#handleDrawDragEnd);

    if (wasDragging) {
      this.#justDragged = true;
      this.#callbacks.onDrawEnd?.();
    }
  };

  #showTooltipAt(posX, posY, valueY) {
    // DAW style: top=200%, center=100%, bottom=0%
    const percent = Math.round((1 - valueY / this.maxValue) * 200);
    this.$tooltip.textContent = `${percent}%`;
    this.$tooltip.style.left = `${posX}px`;
    this.$tooltip.style.top = `${posY}px`;
    this.$tooltip.style.display = 'block';
  }

  #handleAreaClick = event => {
    if (this.#justDragged) {
      this.#justDragged = false;

      return;
    }

    const target = event.target;

    if (target.classList.contains('keyframe-point')) {
      return;
    }

    if (target !== this.$path && target !== this.$hitArea) {
      return;
    }

    const { x: posX } = getRelativePos(event, this.$volumeArea);

    this.#callbacks.onInsertKeyframe?.(posX);
  };

  #handleContextMenu = event => {
    event.preventDefault();

    return false;
  };

  #handleKeyframeMouseDown = event => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target;

    if (!target.classList.contains('keyframe-point')) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const pathIndex = parseInt(target.dataset.pathIndex, 10);
    const isStart = target.dataset.isStart === 'true';
    const rect = this.$volumeArea.getBoundingClientRect();

    const cancelOnMouseUp = () => {
      if (this.#clickTimeout) {
        clearTimeout(this.#clickTimeout);
        this.#clickTimeout = null;
      }

      document.removeEventListener('mouseup', cancelOnMouseUp);
    };

    document.addEventListener('mouseup', cancelOnMouseUp);

    this.#clickTimeout = setTimeout(() => {
      this.#clickTimeout = null;
      document.removeEventListener('mouseup', cancelOnMouseUp);

      this.#dragState = { pathIndex, isStart, target, rect };
      this.#isDragging = true;
      target.classList.add('dragging');

      document.addEventListener('mousemove', this.#handleDragMove);
      document.addEventListener('mouseup', this.#handleDragEnd);
    }, 150);
  };

  #handleDragMove = event => {
    if (!this.#dragState) {
      return;
    }

    const { pathIndex, isStart, rect } = this.#dragState;
    const posX = event.clientX - rect.left;
    const relY = event.clientY - rect.top;
    const posY = relY * (this.maxValue / rect.height);

    const clampedY = clamp(posY, 0, this.maxValue);
    const cssY = (clampedY / this.maxValue) * rect.height;
    this.#showTooltipAt(posX, cssY, clampedY);

    this.#callbacks.onMoveKeyframe?.(pathIndex, isStart, posX, posY);
  };

  #handleDragEnd = () => {
    if (this.#dragState) {
      this.#dragState.target.classList.remove('dragging');
      this.#dragState = null;
    }

    this.#isDragging = false;
    this.#justDragged = true;
    this.$tooltip.style.display = 'none';

    document.removeEventListener('mousemove', this.#handleDragMove);
    document.removeEventListener('mouseup', this.#handleDragEnd);
    this.#callbacks.onKeyframeDragEnd?.();
  };

  /** Get max position X */
  getMaxPosX() {
    return this.maxPosX;
  }

  /** Get max value (height) */
  getMaxValue() {
    return this.maxValue;
  }

  /** Resize SVG to new width */
  resize(width) {
    this.maxPosX = width;
    this.$volumeArea.setAttribute('width', width);
    this.$volumeArea.setAttribute('viewBox', `0 0 ${width} ${this.maxValue}`);
    this.$refLine.setAttribute('x2', width);
  }

  /** Enable volume editing */
  enable() {
    show(this.$node, 'hide');
    setEnabled(this.$volumeArea, true);
  }

  /** Disable volume editing */
  disable() {
    hide(this.$node, 'hide');
    setEnabled(this.$volumeArea, false);
  }

  /** Update the SVG path */
  updatePath(pathData) {
    this.$path.setAttribute('d', pathData);
    this.$hitArea.setAttribute('d', pathData);
  }

  updateKeyframes(keyframes) {
    if (this.#isDragging && this.#dragState) {
      keyframes.forEach(kf => {
        const selector = `[data-path-index="${kf.pathIndex}"][data-is-start="${kf.isStart}"]`;
        const existing = this.$keyframesGroup.querySelector(selector);

        if (existing) {
          existing.setAttribute('cx', kf.posX);
          existing.setAttribute('cy', kf.posY);
        }
      });

      return;
    }

    this.$keyframesGroup.innerHTML = '';

    keyframes.forEach(kf => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('class', 'keyframe-point');
      circle.setAttribute('cx', kf.posX);
      circle.setAttribute('cy', kf.posY);
      circle.setAttribute('r', 8);
      circle.setAttribute('data-path-index', kf.pathIndex);
      circle.setAttribute('data-is-start', kf.isStart);

      circle.addEventListener('dblclick', event => {
        event.preventDefault();
        event.stopPropagation();

        if (this.#clickTimeout) {
          clearTimeout(this.#clickTimeout);
          this.#clickTimeout = null;
        }

        this.#callbacks.onRemoveKeyframe?.(kf.pathIndex, kf.isStart);
      });

      this.$keyframesGroup.appendChild(circle);
    });
  }
}
