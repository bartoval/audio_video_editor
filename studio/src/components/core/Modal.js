import { LABEL } from '../../constants';

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
  // Protected - accessible by subclasses
  $modal = null;
  $backdrop = null;
  $body = null;

  // Private
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

  // ============================================================================
  // Public API
  // ============================================================================

  show(options = {}) {
    const {
      title,
      body = '',
      confirmText = LABEL.CREATE,
      confirmClass = 'btn-primary',
      cancelText = LABEL.CANCEL,
      showFooter = true,
      onConfirm,
      onCancel
    } = options;

    if (title && this.#$title) {
      this.#$title.textContent = title;
    }

    if (this.$body) {
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

  getBody() {
    return this.$body;
  }

  destroy() {
    this.$modal?.remove();
    this.$backdrop?.remove();
    this.$modal = null;
    this.$backdrop = null;
  }

  // ============================================================================
  // Protected - Override in subclasses
  // ============================================================================

  template() {
    const { title = '' } = this.#options;

    return `
      <div class="modal-dialog modal-dialog-centered">
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
    return 'modal fade';
  }

  onShow() {
    // Focus first input if present
    setTimeout(() => {
      const $input = this.$body?.querySelector('input');
      $input?.focus();
    }, 100);
  }

  onHide() {
    // Override in subclasses
  }

  // ============================================================================
  // Protected - Render
  // ============================================================================

  render() {
    // Backdrop
    this.$backdrop = document.createElement('div');
    this.$backdrop.className = this.backdropClass();
    this.$backdrop.style.display = 'none';
    this.$backdrop.addEventListener('click', () => this.handleClose());

    // Modal
    this.$modal = document.createElement('div');
    this.$modal.className = this.modalClass();
    this.$modal.tabIndex = -1;
    this.$modal.innerHTML = this.template();

    // Query refs
    this.#$title = this.$modal.querySelector('[data-ref="title"]');
    this.$body = this.$modal.querySelector('[data-ref="body"]');
    this.#$confirmBtn = this.$modal.querySelector('[data-ref="confirm"]');
    this.#$cancelBtn = this.$modal.querySelector('[data-ref="cancel"]');
    this.#$footer = this.$modal.querySelector('[data-ref="footer"]');

    // Events - close buttons
    this.$modal.querySelectorAll('[data-action="close"]').forEach($el => {
      $el.addEventListener('click', () => this.handleClose());
    });

    // Click outside modal content
    this.$modal.addEventListener('click', e => {
      if (e.target === this.$modal) {
        this.handleClose();
      }
    });

    // Confirm/Cancel buttons
    this.#$cancelBtn?.addEventListener('click', () => this.handleClose());
    this.#$confirmBtn?.addEventListener('click', () => this.handleConfirm());

    // Keyboard
    this.$modal.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        e.preventDefault();
        this.handleConfirm();
      }

      if (e.key === 'Escape') {
        this.handleClose();
      }
    });

    document.body.appendChild(this.$backdrop);
    document.body.appendChild(this.$modal);
  }

  // ============================================================================
  // Protected - Handlers (can be overridden)
  // ============================================================================

  handleConfirm() {
    this.#onConfirm?.();
  }

  handleClose() {
    this.#onCancel?.();
    this.hide();
  }
}
