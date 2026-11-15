import { buildMetaString, escapeHtml } from '../../../lib';
import { LABEL } from '../../../config/constants';
import { CSS_CLASS } from '../../../config/ui';
import { ContextMenu } from '../../common/ContextMenu';

function buildMenuItems(hasTranscription) {
  const items = [
    { id: 'original', label: 'Download original', icon: 'bi-download' },
    { id: 'mp3', label: LABEL.DOWNLOAD_MP3, icon: 'bi-file-earmark-music' },
    { id: 'wav', label: LABEL.DOWNLOAD_WAV, icon: 'bi-file-earmark-music' },
    { type: 'divider' },
    { id: 'stems', label: LABEL.DOWNLOAD_STEMS, icon: 'bi-music-note-list' }
  ];

  if (hasTranscription) {
    items.push({ id: 'viewTranscript', label: LABEL.VIEW_TRANSCRIPT, icon: 'bi-chat-square-text' });
  }

  return items;
}

export function createItemRenderer(handlers) {
  return function renderItem(data, index, isSelected) {
    const { id, name, duration, durationFormatted } = data;
    const safeName = escapeHtml(name);
    const metaString = escapeHtml(buildMetaString(data));
    const durationSec = duration / 1000 || 0;

    const $li = document.createElement('li');
    $li.className = `list-group-item draggable p-0${isSelected ? ' selected' : ''}`;
    $li.dataset.id = id;
    $li.dataset.index = index;
    $li.draggable = true;

    $li.innerHTML = `
      <div class="library-item-inner">
        <i class="bi bi-grip-vertical drag-handle text-body-tertiary fs-4 align-self-center" title="${LABEL.LIBRARY_DRAG}"></i>
        <button class="btn btn-sm btn-outline-info audio-play align-self-center" data-id="${id}" title="${LABEL.LIBRARY_PLAY}">
          <i class="bi bi-play-fill"></i>
        </button>
        <span class="text-truncate align-self-center library-track-name" title="${safeName}">${safeName}</span>
        <div class="library-meta-col d-flex align-items-center gap-2">
          <button class="btn btn-sm btn-dark audio-info py-0 px-1" title="${LABEL.LIBRARY_INFO}">
            <i class="bi bi-info-lg"></i>
          </button>
          <small class="text-body-tertiary library-meta-text text-truncate" title="${metaString}">${metaString}</small>
        </div>
        <div class="library-wave-col">
          <canvas class="oscilloscope-canvas" width="240" height="28"></canvas>
        </div>
        <div class="library-time-col text-end">
          <code class="text-body-secondary d-block text-nowrap">${durationFormatted || '00:00'}</code>
        </div>
        <div class="library-actions-col d-flex align-items-center gap-2">
          <button class="btn btn-sm btn-menu-trigger audio-menu align-self-center" data-id="${id}" title="${LABEL.MORE_OPTIONS}">
            <i class="bi bi-three-dots"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger audio-delete align-self-center" data-id="${id}" title="${LABEL.LIBRARY_DELETE}">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;

    $li.addEventListener('dragstart', event => {
      event.dataTransfer.effectAllowed = 'copy';

      const selectedTracks = handlers.onGetSelectedTracks?.() || [];
      const tracksToAdd =
        selectedTracks.length > 0 ? selectedTracks : [{ id, label: name, duration: durationSec }];

      event.dataTransfer.setData('text/plain', JSON.stringify(tracksToAdd));
      $li.classList.add(CSS_CLASS.DRAGGING);
      handlers.onDragStart?.();
    });

    $li.addEventListener('dragend', () => {
      $li.classList.remove(CSS_CLASS.DRAGGING);
      handlers.onDragEnd?.();
    });

    $li.addEventListener('click', event => {
      const tag = event.target.tagName;
      if (tag === 'BUTTON' || tag === 'I' || tag === 'svg' || tag === 'path') {
        return;
      }
      handlers.onItemClick?.(data);
    });

    $li.querySelector('.audio-play').addEventListener('click', event => {
      event.stopPropagation();
      handlers.onPlay?.(data);
    });

    $li.querySelector('.audio-info').addEventListener('click', event => {
      event.stopPropagation();
      handlers.onInfo?.(data);
    });

    $li.querySelector('.audio-menu').addEventListener('click', event => {
      event.stopPropagation();
      const $btn = event.currentTarget;
      const hasTranscription = handlers.hasTranscription?.(id) ?? false;
      const menu = new ContextMenu(buildMenuItems(hasTranscription));

      menu.show($btn, formatId => {
        if (formatId === 'viewTranscript') {
          handlers.onViewTranscript?.(data);
        } else {
          handlers.onDownload?.(data, formatId);
        }
      });
    });

    $li.querySelector('.audio-delete').addEventListener('click', event => {
      event.stopPropagation();
      handlers.onDeleteSelected?.([id], name);
    });

    return $li;
  };
}
