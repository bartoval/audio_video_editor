/** StatusBar view factory - passive DOM rendering */
import { createElement } from '../../../lib';
import { LABEL } from '../../../config/constants';
import { createJobPanelView } from './createJobPanelView';

const SPINNER_ICON = 'bi-arrow-repeat spin';
const IDLE_ICON = 'bi-check-circle';

export function createStatusBarView($parent) {
  let $statusIcon = null;
  let $statusLabel = null;
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
  $offlineCheckbox = $el.querySelector('[data-ref="offline-toggle"]');
  $taskStatus = $el.querySelector('[data-ref="task-status"]');
  $pendingOpsIcon = $el.querySelector('[data-ref="pending-ops-icon"]');
  $pendingOpsCount = $el.querySelector('[data-ref="pending-ops-count"]');

  const $pendingOps = $el.querySelector('[data-ref="pending-ops"]');
  const $offlineLabel = $el.querySelector('[data-ref="offline-label"]');

  const jobPanel = createJobPanelView();

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
      $offlineCheckbox.removeEventListener('change', handleOfflineChange);
      $pendingOps.removeEventListener('click', handlePendingOpsClick);
      $pendingOps.removeEventListener('keydown', handlePendingOpsKeydown);
      jobPanel.destroy();
      $el.remove();
    }
  };
}
