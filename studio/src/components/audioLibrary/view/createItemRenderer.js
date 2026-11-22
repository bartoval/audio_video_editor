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
        <i class="bi bi-grip-vertical drag-handle" title="${LABEL.LIBRARY_DRAG}"></i>
        <button class="btn audio-play" data-id="${id}" title="${LABEL.LIBRARY_PLAY}" aria-label="${LABEL.LIBRARY_PLAY} ${safeName}">
          <i class="bi bi-play-fill"></i>
        </button>
        <div class="library-title-col">
          <span class="library-track-name" title="${safeName}">${safeName}</span>
          <div class="library-meta-row">
            <small class="library-meta-text" title="${metaString}">${metaString}</small>
            <button class="btn audio-info" title="${LABEL.LIBRARY_INFO}" aria-label="${LABEL.LIBRARY_INFO}">
              <i class="bi bi-info-circle"></i>
            </button>
          </div>
        </div>
        <div class="library-wave-col">
          <canvas class="oscilloscope-canvas" width="144" height="48"></canvas>
        </div>
        <div class="library-time-col">${durationFormatted || '00:00'}</div>
        <div class="library-actions-col">
          <button class="btn audio-menu" data-id="${id}" title="${LABEL.MORE_OPTIONS}" aria-label="${LABEL.MORE_OPTIONS}">
            <i class="bi bi-three-dots"></i>
          </button>
          <button class="btn audio-delete" data-id="${id}" title="${LABEL.LIBRARY_DELETE}" aria-label="${LABEL.LIBRARY_DELETE}">
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
