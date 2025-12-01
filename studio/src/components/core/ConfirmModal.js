import Modal from './Modal';
import { LABEL } from '../../constants';

/**
 * ConfirmModal - modal for confirmation dialogs
 *
 * Usage:
 *   const confirmed = await ConfirmModal.show({
 *     title: 'Delete Track',
 *     message: 'Are you sure you want to delete this track?',
 *     confirmText: 'Delete',
 *     danger: true
 *   });
 */
class ConfirmModal extends Modal {
  static #instance = null;

  constructor() {
    super({ title: LABEL.CONFIRM });
  }

  // ============================================================================
  // Static API
  // ============================================================================

  static getInstance() {
    if (!ConfirmModal.#instance) {
      ConfirmModal.#instance = new ConfirmModal();
    }

    return ConfirmModal.#instance;
  }

  static show(options) {
    return ConfirmModal.getInstance().confirm(options);
  }

  // ============================================================================
  // Instance API
  // ============================================================================

  confirm(options = {}) {
    const {
      title = LABEL.CONFIRM,
      message = '',
      confirmText = LABEL.DELETE,
      cancelText = LABEL.CANCEL,
      danger = false
    } = options;

    return new Promise(resolve => {
      super.show({
        title,
        body: `<p class="mb-0">${message}</p>`,
        confirmText,
        confirmClass: danger ? 'btn-danger' : 'btn-primary',
        cancelText,
        onConfirm: () => {
          this.hide();
          resolve(true);
        },
        onCancel: () => {
          resolve(false);
        }
      });
    });
  }
}

export default ConfirmModal;
