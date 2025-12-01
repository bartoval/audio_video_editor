import { LABEL } from '../../../../config/constants';

export default class TranscriptSearchView {
  #$container = null;
  #$input = null;
  #$matchCount = null;
  #$prevBtn = null;
  #$nextBtn = null;

  #callbacks = { onSearch: () => {}, onNext: () => {}, onPrev: () => {} };

  constructor($container) {
    this.#buildDom($container);
    this.#bindEvents();
  }

  bind(callbacks) {
    this.#callbacks = { ...this.#callbacks, ...callbacks };
  }

  setState({ matchText }) {
    this.#$matchCount.textContent = matchText;
  }

  destroy() {
    this.#$input?.removeEventListener('input', this.#handleInput);
    this.#$input?.removeEventListener('keydown', this.#handleKeydown);
    this.#$prevBtn?.removeEventListener('click', this.#handlePrev);
    this.#$nextBtn?.removeEventListener('click', this.#handleNext);
    this.#$container.innerHTML = '';
  }

  #buildDom($container) {
    this.#$container = $container;

    this.#$input = document.createElement('input');
    this.#$input.type = 'text';
    this.#$input.className = 'timeline-search-input';
    this.#$input.placeholder = `\u{1F50D} ${LABEL.TIMELINE_SEARCH_PLACEHOLDER}`;
    this.#$input.setAttribute('aria-label', 'Search transcripts');

    this.#$matchCount = document.createElement('span');
    this.#$matchCount.className = 'timeline-search-match-count';

    this.#$prevBtn = document.createElement('button');
    this.#$prevBtn.className = 'timeline-search-nav-btn';
    this.#$prevBtn.setAttribute('aria-label', 'Previous match');
    this.#$prevBtn.innerHTML = '<i class="bi bi-chevron-up"></i>';

    this.#$nextBtn = document.createElement('button');
    this.#$nextBtn.className = 'timeline-search-nav-btn';
    this.#$nextBtn.setAttribute('aria-label', 'Next match');
    this.#$nextBtn.innerHTML = '<i class="bi bi-chevron-down"></i>';

    this.#$container.append(this.#$prevBtn, this.#$nextBtn, this.#$input, this.#$matchCount);
  }

  #bindEvents() {
    this.#$input.addEventListener('input', this.#handleInput);
    this.#$input.addEventListener('keydown', this.#handleKeydown);
    this.#$prevBtn.addEventListener('click', this.#handlePrev);
    this.#$nextBtn.addEventListener('click', this.#handleNext);
  }

  #handleInput = () => {
    this.#callbacks.onSearch(this.#$input.value.trim());
  };

  #handleKeydown = event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.shiftKey ? this.#callbacks.onPrev() : this.#callbacks.onNext();
    }

    if (event.key === 'Escape') {
      event.stopPropagation();
      this.#$input.blur();
    }
  };

  #handlePrev = () => this.#callbacks.onPrev();
  #handleNext = () => this.#callbacks.onNext();
}
