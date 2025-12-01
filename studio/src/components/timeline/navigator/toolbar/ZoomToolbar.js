import { Signals, View } from '../../../../lib';

/** Zoom in/out toolbar */
export default class ZoomToolbar extends View {
  #zoom = null;
  #maxZoom = null;

  onZoom = new Signals.Signal();

  constructor($parent) {
    super($parent);
    this.mount();
  }

  template() {
    return `
      <div class="btn-group ms-auto">
        <button data-action="out" class="btn btn-outline-info" title="Zoom out">
          <i class="bi bi-zoom-out"></i>
        </button>
        <button data-action="in" class="btn btn-outline-info" title="Zoom in">
          <i class="bi bi-zoom-in"></i>
        </button>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);
  }

  onMount() {
    this.$node.addEventListener('click', this.#handleClick);
  }

  init(scaleList, initialZoom = 0) {
    this.#maxZoom = scaleList.length - 1;
    this.#zoom = initialZoom;

    return true;
  }

  // ============================================================================
  // Private
  // ============================================================================

  #handleClick = e => {
    const $target = e.target.closest('[data-action]');

    if (!$target) {
      return;
    }

    e.stopPropagation();
    e.preventDefault();

    const { action } = $target.dataset;

    if (action === 'out') {
      this.#zoomOut();
    } else if (action === 'in') {
      this.#zoomIn();
    }
  };

  /**
   * Zoom in = show more detail = decrease scale index
   * Scale index 0 = smallest scale (0.01) = most zoomed in
   */
  #zoomIn() {
    if (this.#zoom <= 0) {
      return;
    }

    this.#zoom--;
    this.onZoom.dispatch(this.#zoom);
  }

  /**
   * Zoom out = show less detail = increase scale index
   * Higher scale index = larger scale = more zoomed out
   */
  #zoomOut() {
    if (this.#zoom >= this.#maxZoom) {
      return;
    }

    this.#zoom++;
    this.onZoom.dispatch(this.#zoom);
  }
}
