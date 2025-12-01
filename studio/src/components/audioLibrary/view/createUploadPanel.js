import { createElement, formatBytes, show, hide } from '../../../lib';
import { CSS_CLASS } from '../../../config/ui';

export function createUploadPanel() {
  const $el = createElement('div', {
    className: 'upload-list hide',
    parent: document.body
  });

  let $totalBar = null;
  let $totalText = null;

  return {
    el: $el,

    show() {
      show($el, CSS_CLASS.HIDE);
    },

    hide() {
      hide($el, CSS_CLASS.HIDE);
      $el.innerHTML = '';
      $totalBar = null;
      $totalText = null;
    },

    createHeader(totalFiles) {
      const $header = createElement('div', {
        className: 'rounded p-2 mb-2 border border-info-subtle bg-info bg-opacity-10',
        html: `
          <div class="d-flex align-items-center gap-2 mb-2">
            <i class="bi bi-cloud-arrow-up text-info"></i>
            <span class="small fw-medium text-white" data-ref="totalText">Uploading 0/${totalFiles}</span>
          </div>
          <div class="progress" style="height: 6px;">
            <div class="progress-bar bg-info" data-ref="totalBar" style="width: 0%"></div>
          </div>
        `,
        parent: $el
      });

      $totalBar = $header.querySelector('[data-ref="totalBar"]');
      $totalText = $header.querySelector('[data-ref="totalText"]');
    },

    createItem(file, index) {
      const $item = createElement('div', {
        className: 'd-flex align-items-center gap-2 rounded upload-item',
        attributes: { 'data-index': index },
        html: `
          <div class="flex-grow-1 d-flex flex-column gap-1 min-width-0">
            <span class="small text-white text-truncate">${file.name}</span>
            <span class="text-body-tertiary" style="font-size: 10px">${formatBytes(file.size)}</span>
          </div>
          <div class="progress" style="width: 100px; height: 4px;">
            <div class="progress-bar bg-info" data-ref="bar" style="width: 0%"></div>
          </div>
          <span class="text-body-secondary small text-end" style="width: 40px" data-ref="status">Waiting...</span>
        `,
        parent: $el
      });

      return $item;
    },

    updateItemProgress(index, percent) {
      const $item = $el.querySelector(`[data-index="${index}"]`);
      if (!$item) return;

      $item.querySelector('[data-ref="bar"]').style.width = `${percent}%`;
      $item.querySelector('[data-ref="status"]').textContent = `${Math.round(percent)}%`;
    },

    setItemState(index, state) {
      const $item = $el.querySelector(`[data-index="${index}"]`);
      if (!$item) return;

      const $bar = $item.querySelector('[data-ref="bar"]');
      const $status = $item.querySelector('[data-ref="status"]');

      if ($bar) {
        $bar.classList.remove('bg-info', 'bg-success', 'bg-danger', 'bg-warning');
        const barColorMap = {
          uploading: 'bg-info',
          complete: 'bg-success',
          duplicate: 'bg-warning',
          error: 'bg-danger'
        };
        $bar.classList.add(barColorMap[state] || 'bg-info');
      }

      if ($status) {
        const statusMap = { uploading: '0%', complete: '✓', duplicate: '!', error: '✗' };
        const statusColorMap = {
          uploading: 'text-body-secondary',
          complete: 'text-success',
          duplicate: 'text-warning',
          error: 'text-danger'
        };

        $status.textContent = statusMap[state] || '';
        $status.classList.remove(
          'text-body-secondary',
          'text-success',
          'text-danger',
          'text-warning'
        );
        $status.classList.add(statusColorMap[state] || 'text-body-secondary');
      }

      if (state === 'complete' || state === 'duplicate') {
        $item.style.opacity = '0.6';
      }
    },

    setItemWarning(index, text) {
      const $item = $el.querySelector(`[data-index="${index}"]`);
      if (!$item) return;

      let $warn = $item.querySelector('[data-ref="warning"]');
      if (!$warn) {
        $warn = document.createElement('div');
        $warn.dataset.ref = 'warning';
        $warn.className = 'text-warning small';
        $item.appendChild($warn);
      }
      $warn.textContent = text;
    },

    updateTotalProgress(completedFiles, currentPercent, totalFiles) {
      if (!$totalBar || !$totalText) return;

      const currentFileProgress = currentPercent / 100;
      const totalProgress = ((completedFiles + currentFileProgress) / totalFiles) * 100;

      $totalBar.style.width = `${totalProgress}%`;
      $totalText.textContent = `Uploading ${completedFiles + 1}/${totalFiles} (${Math.round(totalProgress)}%)`;
    },

    setComplete(successCount, totalFiles) {
      if ($totalText) {
        $totalText.textContent = `Complete: ${successCount}/${totalFiles}`;
      }
    }
  };
}
