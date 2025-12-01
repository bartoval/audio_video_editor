import Mediator from 'Mediator';
import { createElement, toggleClass } from 'utils/dom';

const TOAST_CLASSES = {
  success: 'text-bg-success',
  error: 'text-bg-danger',
  warning: 'text-bg-warning'
};

export default class Notificator {
  constructor($parent) {
    this.$node = null;
    this.$toastBody = null;
    this.timeHide = 3000;

    this.render($parent);
    Mediator.registerNotificator(this);
  }

  init() {}

  setMessage({ type = 'success', msg = '', timeHide = 3000 } = {}) {
    if (!type) {
      return false;
    }

    this.$toastBody.innerHTML = msg || type;

    Object.values(TOAST_CLASSES).forEach(cls => this.$node.classList.remove(cls));
    this.$node.classList.add(TOAST_CLASSES[type] || TOAST_CLASSES.success);

    this.$node.classList.add('show');
    this.$node.style.pointerEvents = 'auto';

    if (timeHide > 0) {
      setTimeout(() => this._hide(), timeHide);
    }

    return true;
  }

  _hide() {
    this.$node.classList.remove('show');
    this.$node.style.pointerEvents = 'none';
  }

  render($parent) {
    this.$node = createElement('div', {
      className: 'toast align-items-center border-0 position-fixed top-0 end-0 m-3',
      attributes: { role: 'alert' },
      styles: { zIndex: '1100', pointerEvents: 'none' },
      html: `
        <div class="d-flex">
          <div class="toast-body"></div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" aria-label="Close"></button>
        </div>
      `,
      parent: $parent
    });

    this.$toastBody = this.$node.querySelector('.toast-body');
    this.$node.querySelector('.btn-close').addEventListener('click', () => this._hide());
  }
}
