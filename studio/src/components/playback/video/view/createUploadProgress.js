/** Upload progress factory - displays upload status with progress bar */
import { createElement, formatBytes } from '../../../../lib';
import { LABEL } from '../../../../config/constants';
import { CSS_CLASS } from '../../../../config/ui';

export function createUploadProgress($parent) {
  const $el = createElement('div', {
    className: `${CSS_CLASS.VIDEO_UPLOAD_PROGRESS} ${CSS_CLASS.HIDE}`,
    html: `
      <div class="video-upload-info">
        <span data-ref="name" class="video-upload-name"></span>
        <span data-ref="size" class="video-upload-size"></span>
      </div>
      <div class="video-upload-bar-container">
        <div data-ref="bar" class="video-upload-bar"></div>
      </div>
      <span data-ref="status" class="video-upload-status">0%</span>
    `,
    parent: $parent
  });

  const $name = $el.querySelector('[data-ref="name"]');
  const $size = $el.querySelector('[data-ref="size"]');
  const $bar = $el.querySelector('[data-ref="bar"]');
  const $status = $el.querySelector('[data-ref="status"]');

  return {
    el: $el,

    show(fileName, fileSize) {
      $name.textContent = fileName;
      $size.textContent = formatBytes(fileSize);
      $bar.style.width = '0%';
      $bar.classList.remove('indeterminate');
      $status.textContent = '0%';
      $el.classList.remove(CSS_CLASS.HIDE);
    },

    hide() {
      $el.classList.add(CSS_CLASS.HIDE);
      $bar.style.width = '0%';
      $bar.classList.remove('indeterminate');
    },

    updateProgress(percent, fileName) {
      $bar.classList.remove('indeterminate');
      $bar.style.width = `${percent}%`;
      $status.textContent = `${Math.round(percent)}%`;
      if (fileName) {
        $name.textContent = fileName;
      }
    },

    showConverting() {
      $name.textContent = LABEL.CONVERTING;
      $size.textContent = LABEL.PLEASE_WAIT;
      $bar.style.width = '100%';
      $bar.classList.add('indeterminate');
      $status.textContent = LABEL.PROCESSING;
      $el.classList.remove(CSS_CLASS.HIDE);
    }
  };
}
