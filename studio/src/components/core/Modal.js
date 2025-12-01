import { LABEL } from '../../config/constants';

/**
 * Modal - reusable Bootstrap-style modal component
 *
 * Can be extended for custom modals by overriding:
 * - template() - custom modal content
 * - onShow() - called after modal is shown
 * - onHide() - called before modal is hidden
 *
 * Usage:
 *   const modal = new Modal({ title: 'Confirm' });
 *   modal.show({ body: '<p>Are you sure?</p>', confirmText: 'Yes', onConfirm: () => {} });
 *   modal.hide();
 */
export default class Modal {
  $modal = null;
  $backdrop = null;
  $body = null;

  #$title = null;
  #$confirmBtn = null;
  #$cancelBtn = null;
  #$footer = null;
  #onConfirm = null;
  #onCancel = null;
  #options = {};

  constructor(options = {}) {
    this.#options = options;
    this.#onConfirm = options.onConfirm || null;
    this.#onCancel = options.onCancel || null;
    this.render();
  }

  show(options = {}) {
    const {
      title,
      body = '',
      confirmText = LABEL.CREATE,
      confirmClass = 'btn-primary',
      cancelText = LABEL.CANCEL,
      showFooter = true,
      onConfirm,
      onCancel,
      preserveBody = false
    } = options;

    if (title && this.#$title) {
      this.#$title.textContent = title;
    }

    if (this.$body && !preserveBody) {
      this.$body.innerHTML = body;
    }

    if (this.#$confirmBtn) {
      this.#$confirmBtn.textContent = confirmText;
      this.#$confirmBtn.className = `btn ${confirmClass}`;
    }

    if (this.#$cancelBtn) {
      this.#$cancelBtn.textContent = cancelText;
    }

    if (this.#$footer) {
      this.#$footer.style.display = showFooter ? '' : 'none';
    }

    if (onConfirm) {
      this.#onConfirm = onConfirm;
    }

    if (onCancel) {
      this.#onCancel = onCancel;
    }

    this.$backdrop.classList.add('show');
    this.$backdrop.style.display = 'block';
    this.$modal.classList.add('show');
    this.$modal.style.display = 'block';
    document.body.classList.add('modal-open');

    this.onShow();
  }

  hide() {
    this.onHide();

    this.$backdrop.classList.remove('show');
    this.$backdrop.style.display = 'none';
    this.$modal.classList.remove('show');
    this.$modal.style.display = 'none';
    document.body.classList.remove('modal-open');
  }

  setBody(html) {
    if (this.$body) {
      this.$body.innerHTML = html;
    }
  }

  destroy() {
    this.$modal?.remove();
    this.$backdrop?.remove();
    this.$modal = null;
    this.$backdrop = null;
  }

  /** Return modal body element for embedding custom views */
  getBody() {
    return this.$body;
  }

  template() {
    const { title = '', size = '' } = this.#options;
    const sizeClass = size ? `modal-${size}` : '';

    return `
      <div class="modal-dialog modal-dialog-centered ${sizeClass}">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" data-ref="title">${title}</h5>
            <button type="button" class="btn-close" data-action="close"></button>
          </div>
          <div class="modal-body" data-ref="body"></div>
          <div class="modal-footer" data-ref="footer">
            <button type="button" class="btn btn-secondary" data-ref="cancel">${LABEL.CANCEL}</button>
            <button type="button" class="btn btn-primary" data-ref="confirm">${LABEL.CREATE}</button>
          </div>
        </div>
      </div>
    `;
  }

  backdropClass() {
    return 'modal-backdrop fade';
  }

  modalClass() {
    const { className = '' } = this.#options;

    return `modal fade ${className}`.trim();
  }

  onShow() {
    setTimeout(() => {
      const $input = this.$body?.querySelector('input');
      $input?.focus();
    }, 100);
  }

  onHide() {}

  render() {
    this.$backdrop = document.createElement('div');
    this.$backdrop.className = this.backdropClass();
    this.$backdrop.style.display = 'none';
    this.$backdrop.addEventListener('click', () => this.handleClose());

    this.$modal = document.createElement('div');
    this.$modal.className = this.modalClass();
    this.$modal.tabIndex = -1;
    this.$modal.innerHTML = this.template();

    this.#$title = this.$modal.querySelector('[data-ref="title"]');
    this.$body = this.$modal.querySelector('[data-ref="body"]');
    this.#$confirmBtn = this.$modal.querySelector('[data-ref="confirm"]');
    this.#$cancelBtn = this.$modal.querySelector('[data-ref="cancel"]');
    this.#$footer = this.$modal.querySelector('[data-ref="footer"]');

    this.$modal.querySelectorAll('[data-action="close"]').forEach($el => {
      $el.addEventListener('click', () => this.handleClose());
    });

    this.$modal.addEventListener('click', event => {
      if (event.target === this.$modal) {
        this.handleClose();
      }
    });

    this.#$cancelBtn?.addEventListener('click', () => this.handleClose());
    this.#$confirmBtn?.addEventListener('click', () => this.handleConfirm());

    this.$modal.addEventListener('keydown', event => {
      if (event.key === 'Enter' && event.target.tagName === 'INPUT') {
        event.preventDefault();
        this.handleConfirm();
      }

      if (event.key === 'Escape') {
        this.handleClose();
      }
    });

    document.body.appendChild(this.$backdrop);
    document.body.appendChild(this.$modal);
  }

  handleConfirm() {
    this.#onConfirm?.();
  }

  handleClose() {
    this.#onCancel?.();
    this.hide();
  }
}
