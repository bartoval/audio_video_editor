import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import VirtualScroll from '../VirtualScroll.js';

// Helper to flush RAF
const flushRAF = () => new Promise(resolve => requestAnimationFrame(resolve));

describe('VirtualScroll', () => {
  let $container;
  let virtualScroll;
  let mockItems;

  beforeEach(() => {
    $container = document.createElement('div');
    $container.style.height = '400px';
    document.body.appendChild($container);

    mockItems = Array.from({ length: 100 }, (_, i) => ({
      id: `item-${i}`,
      name: `Item ${i}`,
      value: i
    }));

    vi.clearAllMocks();
  });

  afterEach(() => {
    if (virtualScroll) {
      virtualScroll.destroy();
    }
    if ($container.parentNode) {
      document.body.removeChild($container);
    }
  });

  describe('initialization', () => {
    it('creates DOM structure', async () => {
      virtualScroll = new VirtualScroll($container);
      await flushRAF();

      const $viewport = virtualScroll.getViewport();
      const $content = $container.querySelector('.vs-content');
      const $items = virtualScroll.getItemsContainer();

      expect($viewport).toBeTruthy();
      expect($content).toBeTruthy();
      expect($items).toBeTruthy();
    });

    it('uses default itemHeight of 50', () => {
      virtualScroll = new VirtualScroll($container);
      expect(virtualScroll.itemHeight).toBe(50);
    });

    it('uses custom itemHeight option', () => {
      virtualScroll = new VirtualScroll($container, { itemHeight: 80 });
      expect(virtualScroll.itemHeight).toBe(80);
    });

    it('uses default bufferSize of 5', () => {
      virtualScroll = new VirtualScroll($container);
      expect(virtualScroll.bufferSize).toBe(5);
    });

    it('uses custom bufferSize option', () => {
      virtualScroll = new VirtualScroll($container, { bufferSize: 10 });
      expect(virtualScroll.bufferSize).toBe(10);
    });
  });

  describe('setItems', () => {
    beforeEach(() => {
      virtualScroll = new VirtualScroll($container, { itemHeight: 50 });
    });

    it('sets items array', async () => {
      virtualScroll.setItems(mockItems);
      await flushRAF();
      expect(virtualScroll.getItemCount()).toBe(100);
    });

    it('calculates total height', async () => {
      virtualScroll.setItems(mockItems);
      await flushRAF();

      const $content = $container.querySelector('.vs-content');
      expect($content.style.height).toBe('5000px'); // 100 items * 50px
    });

    it('handles empty items array', async () => {
      virtualScroll.setItems([]);
      await flushRAF();

      const $content = $container.querySelector('.vs-content');
      expect($content.style.height).toBe('0px');
      expect(virtualScroll.getItemCount()).toBe(0);
    });

    it('handles null items', async () => {
      virtualScroll.setItems(null);
      await flushRAF();

      expect(virtualScroll.getItemCount()).toBe(0);
    });

    it('clears previous items', async () => {
      virtualScroll.setItems(mockItems.slice(0, 10));
      await flushRAF();
      virtualScroll.setItems(mockItems.slice(0, 5));
      await flushRAF();

      expect(virtualScroll.getItemCount()).toBe(5);
    });
  });

  describe('rendering', () => {
    beforeEach(async () => {
      virtualScroll = new VirtualScroll($container, { itemHeight: 50 });
      virtualScroll.setItems(mockItems);
      await flushRAF();
    });

    it('renders visible items only', () => {
      const renderedCount = virtualScroll.renderedItems.size;
      // Should render viewport items + buffer, not all 100
      expect(renderedCount).toBeLessThan(100);
      expect(renderedCount).toBeGreaterThan(0);
    });

    it('uses default renderItem when none provided', () => {
      const $items = $container.querySelectorAll('.vs-item');
      expect($items.length).toBeGreaterThan(0);
    });

    it('uses custom renderItem function', async () => {
      virtualScroll.destroy();

      const renderItem = vi.fn((data, index) => {
        const $li = document.createElement('li');
        $li.className = 'custom-item';
        $li.textContent = `Custom: ${data.name}`;
        return $li;
      });

      virtualScroll = new VirtualScroll($container, { itemHeight: 50, renderItem });
      virtualScroll.setItems(mockItems);
      await flushRAF();

      expect(renderItem).toHaveBeenCalled();
      const $customItem = $container.querySelector('.custom-item');
      expect($customItem).toBeTruthy();
    });

    it('calls onRender callback', async () => {
      virtualScroll.destroy();

      const onRender = vi.fn();
      virtualScroll = new VirtualScroll($container, { itemHeight: 50, onRender });
      virtualScroll.setItems(mockItems);
      await flushRAF();

      expect(onRender).toHaveBeenCalled();
    });

    it('applies positioning styles to rendered items', () => {
      const $items = Array.from($container.querySelectorAll('.vs-item'));
      $items.forEach($item => {
        expect($item.style.position).toBe('absolute');
        expect($item.style.height).toBe('50px');
      });
    });
  });

  describe('scrollToIndex', () => {
    beforeEach(async () => {
      virtualScroll = new VirtualScroll($container, { itemHeight: 50 });
      virtualScroll.setItems(mockItems);
      await flushRAF();
    });

    it('scrolls to index at start', () => {
      virtualScroll.scrollToIndex(20, 'start');

      const $viewport = virtualScroll.getViewport();
      expect($viewport.scrollTop).toBe(1000); // 20 * 50
    });

    it('scrolls to index at center', () => {
      virtualScroll.scrollToIndex(20, 'center');

      const $viewport = virtualScroll.getViewport();
      expect($viewport.scrollTop).toBeGreaterThan(0);
    });

    it('scrolls to index at end', () => {
      virtualScroll.scrollToIndex(20, 'end');

      const $viewport = virtualScroll.getViewport();
      expect($viewport.scrollTop).toBeGreaterThan(0);
    });

    it('defaults to start alignment', () => {
      virtualScroll.scrollToIndex(10);

      const $viewport = virtualScroll.getViewport();
      expect($viewport.scrollTop).toBe(500); // 10 * 50
    });

    it('does not scroll to negative position', () => {
      virtualScroll.scrollToIndex(0, 'center');

      const $viewport = virtualScroll.getViewport();
      expect($viewport.scrollTop).toBeGreaterThanOrEqual(0);
    });
  });

  describe('scrollToItem', () => {
    beforeEach(async () => {
      virtualScroll = new VirtualScroll($container, { itemHeight: 50 });
      virtualScroll.setItems(mockItems);
      await flushRAF();
    });

    it('scrolls to item by id', () => {
      const initialScroll = virtualScroll.getViewport().scrollTop;
      virtualScroll.scrollToItem('item-20');

      const $viewport = virtualScroll.getViewport();
      expect($viewport.scrollTop).not.toBe(initialScroll);
    });

    it('does nothing for non-existent id', () => {
      const initialScroll = virtualScroll.getViewport().scrollTop;
      virtualScroll.scrollToItem('nonexistent');

      expect(virtualScroll.getViewport().scrollTop).toBe(initialScroll);
    });
  });

  describe('addItem', () => {
    beforeEach(async () => {
      virtualScroll = new VirtualScroll($container, { itemHeight: 50 });
      virtualScroll.setItems(mockItems.slice(0, 10));
      await flushRAF();
    });

    it('adds item to list', () => {
      const newItem = { id: 'item-new', name: 'New Item' };
      virtualScroll.addItem(newItem);

      expect(virtualScroll.getItemCount()).toBe(11);
    });

    it('updates total height', async () => {
      const newItem = { id: 'item-new', name: 'New Item' };
      virtualScroll.addItem(newItem);
      await flushRAF();

      const $content = $container.querySelector('.vs-content');
      expect($content.style.height).toBe('550px'); // 11 * 50
    });
  });

  describe('removeItem', () => {
    beforeEach(async () => {
      virtualScroll = new VirtualScroll($container, { itemHeight: 50 });
      virtualScroll.setItems(mockItems.slice(0, 10));
      await flushRAF();
    });

    it('removes item by id', () => {
      virtualScroll.removeItem('item-5');
      expect(virtualScroll.getItemCount()).toBe(9);
    });

    it('updates total height after removal', async () => {
      virtualScroll.removeItem('item-5');
      await flushRAF();

      const $content = $container.querySelector('.vs-content');
      expect($content.style.height).toBe('450px'); // 9 * 50
    });

    it('does nothing for non-existent id', () => {
      virtualScroll.removeItem('nonexistent');
      expect(virtualScroll.getItemCount()).toBe(10);
    });
  });

  describe('getters', () => {
    beforeEach(async () => {
      virtualScroll = new VirtualScroll($container, { itemHeight: 50 });
      virtualScroll.setItems(mockItems);
      await flushRAF();
    });

    it('getViewport returns viewport element', () => {
      const $viewport = virtualScroll.getViewport();
      expect($viewport.classList.contains('vs-viewport')).toBe(true);
    });

    it('getItemsContainer returns items element', () => {
      const $items = virtualScroll.getItemsContainer();
      expect($items.classList.contains('vs-items')).toBe(true);
    });

    it('getItemCount returns items length', () => {
      expect(virtualScroll.getItemCount()).toBe(100);
    });
  });

  describe('destroy', () => {
    beforeEach(async () => {
      virtualScroll = new VirtualScroll($container, { itemHeight: 50 });
      virtualScroll.setItems(mockItems);
      await flushRAF();
    });

    it('clears rendered items', () => {
      virtualScroll.destroy();
      expect(virtualScroll.renderedItems.size).toBe(0);
    });

    it('clears container innerHTML', () => {
      virtualScroll.destroy();
      expect($container.innerHTML).toBe('');
    });

    it('removes event listeners', () => {
      virtualScroll.destroy();
      // Should not throw after destroy
      expect(() => window.dispatchEvent(new Event('resize'))).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('handles items with missing name property', async () => {
      virtualScroll = new VirtualScroll($container, { itemHeight: 50 });
      virtualScroll.setItems([{ id: 'item-1' }]);
      await flushRAF();

      const $item = $container.querySelector('.vs-item');
      expect($item.textContent).toBe('Item 0');
    });

    it('handles rapid setItems calls', async () => {
      virtualScroll = new VirtualScroll($container, { itemHeight: 50 });

      virtualScroll.setItems(mockItems.slice(0, 10));
      virtualScroll.setItems(mockItems.slice(0, 20));
      virtualScroll.setItems(mockItems.slice(0, 30));

      await flushRAF();

      expect(virtualScroll.getItemCount()).toBe(30);
    });

    it('handles custom renderItem returning null', async () => {
      const renderItem = () => null;

      virtualScroll = new VirtualScroll($container, { itemHeight: 50, renderItem });
      virtualScroll.setItems(mockItems.slice(0, 5));

      await flushRAF();

      // Should not crash, but no items rendered
      expect(virtualScroll.renderedItems.size).toBe(0);
    });

    it('handles empty options', async () => {
      virtualScroll = new VirtualScroll($container, {});
      virtualScroll.setItems(mockItems.slice(0, 5));
      await flushRAF();

      expect(virtualScroll.getItemCount()).toBe(5);
    });
  });
});
