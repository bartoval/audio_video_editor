import { View, isOnline } from '../../lib';
import { CONNECTION_STATUS, LABEL } from '../../constants';
import {
  isWasmEnabled,
  isWasmSupported,
  setWasmEnabled,
  isWorkerEnabled,
  isWorkerSupported,
  setWorkerEnabled,
  isParallelStretchEnabled,
  setParallelStretchEnabled
} from '../../lib/audio/wasm';
import { ServiceWorker } from '../../services/offline';
import { isTilesModeEnabled, setTilesModeEnabled } from '../../services/ThumbsMode';

/**
 * StatusBar - displays connection status and processing options
 */
export default class StatusBar extends View {
  #status = CONNECTION_STATUS.ONLINE;
  #$wasmCheckbox = null;
  #$workerCheckbox = null;
  #$offlineCheckbox = null;
  #$parallelStretchCheckbox = null;
  #$tilesModeCheckbox = null;

  constructor($parent) {
    super($parent);
    this.#status = isOnline() ? CONNECTION_STATUS.ONLINE : CONNECTION_STATUS.OFFLINE;
    this.mount();
  }

  template() {
    const isOnlineStatus = this.#status === CONNECTION_STATUS.ONLINE;
    const icon = isOnlineStatus ? 'bi-wifi' : 'bi-wifi-off';
    const label = isOnlineStatus ? LABEL.STATUS_ONLINE : LABEL.STATUS_OFFLINE;
    const statusClass = isOnlineStatus ? 'status-online' : 'status-offline';

    const wasmSupported = isWasmSupported();
    const wasmTitle = wasmSupported ? LABEL.WASM_BROWSER : LABEL.WASM_SERVER;
    const workerSupported = isWorkerSupported();
    const workerTitle = workerSupported ? LABEL.WORKER_ENABLED : LABEL.WORKER_DISABLED;
    const offlineSupported = ServiceWorker.isSupported();
    const offlineTitle = ServiceWorker.isEnabled() ? LABEL.OFFLINE_ENABLED : LABEL.OFFLINE_DISABLED;
    const parallelStretchTitle = isParallelStretchEnabled()
      ? LABEL.PARALLEL_STRETCH_ENABLED
      : LABEL.PARALLEL_STRETCH_DISABLED;
    const tilesModeTitle = isTilesModeEnabled()
      ? LABEL.TILES_MODE_ENABLED
      : LABEL.TILES_MODE_DISABLED;

    return `
      <div class="studio-statusbar d-flex align-items-center justify-content-between">
        <div class="d-flex align-items-center gap-3">
          <div class="status-indicator ${statusClass} d-flex align-items-center gap-2">
            <span class="status-dot"></span>
            <i class="bi ${icon}"></i>
            <span class="status-label">${label}</span>
          </div>
          <label class="d-flex align-items-center gap-1 small text-secondary mb-0" style="cursor: pointer">
            <input type="checkbox" class="form-check-input mt-0" data-ref="wasm-toggle"
                   ${isWasmEnabled() ? 'checked' : ''} ${!wasmSupported ? 'disabled' : ''}>
            <span title="${wasmTitle}">${LABEL.WASM}</span>
          </label>
          <label class="d-flex align-items-center gap-1 small text-secondary mb-0" style="cursor: pointer">
            <input type="checkbox" class="form-check-input mt-0" data-ref="worker-toggle"
                   ${isWorkerEnabled() ? 'checked' : ''} ${!workerSupported ? 'disabled' : ''}>
            <span title="${workerTitle}">${LABEL.WORKER}</span>
          </label>
          <label class="d-flex align-items-center gap-1 small text-secondary mb-0" style="cursor: pointer">
            <input type="checkbox" class="form-check-input mt-0" data-ref="parallel-stretch-toggle"
                   ${isParallelStretchEnabled() ? 'checked' : ''} ${!workerSupported ? 'disabled' : ''}>
            <span title="${parallelStretchTitle}">${LABEL.PARALLEL_STRETCH}</span>
          </label>
          <label class="d-flex align-items-center gap-1 small text-secondary mb-0" style="cursor: pointer">
            <input type="checkbox" class="form-check-input mt-0" data-ref="offline-toggle"
                   ${ServiceWorker.isEnabled() ? 'checked' : ''} ${!offlineSupported ? 'disabled' : ''}>
            <span title="${offlineTitle}">${LABEL.OFFLINE}</span>
          </label>
          <label class="d-flex align-items-center gap-1 small text-secondary mb-0" style="cursor: pointer">
            <input type="checkbox" class="form-check-input mt-0" data-ref="tiles-mode-toggle"
                   ${isTilesModeEnabled() ? 'checked' : ''}>
            <span title="${tilesModeTitle}">${LABEL.TILES_MODE}</span>
          </label>
        </div>
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
    window.addEventListener('online', this.#handleOnline);
    window.addEventListener('offline', this.#handleOffline);

    this.#$wasmCheckbox = this.$node.querySelector('[data-ref="wasm-toggle"]');
    this.#$wasmCheckbox.addEventListener('change', this.#handleWasmToggle);

    this.#$workerCheckbox = this.$node.querySelector('[data-ref="worker-toggle"]');
    this.#$workerCheckbox.addEventListener('change', this.#handleWorkerToggle);

    this.#$offlineCheckbox = this.$node.querySelector('[data-ref="offline-toggle"]');
    this.#$offlineCheckbox.addEventListener('change', this.#handleOfflineToggle);

    this.#$parallelStretchCheckbox = this.$node.querySelector(
      '[data-ref="parallel-stretch-toggle"]'
    );
    this.#$parallelStretchCheckbox.addEventListener('change', this.#handleParallelStretchToggle);

    this.#$tilesModeCheckbox = this.$node.querySelector('[data-ref="tiles-mode-toggle"]');
    this.#$tilesModeCheckbox.addEventListener('change', this.#handleTilesModeToggle);
  }

  onDestroy() {
    window.removeEventListener('online', this.#handleOnline);
    window.removeEventListener('offline', this.#handleOffline);
    super.onDestroy();
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  #handleOnline = () => {
    this.#setStatus(CONNECTION_STATUS.ONLINE);
  };

  #handleOffline = () => {
    this.#setStatus(CONNECTION_STATUS.OFFLINE);
  };

  #handleWasmToggle = e => {
    setWasmEnabled(e.target.checked);
    console.log('[WASM]', e.target.checked ? 'enabled' : 'disabled');
  };

  #handleWorkerToggle = e => {
    setWorkerEnabled(e.target.checked);
    console.log('[Worker]', e.target.checked ? 'enabled' : 'disabled');
  };

  #handleOfflineToggle = async e => {
    await ServiceWorker.setEnabled(e.target.checked);

    const $label = this.#$offlineCheckbox.nextElementSibling;

    if ($label) {
      $label.title = e.target.checked ? LABEL.OFFLINE_ENABLED : LABEL.OFFLINE_DISABLED;
    }
  };

  #handleParallelStretchToggle = e => {
    setParallelStretchEnabled(e.target.checked);
    console.log('[Parallel Stretch]', e.target.checked ? 'enabled' : 'disabled');

    const $label = this.#$parallelStretchCheckbox.nextElementSibling;

    if ($label) {
      $label.title = e.target.checked
        ? LABEL.PARALLEL_STRETCH_ENABLED
        : LABEL.PARALLEL_STRETCH_DISABLED;
    }
  };

  #handleTilesModeToggle = e => {
    setTilesModeEnabled(e.target.checked);
    console.log('[Tiles Mode]', e.target.checked ? 'enabled' : 'disabled');

    const $label = this.#$tilesModeCheckbox.nextElementSibling;

    if ($label) {
      $label.title = e.target.checked ? LABEL.TILES_MODE_ENABLED : LABEL.TILES_MODE_DISABLED;
    }
  };

  // ============================================================================
  // Status Management
  // ============================================================================

  #setStatus(status) {
    this.#status = status;
    this.#updateUI();
  }

  #updateUI() {
    const isOnline = this.#status === CONNECTION_STATUS.ONLINE;
    const $indicator = this.$node.querySelector('.status-indicator');
    const $icon = $indicator.querySelector('i');
    const $label = $indicator.querySelector('.status-label');

    $indicator.classList.toggle('status-online', isOnline);
    $indicator.classList.toggle('status-offline', !isOnline);
    $icon.className = `bi ${isOnline ? 'bi-wifi' : 'bi-wifi-off'}`;
    $label.textContent = isOnline ? LABEL.STATUS_ONLINE : LABEL.STATUS_OFFLINE;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  isOnline() {
    return this.#status === CONNECTION_STATUS.ONLINE;
  }
}
