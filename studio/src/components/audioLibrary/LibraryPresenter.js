/**
 * LibraryPresenter - facade that coordinates library modules
 *
 * Delegates to:
 * - LibraryPlayback: audio playback and visualization
 * - LibraryUpload: file handling and upload
 * - LibraryActions: selection, delete, search, sort
 */
import LibraryModel from './LibraryModel';
import LibraryView from './LibraryView';
import { LibraryPlayback, LibraryUpload, LibraryActions } from './presenter';
import { createItemRenderer } from './view';
import { ERROR_CONTEXT, EVENT, LABEL } from '../../config/constants';
import {
  downloadFromUrl,
  escapeHtml,
  formatBitrate,
  formatBytes,
  formatDuration,
  formatSampleRate
} from '../../lib';
import ErrorHandler from '../../services/ErrorHandler';
import { getTrackUrl } from '../../services/workspace';
import * as EventService from '../../services/EventService';
import * as JobTrackerService from '../../services/JobTrackerService';
import * as apiService from '../../services/api';
import transcriptionStore from '../../store/transcriptionStore';
import { Modal } from '../core';
import TranscriptView from '../timeline/navigator/inspector/TranscriptView';

export default class LibraryPresenter {
  #model = null;
  #view = null;
  #infoModal = null;
  #transcriptModal = null;
  #transcriptView = null;
  #playback = null;
  #upload = null;
  #actions = null;
  #onEmpty = null;
  #onLoad = null;

  constructor($parent, config = {}) {
    const { api, onEmpty, onLoad, onAddToTimeline } = config;

    this.#onEmpty = onEmpty;
    this.#onLoad = onLoad;

    this.#model = new LibraryModel(api?.list);
    this.#view = new LibraryView($parent);

    this.#playback = new LibraryPlayback();
    this.#upload = new LibraryUpload();
    this.#actions = new LibraryActions();
    this.#infoModal = new Modal({ showFooter: false });
    this.#transcriptModal = new Modal({ showFooter: false, size: 'lg', className: 'transcript-modal' });

    this.#playback.setView(this.#view);

    this.#upload.setView(this.#view);
    this.#upload.setOnComplete(() => this.reload());

    this.#actions.setModel(this.#model);
    this.#actions.setView(this.#view);
    this.#actions.setPlayback(this.#playback);
    this.#actions.setCallbacks({ onEmpty, onAddToTimeline });

    this.#model.on('removed', ({ id }) => EventService.emitLocal(EVENT.LIBRARY_REMOVED, { id }));

    this.#view.render();
    this.#bindViewCallbacks();
    this.#initVirtualScroll();
    this.#initOfflineHandler();
  }

  load() {
    this.#model
      .load()
      .then(items => {
        if (this.#model.isOffline()) {
          this.#view.showOfflineOverlay();
        } else {
          this.#view.hideOfflineOverlay();
        }

        this.#view.setItems(items);
        this.#actions.updateToolbar();

        if (items.length === 0) {
          this.#view.showEmptyState();
          this.#onEmpty?.();
        } else {
          this.#view.hideEmptyState();
          this.#onLoad?.(items.length);
        }
      })
      .catch(() => {
        this.#view.showEmptyState();
        this.#onEmpty?.();
      });
  }

  reload() {
    this.#model.setItems([]);
    this.#view.setItems([]);
    this.load();
  }

  #bindViewCallbacks() {
    this.#view.handlers = {
      onFileSelect: files => this.#upload.handleFileSelect(files),
      onFolderSelect: files => this.#upload.handleFileSelect(files),
      onFileDrop: dataTransfer => this.#upload.handleDrop(dataTransfer),
      onItemClick: data => this.#handleItemClick(data),
      onPlay: data => this.#handlePlay(data),
      onSelectAll: () => this.#actions.handleSelectAll(),
      onDeleteSelected: (ids, name) =>
        ids ? this.#actions.confirmDeleteItem(ids[0], name) : this.#actions.handleDeleteSelected(),
      onAddToTimeline: () => this.#actions.handleAddToTimeline(),
      onDragStart: () => this.#actions.handleDragStart(),
      onDragEnd: () => this.#actions.handleDragEnd(),
      onGetSelectedTracks: () => this.#actions.getSelectedTracks(),
      onSearch: query => this.#actions.handleSearch(query),
      onSort: field => this.#actions.handleSort(field),
      onToggleSortDir: () => this.#actions.handleToggleSortDir(),
      onInfo: item => this.#showInfo(item),
      onDownload: (item, format) => this.#handleDownload(item, format),
      onViewTranscript: item => this.#showTranscript(item),
      hasTranscription: id => this.#hasTranscription(id),
      onMiniPlayerPause: () => this.#playback.togglePlayPause(),
      onMiniPlayerGoTo: () => this.#playback.goToCurrentTrack(),
      onMiniPlayerSeek: time => this.#playback.seek(time)
    };
  }

  #initVirtualScroll() {
    const renderItem = createItemRenderer(this.#view.handlers);

    this.#view.initVirtualScroll(
      (data, index) => renderItem(data, index, this.#model.isSelected(data.id)),
      data => this.#onItemRendered(data)
    );
  }

  #initOfflineHandler() {
    EventService.on(EVENT.CONNECTION, ({ online }) => {
      if (online) {
        this.#view.hideOfflineOverlay();
      } else {
        this.#view.showOfflineOverlay();
      }
    });
  }

  #onItemRendered(data) {
    const currentId = this.#playback.getCurrentPlayingId();

    if (currentId === data.id) {
      this.#playback.attachListOscilloscope(data.id);
    }
  }

  #handleItemClick(data) {
    if (!data?.id) {
      return;
    }

    this.#actions.toggleSelection(data.id);
  }

  #handlePlay(data) {
    if (!data?.id) {
      return;
    }

    this.#playback.play(data.id, data);
  }

  #showInfo(item) {
    if (!item) return;

    const metaRows = [
      [LABEL.TRACK_NAME, escapeHtml(item.name)],
      [LABEL.TRACK_FORMAT, escapeHtml(item.format?.toUpperCase()) || '—'],
      [LABEL.TRACK_CODEC, escapeHtml(item.codec?.toUpperCase()) || '—'],
      [LABEL.TRACK_BIT_DEPTH, item.bitDepth ? `${item.bitDepth}-bit` : '—'],
      [LABEL.TRACK_CHANNELS, escapeHtml(item.channelLayout) || (item.channels ? `${item.channels}ch` : '—')],
      [LABEL.TRACK_SAMPLE_RATE, item.sampleRate ? formatSampleRate(item.sampleRate) : '—'],
      [LABEL.TRACK_BITRATE, item.bitrate ? formatBitrate(item.bitrate) : '—'],
      [LABEL.TRACK_DURATION, item.duration ? formatDuration(item.duration / 1000) : '—'],
      [LABEL.TRACK_SIZE, item.fileSize ? formatBytes(item.fileSize) : '—']
    ];

    const body = `
      <div class="table-responsive">
        <table class="table table-sm mb-0">
          <tbody>
            ${metaRows
              .map(
                ([label, value]) =>
                  `<tr><th class="text-body-secondary fw-normal" style="width: 40%">${label}</th><td class="text-break">${value}</td></tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    this.#infoModal.show({
      title: LABEL.TRACK_INFO,
      body,
      showFooter: false
    });
  }

  #handleDownload(item, format = 'mp3') {
    if (!item?.id) {
      return;
    }

    if (format === 'stems') {
      this.#handleStemsDownload(item);

      return;
    }

    if (format === 'transcribe') {
      this.#handleTranscribe(item);

      return;
    }

    const url = getTrackUrl(item.id, format);
    const extension = format === 'wav' ? 'wav' : 'mp3';
    const filename = `${item.name || 'audio'}.${extension}`;

    downloadFromUrl(url, filename);
  }

  async #handleStemsDownload(item) {
    try {
      const { jobId } = await apiService.startStemsSeparation(item.id);

      if (!jobId) {
        throw new Error('Failed to start stems separation');
      }

      const filename = item.name || 'audio';

      JobTrackerService.track(jobId, {
        type: 'stems',
        audioId: item.id,
        filename,
        audioDurationMs: item.duration || 0
      });
    } catch (error) {
      ErrorHandler.handle(error, ERROR_CONTEXT.STEMS_SEPARATION);
    }
  }

  async #handleTranscribe(item) {
    try {
      const { jobId } = await apiService.startTranscription(item.id);

      if (!jobId) {
        throw new Error('Failed to start transcription');
      }

      const filename = item.name || 'audio';

      JobTrackerService.track(jobId, {
        type: 'transcribe',
        audioId: item.id,
        filename,
        audioDurationMs: item.duration || 0
      });
    } catch (error) {
      ErrorHandler.handle(error, ERROR_CONTEXT.TRANSCRIPTION);
    }
  }

  #hasTranscription(audioId) {
    const { transcriptions } = transcriptionStore.getState();

    return Boolean(transcriptions[audioId]?.segments?.length);
  }

  #showTranscript(item) {
    if (!item?.id) return;

    const { transcriptions } = transcriptionStore.getState();
    const transcription = transcriptions[item.id];

    if (!transcription?.segments?.length) return;

    this.#transcriptView?.destroy();

    const $body = this.#transcriptModal.getBody();
    $body.innerHTML = '';

    this.#transcriptView = new TranscriptView($body);
    this.#transcriptView.setSegments(transcription.segments);
    this.#transcriptView.show();

    this.#transcriptModal.show({
      title: `${LABEL.VIEW_TRANSCRIPT} — ${escapeHtml(item.name || '')}`,
      showFooter: false,
      preserveBody: true
    });
  }
}
