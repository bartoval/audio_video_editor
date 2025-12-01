import { getThumbAtTime } from '../../../../services/workspace';
import { getTimeFromPosX, getTimeFormatted, View } from '../../../../lib';

const MAX_CACHE_SIZE = 30;
const DEBOUNCE_MS = 50;

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

  show(e, containerRect, posX) {
    if (!this.isMounted) {
      this.mount();
    }

    const mouseX = e.clientX - containerRect.left + posX;
    const time = Math.max(0, getTimeFromPosX(mouseX));
    const roundedTime = this.#roundTime(time);

    this.#$time.textContent = getTimeFormatted(time);
    this.#updatePosition(e, containerRect);
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

  // ============================================================================
  // Private
  // ============================================================================

  #updatePosition(e, rect) {
    this.$node.style.left = e.clientX - 80 + 'px';
    this.$node.style.top = rect.top - 130 + 'px';
  }

  #roundTime(time) {
    return Math.round(time * 2) / 2;
  }

  #loadThumbForTime(time) {
    const url = getThumbAtTime(time);

    // Offline - dynamic thumbs unavailable
    if (!url) {
      this.#$image.classList.add('loading');
      this.#$image.style.backgroundImage = 'none';

      return;
    }

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

  #displayThumb(thumb) {
    this.#$image.classList.remove('loading');
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
    const times = [time - 0.5, time + 0.5].filter(t => t >= 0 && t <= this.#duration);

    times.forEach(t => {
      const roundedT = this.#roundTime(t);
      const url = getThumbAtTime(roundedT);

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
