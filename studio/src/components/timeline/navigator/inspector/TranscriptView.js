// @ts-check

import { LABEL } from '../../../../config/constants';

/**
 * @typedef {Object} WordTimestamp
 * @property {number} start
 * @property {number} end
 * @property {string} word
 * @property {number} [probability]
 */

/**
 * @typedef {Object} TranscriptSegment
 * @property {number} start
 * @property {number} end
 * @property {string} text
 * @property {WordTimestamp[]} [words]
 */

/**
 * @typedef {Object} TranscriptWord
 * @property {number} start
 * @property {number} end
 * @property {string} text
 * @property {HTMLSpanElement} [el]
 */

/**
 * @typedef {Object} TranscriptCallbacks
 * @property {(startTime: number) => void} onWordClick
 * @property {(query: string) => void} onSearchChange
 * @property {() => void} onNextMatch
 * @property {() => void} onPrevMatch
 */

/**
 * Find the word at `currentTime` via binary search
 * @param {TranscriptWord[]} words
 * @param {number} currentTime
 * @returns {number}
 */
function binarySearchWord(words, currentTime) {
  let low = 0;
  let high = words.length - 1;

  while (low <= high) {
    const mid = (low + high) >>> 1;
    const word = words[mid];

    if (currentTime < word.start) {
      high = mid - 1;
    } else if (currentTime >= word.end) {
      low = mid + 1;
    } else {
      return mid;
    }
  }

  return -1;
}

export default class TranscriptView {
  #$container = null;
  #$searchInput = null;
  #$matchCount = null;
  #$prevBtn = null;
  #$nextBtn = null;
  #$body = null;

  /** @type {TranscriptWord[]} */
  #words = [];
  /** @type {number[]} */
  #matchIndices = [];
  #currentMatchIdx = -1;
  #activeWordIdx = -1;
  #searchQuery = '';

  /** @type {TranscriptCallbacks} */
  #callbacks = { onWordClick: () => {}, onSearchChange: () => {}, onNextMatch: () => {}, onPrevMatch: () => {} };

  /**
   * @param {HTMLElement} $parent
   */
  constructor($parent) {
    this.#buildDom($parent);
    this.#bindEvents();
  }

  /**
   * @param {TranscriptCallbacks} callbacks
   */
  bind(callbacks) {
    this.#callbacks = { ...this.#callbacks, ...callbacks };
  }

  /**
   * @param {TranscriptSegment[]} segments
   */
  setSegments(segments) {
    this.#words = [];
    this.#matchIndices = [];
    this.#currentMatchIdx = -1;
    this.#activeWordIdx = -1;

    const $fragment = document.createDocumentFragment();

    for (const segment of segments) {
      const $segmentBlock = document.createElement('span');
      $segmentBlock.className = 'transcript-segment';

      for (const wordData of segment.words) {
        const $span = document.createElement('span');
        $span.className = 'transcript-word';
        $span.textContent = wordData.word;
        $span.dataset.start = String(wordData.start);
        $span.dataset.end = String(wordData.end);
        if (wordData.probability !== undefined) {
          $span.dataset.probability = String(wordData.probability);
        }

        $segmentBlock.appendChild($span);
        $segmentBlock.appendChild(document.createTextNode(' '));

        this.#words.push({
          start: wordData.start,
          end: wordData.end,
          text: wordData.word,
          el: $span
        });
      }

      $fragment.appendChild($segmentBlock);
    }

    this.#$body.replaceChildren($fragment);

    if (this.#searchQuery) {
      this.#applySearch(this.#searchQuery);
    }
  }

  /**
   * @param {number} currentTime
   */
  setCurrentTime(currentTime) {
    const newActiveIdx = binarySearchWord(this.#words, currentTime);

    if (newActiveIdx === this.#activeWordIdx) {
      return;
    }

    if (this.#activeWordIdx >= 0 && this.#activeWordIdx < this.#words.length) {
      this.#words[this.#activeWordIdx].el?.classList.remove('is-active');
    }

    this.#activeWordIdx = newActiveIdx;

    if (newActiveIdx >= 0 && newActiveIdx < this.#words.length) {
      const wordEl = this.#words[newActiveIdx].el;
      wordEl?.classList.add('is-active');
      wordEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  show() {
    this.#$container.classList.remove('is-hidden');
  }

  hide() {
    this.#$container.classList.add('is-hidden');
  }

  clear() {
    this.#words = [];
    this.#matchIndices = [];
    this.#currentMatchIdx = -1;
    this.#activeWordIdx = -1;
    this.#searchQuery = '';
    this.#$searchInput.value = '';
    this.#$matchCount.textContent = '';
    this.#$body.replaceChildren();
  }

  destroy() {
    this.#$searchInput?.removeEventListener('input', this.#handleSearchInput);
    this.#$prevBtn?.removeEventListener('click', this.#handlePrevClick);
    this.#$nextBtn?.removeEventListener('click', this.#handleNextClick);
    this.#$body?.removeEventListener('click', this.#handleBodyClick);
    this.#$container?.remove();
  }

  #buildDom($parent) {
    this.#$container = document.createElement('div');
    this.#$container.className = 'inspector-transcript is-hidden';

    const $search = document.createElement('div');
    $search.className = 'transcript-search';

    this.#$searchInput = document.createElement('input');
    this.#$searchInput.type = 'text';
    this.#$searchInput.className = 'transcript-search-input';
    this.#$searchInput.placeholder = LABEL.TRANSCRIPT_SEARCH_PLACEHOLDER;

    this.#$matchCount = document.createElement('span');
    this.#$matchCount.className = 'transcript-match-count';

    this.#$prevBtn = document.createElement('button');
    this.#$prevBtn.className = 'transcript-nav-btn';
    this.#$prevBtn.setAttribute('aria-label', 'Previous match');
    this.#$prevBtn.innerHTML = '<i class="bi bi-chevron-up"></i>';

    this.#$nextBtn = document.createElement('button');
    this.#$nextBtn.className = 'transcript-nav-btn';
    this.#$nextBtn.setAttribute('aria-label', 'Next match');
    this.#$nextBtn.innerHTML = '<i class="bi bi-chevron-down"></i>';

    $search.append(this.#$searchInput, this.#$matchCount, this.#$prevBtn, this.#$nextBtn);

    this.#$body = document.createElement('div');
    this.#$body.className = 'transcript-body';

    this.#$container.append($search, this.#$body);
    $parent.appendChild(this.#$container);
  }

  #bindEvents() {
    this.#$searchInput.addEventListener('input', this.#handleSearchInput);
    this.#$prevBtn.addEventListener('click', this.#handlePrevClick);
    this.#$nextBtn.addEventListener('click', this.#handleNextClick);
    this.#$body.addEventListener('click', this.#handleBodyClick);
  }

  #handleSearchInput = () => {
    const query = this.#$searchInput.value.trim();
    this.#searchQuery = query;
    this.#applySearch(query);
    this.#callbacks.onSearchChange(query);
  };

  #handlePrevClick = () => {
    if (this.#matchIndices.length === 0) return;

    this.#currentMatchIdx = (this.#currentMatchIdx - 1 + this.#matchIndices.length) % this.#matchIndices.length;
    this.#highlightCurrentMatch();
    this.#callbacks.onPrevMatch();
  };

  #handleNextClick = () => {
    if (this.#matchIndices.length === 0) return;

    this.#currentMatchIdx = (this.#currentMatchIdx + 1) % this.#matchIndices.length;
    this.#highlightCurrentMatch();
    this.#callbacks.onNextMatch();
  };

  #handleBodyClick = (event) => {
    const $word = event.target.closest('.transcript-word');
    if (!$word) return;

    const startTime = parseFloat($word.dataset.start);

    if (!isNaN(startTime)) {
      this.#callbacks.onWordClick(startTime);
    }
  };

  /**
   * @param {string} query
   */
  #applySearch(query) {
    for (const word of this.#words) {
      word.el?.classList.remove('is-match', 'is-current-match');
    }

    this.#matchIndices = [];
    this.#currentMatchIdx = -1;

    if (!query) {
      this.#$matchCount.textContent = '';

      return;
    }

    const lowerQuery = query.toLowerCase();

    for (let idx = 0; idx < this.#words.length; idx++) {
      if (this.#words[idx].text.toLowerCase().includes(lowerQuery)) {
        this.#matchIndices.push(idx);
        this.#words[idx].el?.classList.add('is-match');
      }
    }

    if (this.#matchIndices.length > 0) {
      this.#currentMatchIdx = 0;
      this.#highlightCurrentMatch();
    }

    this.#updateMatchCount();
  }

  #highlightCurrentMatch() {
    for (const idx of this.#matchIndices) {
      this.#words[idx].el?.classList.remove('is-current-match');
    }

    if (this.#currentMatchIdx >= 0 && this.#currentMatchIdx < this.#matchIndices.length) {
      const wordIdx = this.#matchIndices[this.#currentMatchIdx];
      const wordEl = this.#words[wordIdx].el;
      wordEl?.classList.add('is-current-match');
      wordEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    this.#updateMatchCount();
  }

  #updateMatchCount() {
    const total = this.#matchIndices.length;

    if (total === 0 && this.#searchQuery) {
      this.#$matchCount.textContent = LABEL.TRANSCRIPT_NO_RESULTS;
    } else if (total > 0) {
      this.#$matchCount.textContent = `${this.#currentMatchIdx + 1}/${total}`;
    } else {
      this.#$matchCount.textContent = '';
    }
  }

  /**
   * Get the start time of the current match (for seek-on-navigate)
   * @returns {number | null}
   */
  getCurrentMatchTime() {
    if (this.#currentMatchIdx < 0 || this.#currentMatchIdx >= this.#matchIndices.length) {
      return null;
    }

    const wordIdx = this.#matchIndices[this.#currentMatchIdx];

    return this.#words[wordIdx]?.start ?? null;
  }
}
