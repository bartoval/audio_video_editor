/** StatusBar view factory - passive DOM rendering */
import { createElement } from '../../../lib';
import { LABEL } from '../../../config/constants';
import { createJobPanelView } from './createJobPanelView';

const SPINNER_ICON = 'bi-arrow-repeat spin';
const IDLE_ICON = 'bi-check-circle';

export function createStatusBarView($parent) {
  let $statusIcon = null;
  let $statusLabel = null;
  let $wasmCheckbox = null;
  let $workerCheckbox = null;
  let $parallelStretchCheckbox = null;
  let $offlineCheckbox = null;
  let $taskStatus = null;
  let $pendingOpsIcon = null;
  let $pendingOpsCount = null;

  let handlers = {};

  const $el = createElement('div', {
    className: 'studio-statusbar glass-container',
    html: `
      <div class="statusbar-left d-flex align-items-center gap-3">
        <div class="status-indicator d-flex align-items-center gap-2" data-ref="status-indicator">
          <span class="status-dot" data-ref="status-dot"></span>
          <i class="bi bi-wifi" data-ref="status-icon"></i>
          <span class="status-label" data-ref="status-label">${LABEL.STATUS_ONLINE}</span>
        </div>
        <label class="d-flex align-items-center gap-1 small text-secondary mb-0" style="cursor: pointer">
          <input type="checkbox" class="form-check-input mt-0" data-ref="wasm-toggle">
          <span data-ref="wasm-label">${LABEL.WASM}</span>
        </label>
        <label class="d-flex align-items-center gap-1 small text-secondary mb-0" style="cursor: pointer">
          <input type="checkbox" class="form-check-input mt-0" data-ref="worker-toggle">
          <span data-ref="worker-label">${LABEL.WORKER}</span>
        </label>
        <label class="d-flex align-items-center gap-1 small text-secondary mb-0" style="cursor: pointer">
          <input type="checkbox" class="form-check-input mt-0" data-ref="parallel-stretch-toggle">
          <span data-ref="parallel-stretch-label">${LABEL.PARALLEL_STRETCH}</span>
        </label>
        <label class="d-flex align-items-center gap-1 small text-secondary mb-0" style="cursor: pointer">
          <input type="checkbox" class="form-check-input mt-0" data-ref="offline-toggle">
          <span data-ref="offline-label">${LABEL.OFFLINE}</span>
        </label>
      </div>
      <div class="statusbar-center" data-ref="search-slot"></div>
      <div class="statusbar-right d-flex align-items-center justify-content-end gap-3">
        <div class="pending-ops d-flex align-items-center gap-2 small text-light" data-ref="pending-ops" role="button" tabindex="0">
          <i class="bi bi-check-circle" data-ref="pending-ops-icon"></i>
          <span><span data-ref="pending-ops-count">0</span> ${LABEL.PENDING_OPERATIONS}</span>
        </div>
        <div class="task-status d-flex align-items-center gap-2" data-ref="task-status"></div>
      </div>
    `,
    parent: $parent
  });

  const $indicator = $el.querySelector('[data-ref="status-indicator"]');
  $statusIcon = $el.querySelector('[data-ref="status-icon"]');
  $statusLabel = $el.querySelector('[data-ref="status-label"]');
  $wasmCheckbox = $el.querySelector('[data-ref="wasm-toggle"]');
  $workerCheckbox = $el.querySelector('[data-ref="worker-toggle"]');
  $parallelStretchCheckbox = $el.querySelector('[data-ref="parallel-stretch-toggle"]');
  $offlineCheckbox = $el.querySelector('[data-ref="offline-toggle"]');
  $taskStatus = $el.querySelector('[data-ref="task-status"]');
  $pendingOpsIcon = $el.querySelector('[data-ref="pending-ops-icon"]');
  $pendingOpsCount = $el.querySelector('[data-ref="pending-ops-count"]');

  const $pendingOps = $el.querySelector('[data-ref="pending-ops"]');
  const $wasmLabel = $el.querySelector('[data-ref="wasm-label"]');
  const $workerLabel = $el.querySelector('[data-ref="worker-label"]');
  const $parallelStretchLabel = $el.querySelector('[data-ref="parallel-stretch-label"]');
  const $offlineLabel = $el.querySelector('[data-ref="offline-label"]');

  const jobPanel = createJobPanelView();

  const handleWasmChange = event => {
    handlers.onWasmToggle?.(event.target.checked);
  };

  const handleWorkerChange = event => {
    handlers.onWorkerToggle?.(event.target.checked);
  };

  const handleParallelStretchChange = event => {
    handlers.onParallelStretchToggle?.(event.target.checked);
  };

  const handleOfflineChange = event => {
    handlers.onOfflineToggle?.(event.target.checked);
  };

  const handlePendingOpsClick = () => {
    handlers.onPendingOpsClick?.();
  };

  const handlePendingOpsKeydown = event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlers.onPendingOpsClick?.();
    }
  };

  $wasmCheckbox.addEventListener('change', handleWasmChange);
  $workerCheckbox.addEventListener('change', handleWorkerChange);
  $parallelStretchCheckbox.addEventListener('change', handleParallelStretchChange);
  $offlineCheckbox.addEventListener('change', handleOfflineChange);
  $pendingOps.addEventListener('click', handlePendingOpsClick);
  $pendingOps.addEventListener('keydown', handlePendingOpsKeydown);

  const renderTasks = tasks => {
    $taskStatus.innerHTML = '';

    Object.entries(tasks).forEach(([taskId, task]) => {
      const { status, progress, type } = task;
      const icon = type === 'error' ? 'bi-exclamation-circle' : 'bi-arrow-repeat';
      const progressText = progress !== undefined ? ` ${progress}%` : '';

      const $task = document.createElement('div');
      $task.className = 'task-item d-flex align-items-center gap-1';
      $task.dataset.task = taskId;
      $task.innerHTML = `<i class="bi ${icon} spin"></i><span>${status}${progressText}</span>`;

      $taskStatus.appendChild($task);
    });
  };

  return {
    el: $el,

    bind(newHandlers) {
      handlers = newHandlers;
      jobPanel.bind({
        onDismiss: jobId => handlers.onJobDismiss?.(jobId)
      });
    },

    setState(state) {
      if (state.online !== undefined) {
        const online = state.online;

        $indicator.classList.toggle('status-online', online);
        $indicator.classList.toggle('status-offline', !online);
        $statusIcon.className = `bi ${online ? 'bi-wifi' : 'bi-wifi-off'}`;
        $statusLabel.textContent = online ? LABEL.STATUS_ONLINE : LABEL.STATUS_OFFLINE;
      }

      if (state.wasmEnabled !== undefined) {
        $wasmCheckbox.checked = state.wasmEnabled;
      }

      if (state.wasmSupported !== undefined) {
        $wasmCheckbox.disabled = !state.wasmSupported;
        $wasmLabel.title = state.wasmSupported ? LABEL.WASM_BROWSER : LABEL.WASM_SERVER;
      }

      if (state.workerEnabled !== undefined) {
        $workerCheckbox.checked = state.workerEnabled;
      }

      if (state.workerDisabled !== undefined) {
        $workerCheckbox.disabled = state.workerDisabled;
        $workerLabel.title = state.workerDisabled ? LABEL.WORKER_DISABLED : LABEL.WORKER_ENABLED;
      }

      if (state.parallelStretchEnabled !== undefined) {
        $parallelStretchCheckbox.checked = state.parallelStretchEnabled;
      }

      if (state.parallelStretchDisabled !== undefined) {
        $parallelStretchCheckbox.disabled = state.parallelStretchDisabled;
        $parallelStretchLabel.title = state.parallelStretchDisabled
          ? LABEL.PARALLEL_STRETCH_DISABLED
          : LABEL.PARALLEL_STRETCH_ENABLED;
      }

      if (state.offlineEnabled !== undefined) {
        $offlineCheckbox.checked = state.offlineEnabled;
      }

      if (state.offlineSupported !== undefined) {
        $offlineCheckbox.disabled = !state.offlineSupported;
        $offlineLabel.title = state.offlineEnabled ? LABEL.OFFLINE_ENABLED : LABEL.OFFLINE_DISABLED;
      }

      if (state.tasks !== undefined) {
        renderTasks(state.tasks);
      }

      if (state.pendingOpsCount !== undefined) {
        $pendingOpsCount.textContent = state.pendingOpsCount;
        $pendingOpsIcon.className = `bi ${state.pendingOpsCount > 0 ? SPINNER_ICON : IDLE_ICON}`;
        $pendingOps.classList.toggle('is-clickable', state.pendingOpsCount > 0);
      }

      if (state.jobs !== undefined) {
        jobPanel.setState({ jobs: state.jobs });
      }
    },

    showJobPanel() {
      jobPanel.show($pendingOps);
    },

    hideJobPanel() {
      jobPanel.hide();
    },

    isJobPanelVisible() {
      return jobPanel.isVisible();
    },

    destroy() {
      $wasmCheckbox.removeEventListener('change', handleWasmChange);
      $workerCheckbox.removeEventListener('change', handleWorkerChange);
      $parallelStretchCheckbox.removeEventListener('change', handleParallelStretchChange);
      $offlineCheckbox.removeEventListener('change', handleOfflineChange);
      $pendingOps.removeEventListener('click', handlePendingOpsClick);
      $pendingOps.removeEventListener('keydown', handlePendingOpsKeydown);
      jobPanel.destroy();
      $el.remove();
    }
  };
}
