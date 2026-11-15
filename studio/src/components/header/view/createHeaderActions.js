/** Header actions factory - load, save, preview buttons */
import { createElement } from '../../../lib';
import { LABEL } from '../../../config/constants';

const ICON_LOAD = 'bi-download';
const ICON_SAVE = 'bi-save';
const ICON_SYNC = 'bi-cloud-upload';
const ICON_PREVIEW = 'bi-play-circle';
const ICON_SPINNER = 'bi-arrow-repeat spin';

export function createHeaderActions($parent) {
  let handlers = {};
  let currentState = {
    offline: false,
    isLoading: false,
    isSaving: false,
    isSyncing: false,
    isExporting: false,
    hasTracks: false,
    hasBackup: false
  };

  const $el = createElement('ul', {
    className: 'navbar-nav ms-auto flex-row align-items-center gap-3',
    html: `
      <li class="nav-item">
        <button class="btn btn-outline-info d-flex align-items-center gap-1" data-action="load" title="${LABEL.LOAD}">
          <i class="bi ${ICON_LOAD}"></i><span class="d-none d-md-inline">${LABEL.LOAD}</span>
        </button>
      </li>
      <li class="nav-item">
        <button class="btn btn-outline-info d-flex align-items-center gap-1" data-action="save" title="${LABEL.SAVE}">
          <i class="bi ${ICON_SAVE}"></i><span class="d-none d-md-inline">${LABEL.SAVE}</span>
        </button>
      </li>
      <li class="nav-item">
        <button class="btn btn-outline-info d-flex align-items-center gap-1" data-action="sync" title="${LABEL.SYNC_SERVER}">
          <i class="bi ${ICON_SYNC}"></i><span class="d-none d-md-inline">${LABEL.SYNC_SERVER}</span>
        </button>
      </li>
      <li class="nav-item">
        <button class="btn btn-primary d-flex align-items-center gap-1" data-action="preview" title="${LABEL.PREVIEW}">
          <i class="bi ${ICON_PREVIEW}"></i><span class="d-none d-md-inline">${LABEL.PREVIEW}</span>
        </button>
      </li>
    `,
    parent: $parent
  });

  const $loadBtn = $el.querySelector('[data-action="load"]');
  const $saveBtn = $el.querySelector('[data-action="save"]');
  const $syncBtn = $el.querySelector('[data-action="sync"]');
  const $syncIcon = $syncBtn.querySelector('i');
  const $previewBtn = $el.querySelector('[data-action="preview"]');
  const $loadIcon = $loadBtn.querySelector('i');
  const $saveIcon = $saveBtn.querySelector('i');
  const $previewIcon = $previewBtn.querySelector('i');

  const setButtonState = ($btn, $icon, disabled, loading, normalIcon) => {
    $btn.disabled = disabled;
    $icon.className = `bi ${loading ? ICON_SPINNER : normalIcon}`;
  };

  const handleClick = event => {
    const $btn = event.target.closest('[data-action]');

    if (!$btn || $btn.disabled) {
      return;
    }

    event.preventDefault();

    const { action } = $btn.dataset;

    if (action === 'load') {
      handlers.onLoad?.();
    } else if (action === 'save') {
      handlers.onSave?.();
    } else if (action === 'sync') {
      handlers.onSync?.();
    } else if (action === 'preview') {
      handlers.onPreview?.();
    }
  };

  $el.addEventListener('click', handleClick);

  return {
    el: $el,

    bind(newHandlers) {
      handlers = newHandlers;
    },

    setState(state) {
      currentState = { ...currentState, ...state };

      const { offline, isLoading, isSaving, isSyncing, isExporting, hasTracks, hasBackup } =
        currentState;
      const isBusy = isLoading || isSaving || isSyncing || isExporting;
      setButtonState($syncBtn, $syncIcon, isBusy, isSyncing, ICON_SYNC);

      // Saved projects can be loaded from this device while offline.
      setButtonState($loadBtn, $loadIcon, isBusy || !hasBackup, isLoading, ICON_LOAD);

      // Save/Preview: enabled if tracks exist and not busy
      setButtonState(
        $saveBtn,
        $saveIcon,
        isBusy || (!hasTracks && !hasBackup),
        isSaving,
        ICON_SAVE
      );
      setButtonState(
        $previewBtn,
        $previewIcon,
        offline || isBusy || !hasTracks,
        isExporting,
        ICON_PREVIEW
      );

      $loadBtn.title = offline ? LABEL.LOAD_OFFLINE : LABEL.LOAD;
      $saveBtn.title = offline ? LABEL.SAVE_OFFLINE : LABEL.SAVE;
      $previewBtn.title = offline ? LABEL.PREVIEW_OFFLINE : LABEL.PREVIEW;
    },

    destroy() {
      $el.removeEventListener('click', handleClick);
      $el.remove();
    }
  };
}
