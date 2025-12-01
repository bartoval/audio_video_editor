import Mediator from '../Mediator';
import { View } from '../../lib';
import { TOAST_DURATION, Z_INDEX } from '../../config/ui';

const TOAST_CLASSES = {
  success: 'text-bg-success',
  error: 'text-bg-danger',
  warning: 'text-bg-warning'
};

export default class Toast extends View {
  #$body = null;
  #$details = null;
  #$detailsBtn = null;
  #$closeBtn = null;
  #hideTimeout = null;

  constructor($parent) {
    super($parent);
    this.mount();
  }

  template() {
    return `
      <div class="toast align-items-center border-0 position-fixed top-0 end-0 m-3" role="alert" style="z-index: ${Z_INDEX.toast}; pointer-events: none; max-width: 400px;">
        <div class="d-flex">
          <div data-ref="body" class="toast-body"></div>
          <button data-ref="details" type="button" class="btn btn-sm btn-link text-white p-0 me-2 m-auto" style="display: none; font-size: 0.75rem;">Details</button>
          <button data-ref="close" type="button" class="btn-close btn-close-white me-2 m-auto" aria-label="Close"></button>
        </div>
        <div data-ref="details-content" class="toast-body pt-0" style="display: none; font-size: 0.75rem; opacity: 0.8; word-break: break-all;"></div>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);

    this.#$body = this.$node.querySelector('[data-ref="body"]');
    this.#$details = this.$node.querySelector('[data-ref="details-content"]');
    this.#$detailsBtn = this.$node.querySelector('[data-ref="details"]');
    this.#$closeBtn = this.$node.querySelector('[data-ref="close"]');
  }

  onMount() {
    Mediator.registerToast(this);
    this.#$closeBtn.addEventListener('click', () => this.#hide());
    this.#$detailsBtn.addEventListener('click', () => this.#toggleDetails());
  }

  show({ type = 'success', msg = '', details = '', timeHide = TOAST_DURATION.default } = {}) {
    if (!type) {
      return false;
    }

    if (this.#hideTimeout) {
      clearTimeout(this.#hideTimeout);
      this.#hideTimeout = null;
    }

    this.#$body.innerHTML = msg || type;
    this.#$details.textContent = details;
    this.#$details.style.display = 'none';
    this.#$detailsBtn.style.display = details ? 'block' : 'none';
    this.#$detailsBtn.textContent = 'Details';

    Object.values(TOAST_CLASSES).forEach(cls => this.$node.classList.remove(cls));
    this.$node.classList.add(TOAST_CLASSES[type] || TOAST_CLASSES.success);

    this.$node.classList.add('show');
    this.$node.style.pointerEvents = 'auto';

    if (timeHide > 0) {
      this.#hideTimeout = setTimeout(() => this.#hide(), timeHide);
    }

    return true;
  }

  #toggleDetails() {
    const isVisible = this.#$details.style.display !== 'none';
    this.#$details.style.display = isVisible ? 'none' : 'block';
    this.#$detailsBtn.textContent = isVisible ? 'Details' : 'Hide';

    if (this.#hideTimeout) {
      clearTimeout(this.#hideTimeout);
      this.#hideTimeout = null;
    }
  }

  #hide() {
    this.$node.classList.remove('show');
    this.$node.style.pointerEvents = 'none';
    this.#hideTimeout = null;
  }
}
