import { formatElapsedTime } from '../../../lib';
import { LABEL } from '../../../config/constants';
import { JOB_TRACKER } from '../../../config/ui';

const TYPE_ICONS = {
  transcribe: 'bi-chat-square-text',
  stems: 'bi-music-note-list'
};

const TYPE_LABELS = {
  transcribe: LABEL.JOB_TYPE_TRANSCRIBE,
  stems: LABEL.JOB_TYPE_STEMS
};

function buildEstimate(job) {
  if (!job.audioDurationMs) {
    return LABEL.JOB_NO_ETA;
  }

  const ratio = JOB_TRACKER.ESTIMATION_RATIO[job.type] || 0.5;
  const estimatedMs = (job.audioDurationMs / 1000) * ratio * 1000;

  return `~${formatElapsedTime(estimatedMs)}`;
}

function buildJobItem(job, onDismiss) {
  const $item = document.createElement('div');
  $item.className = 'job-panel-item';
  $item.dataset.jobId = job.jobId;

  const $info = document.createElement('div');
  $info.className = 'job-panel-item-info';

  const $icon = document.createElement('i');
  $icon.className = `bi ${TYPE_ICONS[job.type] || 'bi-hourglass'}`;
  $icon.title = TYPE_LABELS[job.type] || job.type;

  const $details = document.createElement('div');
  $details.className = 'job-panel-item-details';

  const $filename = document.createElement('span');
  $filename.className = 'job-panel-filename';
  $filename.textContent = job.filename;
  $filename.title = job.filename;

  const $times = document.createElement('span');
  $times.className = 'job-panel-times';
  $times.dataset.ref = 'times';

  const elapsed = formatElapsedTime(Date.now() - job.createdAt);
  const estimate = buildEstimate(job);
  $times.textContent = `${elapsed} / ${estimate}`;

  $details.append($filename, $times);
  $info.append($icon, $details);

  const $dismiss = document.createElement('button');
  $dismiss.className = 'job-panel-dismiss';
  $dismiss.title = LABEL.JOB_DISMISS;
  $dismiss.innerHTML = '<i class="bi bi-x"></i>';
  $dismiss.addEventListener('click', event => {
    event.stopPropagation();
    onDismiss(job.jobId);
  });

  $item.append($info, $dismiss);

  return $item;
}

export function createJobPanelView() {
  let handlers = {};
  let currentJobs = [];
  let elapsedInterval = null;

  const $panel = document.createElement('div');
  $panel.className = 'job-panel';

  const $header = document.createElement('div');
  $header.className = 'job-panel-header';

  const $title = document.createElement('span');
  $title.textContent = LABEL.JOB_PANEL_TITLE;

  const $close = document.createElement('button');
  $close.className = 'job-panel-close';
  $close.title = LABEL.CLOSE;
  $close.innerHTML = '<i class="bi bi-x-lg"></i>';

  $header.append($title, $close);

  const $list = document.createElement('div');
  $list.className = 'job-panel-list';

  $panel.append($header, $list);
  document.body.appendChild($panel);

  $close.addEventListener('click', () => {
    $panel.classList.remove('visible');
    stopTimer();
    removeOutsideListener();
  });

  let outsideClickHandler = null;

  const removeOutsideListener = () => {
    if (outsideClickHandler) {
      document.removeEventListener('click', outsideClickHandler);
      outsideClickHandler = null;
    }
  };

  const updateElapsedTimes = () => {
    const now = Date.now();

    for (const job of currentJobs) {
      const $item = $list.querySelector(`[data-job-id="${job.jobId}"]`);

      if (!$item) continue;

      const $times = $item.querySelector('[data-ref="times"]');

      if ($times) {
        const elapsed = formatElapsedTime(now - job.createdAt);
        const estimate = buildEstimate(job);
        $times.textContent = `${elapsed} / ${estimate}`;
      }
    }
  };

  const startTimer = () => {
    if (elapsedInterval) return;

    elapsedInterval = setInterval(updateElapsedTimes, JOB_TRACKER.ELAPSED_TICK_MS);
  };

  const stopTimer = () => {
    if (elapsedInterval) {
      clearInterval(elapsedInterval);
      elapsedInterval = null;
    }
  };

  const renderJobs = jobs => {
    $list.replaceChildren();

    for (const job of jobs) {
      $list.appendChild(buildJobItem(job, jobId => handlers.onDismiss?.(jobId)));
    }
  };

  return {
    bind(newHandlers) {
      handlers = newHandlers;
    },

    setState({ jobs }) {
      if (jobs !== undefined) {
        currentJobs = jobs;
        renderJobs(jobs);

        if (jobs.length === 0) {
          this.hide();
        }
      }
    },

    show($anchor) {
      renderJobs(currentJobs);

      $panel.style.visibility = 'hidden';
      $panel.classList.add('visible');

      requestAnimationFrame(() => {
        const anchorRect = $anchor.getBoundingClientRect();
        const panelRect = $panel.getBoundingClientRect();

        let top = anchorRect.top - panelRect.height - 6;
        let left = anchorRect.right - panelRect.width;

        if (top < 8) {
          top = anchorRect.bottom + 6;
        }

        if (left < 8) {
          left = 8;
        }

        $panel.style.top = `${top}px`;
        $panel.style.left = `${left}px`;
        $panel.style.visibility = '';

        startTimer();
      });

      setTimeout(() => {
        outsideClickHandler = event => {
          if (!$panel.contains(event.target) && !$anchor.contains(event.target)) {
            this.hide();
          }
        };

        document.addEventListener('click', outsideClickHandler);
      }, 0);
    },

    hide() {
      $panel.classList.remove('visible');
      stopTimer();
      removeOutsideListener();
    },

    isVisible() {
      return $panel.classList.contains('visible');
    },

    destroy() {
      stopTimer();
      removeOutsideListener();
      $panel.remove();
    }
  };
}
