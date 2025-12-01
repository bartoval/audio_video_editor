import { getThumbAtTime } from '../../../../services/workspace';
import { getTimeFromPosX, getTimeFormatted, View } from '../../../../lib';
import { THUMBNAILS } from '../../../../config/ui';
import * as EventService from '../../../../services/EventService';

const { MAX_CACHE_SIZE, DEBOUNCE_MS } = THUMBNAILS;

/** Thumb preview popup with LRU cache */
export default class ThumbPreview extends View {
  #$image = null;
  #$time = null;
  #cache = new Map();
  #debounceTimer = null;
  #duration = 0;

  constructor(duration) {
    super(document.body);
    this.#duration = duration;
  }

  template() {
    return `
      <div class="thumb-preview">
        <div class="preview-image"></div>
        <div class="preview-time"></div>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);

    this.#$image = this.$node.querySelector('.preview-image');
    this.#$time = this.$node.querySelector('.preview-time');
  }

  setDuration(duration) {
    this.#duration = duration;
  }

  show(event, containerRect, posX) {
    if (!this.isMounted) {
      this.mount();
    }

    const mouseX = event.clientX - containerRect.left + posX;
    const time = Math.max(0, getTimeFromPosX(mouseX));
    const roundedTime = this.#roundTime(time);

    this.#$time.textContent = getTimeFormatted(time);
    this.#updatePosition(event, containerRect);
    this.$node.classList.add('visible');

    this.#loadThumbForTime(roundedTime);
  }

  hide() {
    if (this.#debounceTimer) {
      clearTimeout(this.#debounceTimer);
      this.#debounceTimer = null;
    }

    if (this.$node) {
      this.$node.classList.remove('visible');
    }
  }

  #updatePosition(event, rect) {
    this.$node.style.left = event.clientX - 80 + 'px';
    this.$node.style.top = rect.top - 130 + 'px';
  }

  #roundTime(time) {
    return Math.round(time * 2) / 2;
  }

  #loadThumbForTime(time) {
    const url = getThumbAtTime(time);

    if (!url || !EventService.isOnline()) {
      this.#showOfflineState();

      return;
    }

    this.#$image.classList.remove('offline');

    if (this.#cache.has(url)) {
      this.#displayThumb(this.#cache.get(url));
      this.#preloadAdjacent(time);

      return;
    }

    this.#$image.classList.add('loading');
    this.#$image.style.backgroundImage = 'none';

    if (this.#debounceTimer) {
      clearTimeout(this.#debounceTimer);
    }

    this.#debounceTimer = setTimeout(async () => {
      const thumb = await this.#fetchThumb(time);

      if (thumb && this.$node.classList.contains('visible')) {
        this.#displayThumb(thumb);
        this.#preloadAdjacent(time);
      }
    }, DEBOUNCE_MS);
  }

  #showOfflineState() {
    this.#$image.classList.remove('loading');
    this.#$image.classList.add('offline');
    this.#$image.style.backgroundImage = 'none';
  }

  #displayThumb(thumb) {
    this.#$image.classList.remove('loading', 'offline');
    this.#$image.style.backgroundImage = `url(${thumb.url})`;
    this.#$image.style.width = thumb.width + 'px';
    this.#$image.style.height = thumb.height + 'px';
    this.#$image.style.backgroundSize = 'contain';
    this.#$image.style.backgroundPosition = 'center';
  }

  #fetchThumb(time) {
    const url = getThumbAtTime(time);

    if (this.#cache.has(url)) {
      return Promise.resolve(this.#cache.get(url));
    }

    return new Promise(resolve => {
      const img = new Image();

      img.onload = () => {
        this.#addToCache(url, { url, width: img.naturalWidth, height: img.naturalHeight });
        resolve(this.#cache.get(url));
      };

      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  #addToCache(url, data) {
    if (this.#cache.size >= MAX_CACHE_SIZE) {
      const firstKey = this.#cache.keys().next().value;
      this.#cache.delete(firstKey);
    }

    this.#cache.set(url, data);
  }

  #preloadAdjacent(time) {
    const times = [time - 0.5, time + 0.5].filter(val => val >= 0 && val <= this.#duration);

    times.forEach(adjacentTime => {
      const roundedTime = this.#roundTime(adjacentTime);
      const url = getThumbAtTime(roundedTime);

      if (!this.#cache.has(url)) {
        const img = new Image();
        img.src = url;
        img.onload = () => {
          this.#addToCache(url, { url, width: img.naturalWidth, height: img.naturalHeight });
        };
      }
    });
  }
}
