import { View, getScale, getPosXFromTime, getTimeFromPosX } from '../../../../lib';
import { getThumbsManifestUrl, getThumbsUrl, getTileUrl } from '../../../../services/workspace';
import { THUMBS } from '../../../../config/ui';
import ThumbPreview from './ThumbPreview';

const { COLS, ROWS } = THUMBS.TILES;
const THUMBS_PER_TILE = COLS * ROWS;

/** Netflix-style tiled thumbs view with lazy loading and legacy fallback */
export default class TiledThumbsView extends View {
  #$container = null;
  #$image = null;
  #preview = null;
  #posX = 0;
  #duration = 0;
  #manifest = null;
  #loadedTiles = new Map();
  #visibleRange = { start: 0, end: 0 };
  #thumbWidth = 0;
  #thumbHeight = 0;
  #useLegacyMode = false;

  constructor($parent) {
    super($parent);
    this.mount();
  }

  template() {
    return `
      <div class="thumbs thumbs-tiled">
        <ul class="list-unstyled">
          <li class="thumb">
            <img class="img" draggable="false" loading="lazy" decoding="async">
          </li>
        </ul>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.#$container = wrapper.firstElementChild;
    this.$parent.appendChild(this.#$container);
    this.$node = this.#$container.querySelector('ul');
    this.#$image = this.#$container.querySelector('img');
  }

  onMount() {
    this.#$container.addEventListener('mousemove', this.#handleMouseMove);
    this.#$container.addEventListener('mouseleave', this.#handleMouseLeave);
  }

  async init(duration) {
    // Reset state for new video
    this.#loadedTiles.clear();
    this.#manifest = null;
    this.#useLegacyMode = false;
    this.#posX = 0;
    this.$node.innerHTML = '';

    this.#duration = duration;
    this.#preview = new ThumbPreview(duration);

    try {
      await this.#loadManifest();
      this.#redraw(getPosXFromTime(duration));
    } catch (err) {
      // Fallback to legacy mode if manifest not available
      console.warn('Tiles manifest not available, falling back to legacy mode');
      this.#useLegacyMode = true;
      this.#initLegacy(duration);
    }

    return true;
  }

  // ============================================================================
  // Legacy Mode Fallback
  // ============================================================================

  #initLegacy(duration) {
    this.#$image.src = getThumbsUrl(`${getScale()}${THUMBS.EXTENSION}`);
    this.#redrawLegacy(getPosXFromTime(duration));
  }

  #redrawLegacy(width) {
    this.$node.style.width = width + 'px';
    this.$node.classList.remove('hide');
  }

  #zoomLegacy(width, posX) {
    this.#$image.src = getThumbsUrl(`${getScale()}${THUMBS.EXTENSION}`);
    this.#moveTo(posX);
    this.#redrawLegacy(width);
  }

  zoom(width, posX) {
    if (this.#useLegacyMode) {
      this.#zoomLegacy(width, posX);

      return true;
    }

    this.#moveTo(posX);
    this.#redraw(width);
    this.#updateVisibleTiles();

    return true;
  }

  moveTo(posX) {
    this.#moveTo(posX);

    if (!this.#useLegacyMode) {
      this.#updateVisibleTiles();
    }

    return true;
  }

  updateFrame(posX) {
    this.#moveTo(posX);

    return true;
  }

  // ============================================================================
  // Private - Manifest Loading
  // ============================================================================

  async #loadManifest() {
    const url = getThumbsManifestUrl();
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error('Failed to load manifest');
    }

    this.#manifest = await res.json();

    const { thumbWidth, thumbHeight } = this.#manifest;
    this.#thumbWidth = thumbWidth;
    this.#thumbHeight = thumbHeight;
  }

  // ============================================================================
  // Private - Tile Management
  // ============================================================================

  #getScaleData() {
    if (!this.#manifest) {
      return null;
    }

    const currentScale = getScale();
    const scaleKey = String(currentScale);

    return this.#manifest.scales[scaleKey] || null;
  }

  #getTileIndexForTime(time, scaleData) {
    const { interval } = scaleData;
    const thumbIndex = Math.floor(time / interval);

    return Math.floor(thumbIndex / THUMBS_PER_TILE);
  }

  #getThumbPositionInTile(time, scaleData) {
    const { interval } = scaleData;
    const thumbIndex = Math.floor(time / interval);
    const indexInTile = thumbIndex % THUMBS_PER_TILE;

    const col = indexInTile % COLS;
    const row = Math.floor(indexInTile / COLS);

    return { col, row };
  }

  #updateVisibleTiles() {
    const scaleData = this.#getScaleData();

    if (!scaleData) {
      return;
    }

    const containerWidth = this.#$container.offsetWidth;
    const startTime = Math.max(0, getTimeFromPosX(this.#posX));
    const endTime = Math.min(this.#duration, getTimeFromPosX(this.#posX + containerWidth));

    const startTile = this.#getTileIndexForTime(startTime, scaleData);
    const endTile = this.#getTileIndexForTime(endTime, scaleData);

    this.#visibleRange = { start: startTile, end: endTile };

    // Load visible tiles + buffer
    const bufferTiles = 1;

    for (let i = Math.max(0, startTile - bufferTiles); i <= endTile + bufferTiles; i++) {
      this.#loadTile(i, scaleData);
    }
  }

  #loadTile(tileIndex, scaleData) {
    const scale = getScale();
    const key = `${scale}-${tileIndex}`;

    if (this.#loadedTiles.has(key)) {
      return;
    }

    const { tiles } = scaleData;

    if (tileIndex >= tiles.length) {
      return;
    }

    const tileFile = tiles[tileIndex];
    const url = getTileUrl(scale, tileFile);

    // Mark as loading
    this.#loadedTiles.set(key, { status: 'loading', url });

    const img = new Image();

    img.onload = () => {
      this.#loadedTiles.set(key, { status: 'loaded', url, img });
      this.#renderThumbs();
    };

    img.onerror = () => {
      this.#loadedTiles.set(key, { status: 'error', url });
    };

    img.src = url;
  }

  // ============================================================================
  // Private - Rendering
  // ============================================================================

  #renderThumbs() {
    const scaleData = this.#getScaleData();

    if (!scaleData) {
      return;
    }

    const { interval, totalThumbs } = scaleData;
    const scale = getScale();

    // Clear existing thumbs
    this.$node.innerHTML = '';

    // Create thumb elements for visible range
    for (let thumbIdx = 0; thumbIdx < totalThumbs; thumbIdx++) {
      const time = thumbIdx * interval;
      const posX = getPosXFromTime(time);

      const tileIndex = Math.floor(thumbIdx / THUMBS_PER_TILE);
      const key = `${scale}-${tileIndex}`;
      const tileData = this.#loadedTiles.get(key);

      const $li = document.createElement('li');
      $li.className = 'thumb';
      $li.style.position = 'absolute';
      $li.style.left = `${posX}px`;
      $li.style.width = `${this.#thumbWidth}px`;
      $li.style.height = `${this.#thumbHeight}px`;

      if (tileData?.status === 'loaded') {
        const { col, row } = this.#getThumbPositionInTile(time, scaleData);
        const bgX = col * this.#thumbWidth;
        const bgY = row * this.#thumbHeight;

        $li.style.backgroundImage = `url(${tileData.url})`;
        $li.style.backgroundPosition = `-${bgX}px -${bgY}px`;
        $li.style.backgroundRepeat = 'no-repeat';
      } else {
        $li.classList.add('loading');
      }

      this.$node.appendChild($li);
    }
  }

  #redraw(width) {
    this.$node.style.width = width + 'px';
    this.$node.classList.remove('hide');
    this.#updateVisibleTiles();
  }

  #moveTo(posX) {
    const t = `translate3d(${-posX}px, 0, 0)`;
    this.$node.style.transform = t;
    this.#posX = parseFloat(posX);

    return true;
  }

  // ============================================================================
  // Private - Event Handlers
  // ============================================================================

  #handleMouseMove = e => {
    const rect = this.#$container.getBoundingClientRect();
    this.#preview?.show(e, rect, this.#posX);
  };

  #handleMouseLeave = () => {
    this.#preview?.hide();
  };
}
