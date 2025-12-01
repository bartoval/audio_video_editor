import { View, getPosXFromTime, getTimeFromPosX, scaleChanged } from '../../../../lib';
import { getThumbsManifestUrl, getTileUrl, invalidateCache } from '../../../../services/workspace';
import { getDefaultScale, getTiles, getThumbsPerTile } from '../../../../services/ConfigStore';
import { THUMBNAILS } from '../../../../config/ui';
import ThumbPreview from './ThumbPreview';
import timelineStore from '../../../../store/timelineStore';
import scaleManager from '../../../../services/ScaleManager';
import thumbnailMapper from '../../../../services/ThumbnailMapper';

export default class TiledThumbsView extends View {
  #$container = null;
  #preview = null;
  #posX = 0;
  #duration = 0;
  #manifest = null;
  #loadedTiles = new Map();
  #renderedThumbs = new Map();
  #thumbWidth = 0;
  #thumbHeight = 0;
  #initInProgress = false;
  #currentScaleKey = null;
  #currentRenderScale = null;
  #unsubscribeStore = null;
  #unsubscribeScaleManager = null;
  #wasThumbsLoading = false;
  #previousScalesCount = 0;

  constructor($parent) {
    super($parent);
    this.mount();
    this.#setupStoreSubscription();
    this.#setupScaleManagerSubscription();
  }

  template() {
    return `
      <div class="thumbs thumbs-tiled" data-testid="thumbs-container">
        <ul class="list-unstyled"></ul>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.#$container = wrapper.firstElementChild;
    this.$parent.appendChild(this.#$container);
    this.$node = this.#$container.querySelector('ul');
  }

  onMount() {
    this.#$container.addEventListener('mousemove', this.#handleMouseMove);
    this.#$container.addEventListener('mouseleave', this.#handleMouseLeave);
  }

  onDestroy() {
    if (this.#unsubscribeStore) {
      this.#unsubscribeStore();
      this.#unsubscribeStore = null;
    }

    if (this.#unsubscribeScaleManager) {
      this.#unsubscribeScaleManager();
      this.#unsubscribeScaleManager = null;
    }
  }

  #setupStoreSubscription() {
    const currentState = timelineStore.getState();
    this.#wasThumbsLoading = currentState.thumbs.loading;
    this.#previousScalesCount = currentState.thumbs.scalesReady.length;

    this.#unsubscribeStore = timelineStore.subscribe(state => {
      const { loading, scalesReady } = state.thumbs;

      if (scalesReady.length > this.#previousScalesCount) {
        this.#tryLoadManifest();
      }

      if (this.#wasThumbsLoading && !loading) {
        this.#tryLoadManifest();
      }

      this.#wasThumbsLoading = loading;
      this.#previousScalesCount = scalesReady.length;
    });
  }

  #setupScaleManagerSubscription() {
    this.#unsubscribeScaleManager = scaleManager.onChange(() => {
      if (this.#manifest && this.#duration > 0) {
        this.#updateVisible();
      }
    });
  }

  async init(duration) {
    if (this.#initInProgress) {
      return true;
    }

    this.#initInProgress = true;
    this.#loadedTiles.clear();
    this.#renderedThumbs.clear();
    this.#manifest = null;
    this.#posX = 0;
    this.#currentScaleKey = null;
    this.$node.innerHTML = '';
    this.#setLoading(true);

    try {
      this.#duration = duration;
      this.#preview = new ThumbPreview(duration);
      await this.#tryLoadManifest();

      return true;
    } finally {
      this.#initInProgress = false;
    }
  }

  async reload() {
    if (this.#initInProgress || this.#duration <= 0) {
      return true;
    }

    this.#loadedTiles.clear();
    this.#renderedThumbs.clear();
    this.#manifest = null;
    this.#currentScaleKey = null;
    this.$node.innerHTML = '';
    await this.#tryLoadManifest();

    return true;
  }

  setLoading(isLoading) {
    if (isLoading) {
      this.#loadedTiles.clear();
      this.#renderedThumbs.clear();
      this.#manifest = null;
      this.#currentScaleKey = null;
      this.$node.innerHTML = '';
      this.#setLoading(true);
    } else {
      this.#setLoading(false);
    }
  }

  zoom(width, posX) {
    this.#moveTo(posX);
    this.$node.style.width = width + 'px';
    this.#updateVisible();

    return true;
  }

  moveTo(posX) {
    this.#moveTo(posX);
    this.#updateVisible();

    return true;
  }

  updateFrame(posX) {
    this.#moveTo(posX);

    return true;
  }

  /**
   * Handle SSE progress update - reload when new scales become available
   * @param {Object} data - { status, progress: { percent, scale } }
   */
  onProgress(data) {
    const { status, progress } = data;
    const targetScale = this.#getTargetScaleKey();

    if (status === 'scale_complete' && progress) {
      const { scale } = progress;

      if (scale === targetScale) {
        this.#setLoading(false);
        invalidateCache();
        this.reload();
      }
    } else if (status === 'complete') {
      this.#setLoading(false);
      invalidateCache();
      this.reload();
    }
  }

  /**
   * Get the thumb scale key for current zoom level
   * Maps render scale (continuous) to thumb scale (discrete)
   */
  #getTargetScaleKey() {
    const currentScale = scaleManager.getScale();

    if (currentScale <= 0) {
      return getDefaultScale();
    }

    return thumbnailMapper.getThumbScaleForRenderScale(currentScale);
  }

  #setLoading(isLoading) {
    if (isLoading) {
      this.#$container.classList.add('loading');
    } else {
      this.#$container.classList.remove('loading');
    }
  }

  async #tryLoadManifest() {
    try {
      await this.#loadManifest();

      this.$node.style.width = getPosXFromTime(this.#duration) + 'px';
      this.$node.classList.remove('hide');

      const scaleData = this.#getScaleData();

      if (scaleData) {
        this.#setLoading(false);
        this.#updateVisible();
      } else {
        this.#setLoading(true);

        const currentState = timelineStore.getState();
        if (!currentState.thumbs.loading) {
          timelineStore.actions.setThumbsLoading(true);
          timelineStore.actions.setThumbsStatus('processing');
        }
      }

      if (this.#manifest.status !== 'processing') {
        timelineStore.actions.setThumbsLoading(false);
        timelineStore.actions.setThumbsStatus('ready');
      }
    } catch {
      this.#setLoading(true);
      this.#pollForManifest();
    }
  }

  #pollForManifest() {
    let retries = 0;

    const poll = async () => {
      if (this.#manifest || this.#duration <= 0) {
        return;
      }

      try {
        await this.#loadManifest();
        this.#setLoading(false);
        this.$node.style.width = getPosXFromTime(this.#duration) + 'px';
        this.$node.classList.remove('hide');
        this.#updateVisible();
      } catch {
        retries++;

        if (retries < THUMBNAILS.MAX_RETRIES) {
          setTimeout(poll, 1000);
        }
      }
    };

    setTimeout(poll, 1000);
  }

  async #loadManifest() {
    const url = getThumbsManifestUrl();
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error('Failed to load manifest');
    }

    this.#manifest = await res.json();

    const { thumbWidth, thumbHeight, scales } = this.#manifest;
    this.#thumbWidth = thumbWidth;
    this.#thumbHeight = thumbHeight;

    if (scales) {
      const availableScales = Object.keys(scales).map(scale => parseFloat(scale));
      thumbnailMapper.setAvailableScales(availableScales);
    }
  }

  #getScaleData() {
    if (!this.#manifest) {
      return null;
    }

    const scaleKey = this.#getTargetScaleKey();

    if (this.#manifest.scales[scaleKey]) {
      return this.#manifest.scales[scaleKey];
    }

    return null;
  }

  #getVisibleThumbRange(scaleData) {
    const { interval, totalThumbs } = scaleData;
    const containerWidth = this.#$container.offsetWidth || window.innerWidth;
    const bufferPx = containerWidth;

    const startTime = Math.max(0, getTimeFromPosX(Math.max(0, this.#posX - bufferPx)));
    const endTime = Math.min(
      this.#duration,
      getTimeFromPosX(this.#posX + containerWidth + bufferPx)
    );

    const startIdx = Math.floor(startTime / interval);
    const endIdx = Math.min(Math.ceil(endTime / interval), totalThumbs - 1);

    return { startIdx, endIdx };
  }

  #getTileIndexForThumb(thumbIdx) {
    const thumbsPerTile = getThumbsPerTile();

    return Math.floor(thumbIdx / thumbsPerTile);
  }

  #getThumbPositionInTile(thumbIdx) {
    const { cols } = getTiles();
    const thumbsPerTile = getThumbsPerTile();
    const indexInTile = thumbIdx % thumbsPerTile;

    return {
      col: indexInTile % cols,
      row: Math.floor(indexInTile / cols)
    };
  }

  #updateVisible() {
    const scaleData = this.#getScaleData();

    if (!scaleData) {
      this.#setLoading(true);
      this.#renderedThumbs.clear();
      this.$node.innerHTML = '';
      this.#currentScaleKey = null;

      return;
    }

    const { scale: availableScale } = scaleData;
    const renderScale = scaleManager.getScale();

    this.#setLoading(false);

    const thumbScaleChanged = this.#currentScaleKey !== availableScale;
    const renderScaleChanged =
      this.#currentRenderScale !== null && scaleChanged(this.#currentRenderScale, renderScale);

    if (thumbScaleChanged || renderScaleChanged) {
      this.#renderedThumbs.clear();
      this.$node.innerHTML = '';
      this.#currentScaleKey = availableScale;
    }

    this.#currentRenderScale = renderScale;

    const { startIdx, endIdx } = this.#getVisibleThumbRange(scaleData);

    this.#removeOutOfRangeThumbs(startIdx, endIdx);
    this.#loadTilesForRange(startIdx, endIdx, scaleData);
    this.#renderThumbsInRange(startIdx, endIdx, scaleData);
  }

  #removeOutOfRangeThumbs(startIdx, endIdx) {
    const buffer = getThumbsPerTile();

    for (const [thumbIdx, $el] of this.#renderedThumbs) {
      if (thumbIdx < startIdx - buffer || thumbIdx > endIdx + buffer) {
        $el.remove();
        this.#renderedThumbs.delete(thumbIdx);
      }
    }
  }

  #loadTilesForRange(startIdx, endIdx, scaleData) {
    const { scale, tiles } = scaleData;
    const startTile = this.#getTileIndexForThumb(startIdx);
    const endTile = this.#getTileIndexForThumb(endIdx);

    for (let tileIdx = startTile; tileIdx <= endTile; tileIdx++) {
      const key = `${scale}-${tileIdx}`;

      if (this.#loadedTiles.has(key) || tileIdx >= tiles.length) {
        continue;
      }

      const tileFile = tiles[tileIdx];
      const url = getTileUrl(scale, tileFile);

      this.#loadedTiles.set(key, { status: 'loading', url });

      const img = new Image();

      img.onload = () => {
        this.#loadedTiles.set(key, { status: 'loaded', url, img });
        this.#updateThumbsForTile(tileIdx, scaleData);
      };

      img.onerror = () => {
        this.#loadedTiles.set(key, { status: 'error', url });
      };

      img.src = url;
    }
  }

  #renderThumbsInRange(startIdx, endIdx, scaleData) {
    const { scale, interval } = scaleData;

    const renderScale = scaleManager.getScale();
    const thumbScale = parseFloat(scale);
    const scaledThumbWidth = this.#thumbWidth * (thumbScale / renderScale);

    for (let thumbIdx = startIdx; thumbIdx <= endIdx; thumbIdx++) {
      if (this.#renderedThumbs.has(thumbIdx)) {
        continue;
      }

      const time = thumbIdx * interval;
      const posX = getPosXFromTime(time);
      const tileIdx = this.#getTileIndexForThumb(thumbIdx);
      const key = `${scale}-${tileIdx}`;
      const tileData = this.#loadedTiles.get(key);

      const $li = document.createElement('li');
      $li.className = 'thumb';
      $li.style.cssText = `position:absolute;left:${posX}px;width:${scaledThumbWidth}px;height:${this.#thumbHeight}px`;
      $li.dataset.idx = thumbIdx;

      if (tileData?.status === 'loaded') {
        this.#applyThumbBackground($li, thumbIdx, tileData.url);
      } else {
        $li.classList.add('loading');
      }

      this.$node.appendChild($li);
      this.#renderedThumbs.set(thumbIdx, $li);
    }
  }

  #updateThumbsForTile(tileIdx, scaleData) {
    const { scale } = scaleData;
    const key = `${scale}-${tileIdx}`;
    const tileData = this.#loadedTiles.get(key);

    if (tileData?.status !== 'loaded') {
      return;
    }

    const thumbsPerTile = getThumbsPerTile();
    const startThumb = tileIdx * thumbsPerTile;
    const endThumb = startThumb + thumbsPerTile;

    for (let thumbIdx = startThumb; thumbIdx < endThumb; thumbIdx++) {
      const $li = this.#renderedThumbs.get(thumbIdx);

      if ($li && $li.classList.contains('loading')) {
        $li.classList.remove('loading');
        this.#applyThumbBackground($li, thumbIdx, tileData.url);
      }
    }
  }

  #applyThumbBackground($el, thumbIdx, url) {
    const { col, row } = this.#getThumbPositionInTile(thumbIdx);
    $el.style.backgroundImage = `url(${url})`;
    $el.style.backgroundPosition = `-${col * this.#thumbWidth}px -${row * this.#thumbHeight}px`;
    $el.style.backgroundRepeat = 'no-repeat';
  }

  #moveTo(posX) {
    this.$node.style.transform = `translate3d(${-posX}px, 0, 0)`;
    this.#posX = parseFloat(posX);

    return true;
  }

  #handleMouseMove = event => {
    const rect = this.#$container.getBoundingClientRect();
    this.#preview?.show(event, rect, this.#posX);
  };

  #handleMouseLeave = () => {
    this.#preview?.hide();
  };
}
