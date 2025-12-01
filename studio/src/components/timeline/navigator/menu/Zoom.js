import Signals from 'signals';

export default class Zoom {
  constructor($parent) {
    this.$node = null;
    this.zoom = null;
    this.maxZoom = null;
    this.onZoom = new Signals.Signal();

    this.render($parent);
  }

  init(scaleList) {
    this.maxZoom = scaleList.length - 1;
    this.zoom = 0;

    return true;
  }

  render($parent) {
    this.$node = document.createElement('div');
    this.$node.className = 'btn-group btn-group-sm ms-auto';
    $parent.appendChild(this.$node);

    const $zoomOut = document.createElement('button');
    $zoomOut.className = 'btn btn-outline-info';
    $zoomOut.title = 'Zoom out';
    $zoomOut.innerHTML = '<i class="bi bi-zoom-out"></i>';
    $zoomOut.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      const zoomNow = this.zoom;
      this.zoom = this.zoom - 1 > 0 ? this.zoom - 1 : 0;

      if (this.maxZoom !== null && zoomNow !== 0) {
        this.onZoom.dispatch(this.zoom);
      }
    });
    this.$node.appendChild($zoomOut);

    const $zoomIn = document.createElement('button');
    $zoomIn.className = 'btn btn-outline-info';
    $zoomIn.title = 'Zoom in';
    $zoomIn.innerHTML = '<i class="bi bi-zoom-in"></i>';
    $zoomIn.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      const zoomNow = this.zoom;
      this.zoom = this.zoom + 1 < this.maxZoom ? this.zoom + 1 : this.maxZoom;

      if (this.maxZoom !== null && zoomNow !== this.maxZoom) {
        this.onZoom.dispatch(this.zoom);
      }
    });
    this.$node.appendChild($zoomIn);
  }
}
