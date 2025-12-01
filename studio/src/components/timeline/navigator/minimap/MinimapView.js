import { View, applyTransform3d } from '../../../../lib';

/** Pure view for Minimap - handles DOM rendering and user interactions */
export default class MinimapView extends View {
  #$track = null;
  #$rulerContainer = null;
  #$markersContainer = null;
  #$viewport = null;
  #$playhead = null;
  #$handleLeft = null;
  #$handleRight = null;

  #onTrackClick = null;
  #onViewportDragStart = null;
  #onResizeStart = null;
  #onWheel = null;

  constructor($parent, callbacks = {}) {
    super($parent);

    this.#onTrackClick = callbacks.onTrackClick || (() => {});
    this.#onViewportDragStart = callbacks.onViewportDragStart || (() => {});
    this.#onResizeStart = callbacks.onResizeStart || (() => {});
    this.#onWheel = callbacks.onWheel || (() => {});

    this.mount();
  }

  render() {
    this.$node = document.createElement('div');
    this.$node.className = 'minimap';
    this.$node.dataset.testid = 'minimap';

    this.#$track = document.createElement('div');
    this.#$track.className = 'minimap-track';

    this.#$rulerContainer = document.createElement('div');
    this.#$rulerContainer.className = 'minimap-ruler';

    this.#$markersContainer = document.createElement('div');
    this.#$markersContainer.className = 'minimap-markers';

    this.#$viewport = document.createElement('div');
    this.#$viewport.className = 'minimap-viewport';
    this.#$viewport.setAttribute('role', 'slider');
    this.#$viewport.setAttribute('aria-label', 'Timeline viewport');
    this.#$viewport.setAttribute('tabindex', '0');

    this.#$handleLeft = document.createElement('div');
    this.#$handleLeft.className = 'minimap-handle minimap-handle-left';
    this.#$handleLeft.setAttribute('aria-label', 'Resize left');

    this.#$handleRight = document.createElement('div');
    this.#$handleRight.className = 'minimap-handle minimap-handle-right';
    this.#$handleRight.setAttribute('aria-label', 'Resize right');

    this.#$playhead = document.createElement('div');
    this.#$playhead.className = 'minimap-playhead';

    this.#$viewport.appendChild(this.#$handleLeft);
    this.#$viewport.appendChild(this.#$handleRight);

    this.#$track.appendChild(this.#$rulerContainer);
    this.#$track.appendChild(this.#$markersContainer);
    this.#$track.appendChild(this.#$viewport);
    this.#$track.appendChild(this.#$playhead);

    this.$node.appendChild(this.#$track);
    this.$parent.appendChild(this.$node);
  }

  onMount() {
    this.#$track.addEventListener('mousedown', this.#handleMouseDown);
    this.#$track.addEventListener('click', this.#handleClick);
    this.#$track.addEventListener('wheel', this.#handleWheel, { passive: false });
  }

  onDestroy() {
    this.#$track?.removeEventListener('mousedown', this.#handleMouseDown);
    this.#$track?.removeEventListener('click', this.#handleClick);
    this.#$track?.removeEventListener('wheel', this.#handleWheel);

    super.onDestroy();
  }

  getRulerContainer() {
    return this.#$rulerContainer;
  }

  getTrackWidth() {
    return this.#$track?.offsetWidth || 0;
  }

  setViewport(posX, width) {
    this.#$viewport.style.left = `${posX}px`;
    this.#$viewport.style.width = `${width}px`;
  }

  setPlayhead(posX) {
    applyTransform3d(this.#$playhead, posX, 0, 0);
  }

  renderMarkers(markers, scaleFactorX) {
    const $fragment = document.createDocumentFragment();

    markers.forEach(marker => {
      const $marker = document.createElement('div');
      $marker.className = 'minimap-marker';
      $marker.style.left = `${marker.time * scaleFactorX}px`;
      $fragment.appendChild($marker);
    });

    this.#$markersContainer.replaceChildren($fragment);
  }

  isOnHandle(clientX, clientY, edge) {
    const handle = edge === 'left' ? this.#$handleLeft : this.#$handleRight;
    const rect = handle.getBoundingClientRect();

    return (
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    );
  }

  getClickPosition(clientX) {
    const rect = this.#$track.getBoundingClientRect();

    return clientX - rect.left;
  }

  setCursor(cursor) {
    document.body.style.cursor = cursor;
    document.body.style.userSelect = cursor ? 'none' : '';
  }

  #handleClick = event => {
    this.#onTrackClick(event);
  };

  #handleMouseDown = event => {
    const clickX = this.getClickPosition(event.clientX);

    if (this.isOnHandle(event.clientX, event.clientY, 'left')) {
      this.#onResizeStart(event, 'left');

      return;
    }

    if (this.isOnHandle(event.clientX, event.clientY, 'right')) {
      this.#onResizeStart(event, 'right');

      return;
    }

    this.#onViewportDragStart(event, clickX);
  };

  #handleWheel = event => {
    this.#onWheel(event);
  };
}
