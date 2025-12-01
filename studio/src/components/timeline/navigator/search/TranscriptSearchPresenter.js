import { EVENT, LABEL } from '../../../../config/constants';
import * as EventService from '../../../../services/EventService';
import { timelineStore } from '../../../../store';
import transcriptionStore from '../../../../store/transcriptionStore';
import TranscriptSearchView from './TranscriptSearchView';

/**
 * @typedef {Object} WordTimestamp
 * @property {number} start
 * @property {number} end
 * @property {string} word
 * @property {number} [probability]
 */

/**
 * @typedef {{ audioId: string, trackLabel: string, text: string, start: number, end: number, words: WordTimestamp[] | null }} Segment
 * @typedef {{ segmentIdx: number, charOffset: number, time: number }} Match
 */

export default class TranscriptSearchPresenter {
  #view = null;
  #unsubscribeStore = null;

  /** @type {Segment[]} */
  #segments = [];
  /** @type {Match[]} */
  #matches = [];
  #currentMatchIdx = -1;
  #searchQuery = '';

  /** @param {HTMLElement} $container */
  constructor($container) {
    this.#view = new TranscriptSearchView($container);
    this.#view.bind({
      onSearch: query => this.#handleSearch(query),
      onNext: () => this.#navigateNext(),
      onPrev: () => this.#navigatePrev()
    });

    this.#rebuildSegments();

    this.#unsubscribeStore = transcriptionStore.subscribe(() => {
      this.#rebuildSegments();
      this.#reapplySearch();
    });
  }

  destroy() {
    this.#unsubscribeStore?.();
    this.#view?.destroy();
    this.#view = null;
  }

  #rebuildSegments() {
    const { transcriptions } = transcriptionStore.getState();
    const { tracks } = timelineStore.getState();
    const trackLabelMap = new Map();

    for (const track of tracks) {
      trackLabelMap.set(track.idTrack, track.label);
    }

    this.#segments = [];

    for (const [audioId, data] of Object.entries(transcriptions)) {
      if (!data?.segments) continue;

      const trackLabel = trackLabelMap.get(audioId) ?? audioId;

      for (const segment of data.segments) {
        const text = segment.text.trim();
        if (!text) continue;

        this.#segments.push({
          audioId,
          trackLabel,
          text,
          start: segment.start,
          end: segment.end,
          words: segment.words || null
        });
      }
    }

    this.#segments.sort((segA, segB) => segA.start - segB.start);
  }

  #handleSearch(query) {
    this.#searchQuery = query;
    this.#applySearch();
    this.#updateView();
  }

  #reapplySearch() {
    if (this.#searchQuery) {
      this.#applySearch();
    }

    this.#updateView();
  }

  #applySearch() {
    this.#matches = [];
    this.#currentMatchIdx = -1;

    if (!this.#searchQuery) return;

    const lowerQuery = this.#searchQuery.toLowerCase();

    for (let idx = 0; idx < this.#segments.length; idx++) {
      const seg = this.#segments[idx];
      const lowerText = seg.text.toLowerCase();
      let pos = 0;

      while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
        const matchTime = this.#findWordTimeAtCharOffset(seg, pos);
        this.#matches.push({ segmentIdx: idx, charOffset: pos, time: matchTime });
        pos += 1;
      }
    }

    this.#matches.sort((matchA, matchB) => matchA.time - matchB.time);

    if (this.#matches.length > 0) {
      this.#currentMatchIdx = 0;
      this.#seekToCurrentMatch();
    }
  }

  #navigateNext() {
    if (this.#matches.length === 0) return;

    this.#currentMatchIdx = (this.#currentMatchIdx + 1) % this.#matches.length;
    this.#seekToCurrentMatch();
    this.#updateView();
  }

  #navigatePrev() {
    if (this.#matches.length === 0) return;

    this.#currentMatchIdx =
      (this.#currentMatchIdx - 1 + this.#matches.length) % this.#matches.length;
    this.#seekToCurrentMatch();
    this.#updateView();
  }

  /**
   * @param {Segment} segment
   * @param {number} charOffset
   * @returns {number}
   */
  #findWordTimeAtCharOffset(segment, charOffset) {
    let currentOffset = 0;

    for (const word of segment.words) {
      const wordLen = word.word ? word.word.length : 0;
      const wordEnd = currentOffset + wordLen;

      if (charOffset >= currentOffset && charOffset < wordEnd) {
        return word.start;
      }

      currentOffset = wordEnd + 1;
    }

    return segment.start;
  }

  #seekToCurrentMatch() {
    if (this.#currentMatchIdx < 0) return;

    const match = this.#matches[this.#currentMatchIdx];

    if (match) {
      EventService.emitLocal(EVENT.TIMELINE_SCROLL_TO, { time: match.time });
      EventService.emitLocal(EVENT.PLAYBACK_MOVE_FROM_NAVIGATOR, { time: match.time });
    }
  }

  #updateView() {
    let matchText = '';

    if (this.#searchQuery && this.#matches.length === 0) {
      matchText = LABEL.TRANSCRIPT_NO_RESULTS;
    } else if (this.#matches.length > 0) {
      matchText = `${this.#currentMatchIdx + 1}/${this.#matches.length}`;
    }

    this.#view?.setState({ matchText });
  }
}
