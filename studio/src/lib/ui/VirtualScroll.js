const binarySearchStart = (offsets, target) => {
  let low = 0;
  let high = offsets.length - 1;

  while (low < high) {
    const mid = (low + high) >>> 1;
    offsets[mid] < target ? (low = mid + 1) : (high = mid);
  }

  return low;
};

const binarySearchEnd = (offsets, target) => {
  let low = 0;
  let high = offsets.length - 1;

  while (low < high) {
    const mid = (low + high + 1) >>> 1;
    offsets[mid] <= target ? (low = mid) : (high = mid - 1);
  }

  return low;
};

export default class VirtualScroll {
  constructor($container, options = {}) {
    const {
      itemHeight = 50,
      bufferSize = 5,
      renderItem = null,
      onRender = null,
      itemsClass = ''
    } = options;

    this.$container = $container;
    this.itemHeight = itemHeight;
    this.bufferSize = bufferSize;
    this.renderItem = renderItem;
    this.onRender = onRender;
    this.itemsClass = itemsClass;

    this.items = [];
    this.offsets = [];
    this.renderedItems = new Map();
    this.scrollTop = 0;
    this.viewportHeight = 0;
    this.startIndex = 0;
    this.endIndex = 0;
    this.scrollRAF = null;

    this.$viewport = null;
    this.$content = null;
    this.$items = null;

    this._onScroll = this._onScroll.bind(this);
    this._onResize = this._onResize.bind(this);

    this._init();
  }

  _init() {
    this._createDOM();
    this._bindEvents();
    this._measureViewport();
  }

  _createDOM() {
    this.$container.innerHTML = '';

    this.$viewport = document.createElement('div');
    this.$viewport.className = 'vs-viewport';
    this.$viewport.style.cssText =
      'height:100%;overflow-y:auto;overflow-x:hidden;position:relative;';

    this.$content = document.createElement('div');
    this.$content.className = 'vs-content';
    this.$content.style.cssText = 'position:relative;width:100%;';

    this.$items = document.createElement('ul');
    this.$items.className = `vs-items${this.itemsClass ? ` ${this.itemsClass}` : ''}`;
    this.$items.style.cssText =
      'position:absolute;top:0;left:0;right:0;margin:0;padding:0;list-style:none;';

    this.$content.appendChild(this.$items);
    this.$viewport.appendChild(this.$content);
    this.$container.appendChild(this.$viewport);
  }

  _bindEvents() {
    this.$viewport.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('resize', this._onResize);
  }

  _measureViewport() {
    requestAnimationFrame(() => {
      this.viewportHeight = this.$viewport.clientHeight || 400;
      this._update();
    });
  }

  _onScroll() {
    this.scrollTop = this.$viewport.scrollTop;

    if (!this.scrollRAF) {
      this.scrollRAF = requestAnimationFrame(() => {
        this.scrollRAF = null;
        this._update();
      });
    }
  }

  _onResize() {
    this.viewportHeight = this.$viewport.clientHeight || 400;
    this._update();
  }

  _calculateOffsets() {
    const { items, itemHeight } = this;
    this.offsets = items.map((_, index) => index * itemHeight);
  }

  _getTotalHeight() {
    return this.items.length * this.itemHeight;
  }

  _getVisibleRange() {
    const { scrollTop, viewportHeight, offsets, bufferSize, items } = this;

    if (items.length === 0) {
      return { start: 0, end: -1 };
    }

    const start = Math.max(0, binarySearchStart(offsets, scrollTop) - bufferSize);
    const end = Math.min(
      items.length - 1,
      binarySearchEnd(offsets, scrollTop + viewportHeight) + bufferSize
    );

    return { start, end };
  }

  _update() {
    if (this.items.length === 0) {
      this.$content.style.height = '0px';
      this.$items.innerHTML = '';
      this.renderedItems.clear();

      return;
    }

    this.$content.style.height = `${this._getTotalHeight()}px`;

    const { start, end } = this._getVisibleRange();

    if (start === this.startIndex && end === this.endIndex) {
      return;
    }

    this.startIndex = start;
    this.endIndex = end;
    this._renderRange(start, end);
  }

  _renderRange(start, end) {
    const neededIndexes = new Set(Array.from({ length: end - start + 1 }, (_, idx) => start + idx));

    this.renderedItems.forEach(($element, index) => {
      if (!neededIndexes.has(index)) {
        $element.remove();
        this.renderedItems.delete(index);
      }
    });

    for (let index = start; index <= end; index++) {
      if (!this.renderedItems.has(index) && this.items[index]) {
        const $item = this._createItem(this.items[index], index);

        if ($item) {
          Object.assign($item.style, {
            position: 'absolute',
            top: `${index * this.itemHeight}px`,
            left: '0',
            right: '0',
            height: `${this.itemHeight}px`,
            boxSizing: 'border-box'
          });

          this.$items.appendChild($item);
          this.renderedItems.set(index, $item);
          this.onRender?.(this.items[index], $item, index);
        }
      }
    }
  }

  _createItem(data, index) {
    if (this.renderItem) {
      return this.renderItem(data, index);
    }

    const $li = document.createElement('li');
    $li.className = 'vs-item';
    $li.textContent = data.name || `Item ${index}`;

    return $li;
  }

  setItems(items) {
    this.items = items || [];
    this.renderedItems.clear();
    this.$items.innerHTML = '';
    this.startIndex = 0;
    this.endIndex = -1;

    this._calculateOffsets();

    requestAnimationFrame(() => {
      this.viewportHeight = this.$viewport.clientHeight || 400;
      this._update();
    });
  }

  addItem(item) {
    this.items.push(item);
    this._calculateOffsets();
    this._update();
  }

  removeItem(id) {
    const index = this.items.findIndex(item => item.id === id);

    if (index === -1) {
      return;
    }

    this.items.splice(index, 1);
    this.renderedItems.clear();
    this.$items.innerHTML = '';
    this.startIndex = 0;
    this.endIndex = -1;
    this._calculateOffsets();
    this._update();
  }

  scrollToIndex(index, align = 'start') {
    const offset = index * this.itemHeight;

    const scrollPositions = {
      center: offset - this.viewportHeight / 2 + this.itemHeight / 2,
      end: offset - this.viewportHeight + this.itemHeight,
      start: offset
    };

    this.$viewport.scrollTop = Math.max(0, scrollPositions[align] ?? offset);
  }

  scrollToItem(id, align = 'center') {
    const index = this.items.findIndex(item => item.id === id);

    if (index !== -1) {
      this.scrollToIndex(index, align);
    }
  }

  getItemsContainer() {
    return this.$items;
  }

  getViewport() {
    return this.$viewport;
  }

  refresh() {
    this.viewportHeight = this.$viewport.clientHeight || 400;
    this.startIndex = 0;
    this.endIndex = -1;
    this._update();
  }

  getScrollTop() {
    return this.scrollTop;
  }

  getItemCount() {
    return this.items.length;
  }

  destroy() {
    if (this.scrollRAF) {
      cancelAnimationFrame(this.scrollRAF);
    }

    this.$viewport.removeEventListener('scroll', this._onScroll);
    window.removeEventListener('resize', this._onResize);
    this.renderedItems.clear();
    this.$container.innerHTML = '';
  }
}
