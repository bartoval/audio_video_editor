import RulerView from '../ruler/RulerView';
import MinimapView from './MinimapView';

/**
 * Minimap Presenter - Orchestrates state, drag/resize logic, and RulerView
 *
 * Features:
 * - RulerView as background showing full timeline
 * - Viewport rectangle shows current visible area
 * - Click to navigate, drag viewport to pan
 * - Resize handles to zoom via viewport width
 */
export default class MinimapPresenter {
  #view = null;
  #ruler = null;
  #duration = 0;
  #barWidth = 0;
  #scaleFactorX = 1;
  #viewportWidth = 0;
  #viewportPosX = 0;
  #minViewportWidth = 20;
  #maxViewportWidth = 0;
  #isDragging = false;
  #wasDragging = false;
  #dragStartX = 0;
  #dragStartViewportX = 0;
  #isResizing = false;
  #resizeEdge = null;
  #resizeStartX = 0;
  #resizeStartWidth = 0;
  #resizeStartPosX = 0;
  #isUserResizing = false;
  #onNavigate = null;
  #onZoom = null;

  constructor($parent, callbacks = {}) {
    this.#onNavigate = callbacks.onNavigate || (() => {});
    this.#onZoom = callbacks.onZoom || null;

    this.#view = new MinimapView($parent, {
      onTrackClick: event => this.#handleClick(event),
      onViewportDragStart: (event, clickX) => this.#handleViewportDragStart(event, clickX),
      onResizeStart: (event, edge) => this.#startResize(event, edge),
      onWheel: event => this.#handleWheel(event)
    });

    this.#ruler = new RulerView(this.#view.getRulerContainer());
  }

  init(duration) {
    this.#duration = duration;
    this.#barWidth = this.#view.getTrackWidth();
    this.#scaleFactorX = this.#barWidth / duration;
    this.#maxViewportWidth = this.#barWidth;

    this.#ruler.initMinimap(duration);

    return true;
  }

  updateViewport(viewportStartTime, viewportEndTime) {
    if (this.#isUserResizing) {
      return;
    }

    const startX = viewportStartTime * this.#scaleFactorX;
    const endX = viewportEndTime * this.#scaleFactorX;
    const width = Math.max(this.#minViewportWidth, endX - startX);

    this.#viewportPosX = startX;
    this.#viewportWidth = width;

    this.#view.setViewport(startX, width);
  }

  updatePlayhead(time) {
    const posX = time * this.#scaleFactorX;
    this.#view.setPlayhead(posX);
  }

  renderMarkers(markers) {
    this.#view.renderMarkers(markers, this.#scaleFactorX);
  }

  zoom() {
    this.#barWidth = this.#view.getTrackWidth();
    this.#scaleFactorX = this.#barWidth / this.#duration;
    this.#maxViewportWidth = this.#barWidth;
  }

  setDuration(duration) {
    this.#duration = duration;
    this.#scaleFactorX = this.#barWidth / duration;
    this.#ruler.initMinimap(duration);
  }

  destroy() {
    document.removeEventListener('mousemove', this.#handleMouseMove);
    document.removeEventListener('mouseup', this.#handleMouseUp);
    document.removeEventListener('mousemove', this.#handleResizeMove);
    document.removeEventListener('mouseup', this.#handleResizeUp);
    window.removeEventListener('blur', this.#handleResizeUp);

    this.#ruler?.destroy();
    this.#view?.destroy();

    this.#ruler = null;
    this.#view = null;
    this.#onNavigate = null;
    this.#onZoom = null;
  }

  #handleClick = event => {
    if (this.#wasDragging) {
      this.#wasDragging = false;

      return;
    }

    const clickX = this.#view.getClickPosition(event.clientX);
    const time = Math.max(0, Math.min(clickX / this.#scaleFactorX, this.#duration));

    this.#onNavigate(time);
  };

  #handleViewportDragStart = (event, clickX) => {
    if (clickX < this.#viewportPosX || clickX > this.#viewportPosX + this.#viewportWidth) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.#isDragging = true;
    this.#dragStartX = event.clientX;
    this.#dragStartViewportX = this.#viewportPosX;

    this.#view.setCursor('grabbing');

    document.addEventListener('mousemove', this.#handleMouseMove);
    document.addEventListener('mouseup', this.#handleMouseUp);
  };

  #handleMouseMove = event => {
    if (!this.#isDragging) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const deltaX = event.clientX - this.#dragStartX;
    let newPosX = this.#dragStartViewportX + deltaX;

    const maxPosX = this.#barWidth - this.#viewportWidth;
    newPosX = Math.max(0, Math.min(newPosX, maxPosX));

    this.#viewportPosX = newPosX;
    this.#view.setViewport(newPosX, this.#viewportWidth);

    const time = newPosX / this.#scaleFactorX;
    this.#onNavigate(time);
  };

  #handleMouseUp = () => {
    if (this.#isDragging) {
      this.#wasDragging = true;
    }

    this.#isDragging = false;
    this.#view.setCursor('');

    document.removeEventListener('mousemove', this.#handleMouseMove);
    document.removeEventListener('mouseup', this.#handleMouseUp);
  };

  #startResize(event, edge) {
    event.preventDefault();
    event.stopPropagation();

    this.#isResizing = true;
    this.#isUserResizing = true;
    this.#resizeEdge = edge;
    this.#resizeStartX = event.clientX;
    this.#resizeStartWidth = this.#viewportWidth;
    this.#resizeStartPosX = this.#viewportPosX;

    this.#view.setCursor('ew-resize');

    if (event.target.setPointerCapture && event.pointerId !== undefined) {
      event.target.setPointerCapture(event.pointerId);
    }

    document.addEventListener('mousemove', this.#handleResizeMove);
    document.addEventListener('mouseup', this.#handleResizeUp);
    window.addEventListener('blur', this.#handleResizeUp);
  }

  #handleResizeMove = event => {
    if (!this.#isResizing) {
      return;
    }

    event.preventDefault();

    const deltaX = event.clientX - this.#resizeStartX;
    let newWidth, newPosX;

    if (this.#resizeEdge === 'left') {
      newWidth = this.#resizeStartWidth - deltaX;
      newPosX = this.#resizeStartPosX + deltaX;

      if (newWidth < this.#minViewportWidth) {
        newWidth = this.#minViewportWidth;
        newPosX = this.#resizeStartPosX + this.#resizeStartWidth - this.#minViewportWidth;
      }

      if (newWidth > this.#maxViewportWidth) {
        newWidth = this.#maxViewportWidth;
        newPosX = 0;
      }

      if (newPosX < 0) {
        newPosX = 0;
        newWidth = this.#resizeStartPosX + this.#resizeStartWidth;
      }
    } else {
      newWidth = this.#resizeStartWidth + deltaX;
      newPosX = this.#resizeStartPosX;

      newWidth = Math.max(this.#minViewportWidth, Math.min(newWidth, this.#barWidth - newPosX));
    }

    this.#viewportWidth = newWidth;
    this.#viewportPosX = newPosX;

    this.#view.setViewport(newPosX, newWidth);
    this.#emitZoom();
  };

  #handleResizeUp = () => {
    this.#isResizing = false;
    this.#isUserResizing = false;
    this.#resizeEdge = null;
    this.#wasDragging = true;

    this.#view.setCursor('');

    document.removeEventListener('mousemove', this.#handleResizeMove);
    document.removeEventListener('mouseup', this.#handleResizeUp);
    window.removeEventListener('blur', this.#handleResizeUp);
  };

  #handleWheel = event => {
    if (!event.altKey && !event.shiftKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.#isUserResizing = true;

    const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;
    const centerX = this.#viewportPosX + this.#viewportWidth / 2;

    let newWidth = this.#viewportWidth * zoomFactor;
    newWidth = Math.max(this.#minViewportWidth, Math.min(newWidth, this.#maxViewportWidth));

    let newPosX = centerX - newWidth / 2;
    newPosX = Math.max(0, Math.min(newPosX, this.#barWidth - newWidth));

    this.#viewportWidth = newWidth;
    this.#viewportPosX = newPosX;

    this.#view.setViewport(newPosX, newWidth);
    this.#emitZoom();

    requestAnimationFrame(() => {
      this.#isUserResizing = false;
    });
  };

  #emitZoom() {
    if (!this.#onZoom) {
      console.warn('[Minimap] onZoom callback not set');

      return;
    }

    const visibleDuration = this.#viewportWidth / this.#scaleFactorX;
    const startTime = this.#viewportPosX / this.#scaleFactorX;
    const endTime = startTime + visibleDuration;

    this.#onZoom({ startTime, endTime, visibleDuration, resizeEdge: this.#resizeEdge });
  }
}
