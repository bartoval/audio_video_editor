import { describe, it, expect, beforeEach } from 'vitest';
import LinkedList from '../LinkedList.js';

// Mock item class that implements required interface
class MockItem {
  constructor(id) {
    this.id = id;
    this.prevId = null;
    this.nextId = null;
  }

  getId() {
    return this.id;
  }
  getPreviousId() {
    return this.prevId;
  }
  setPreviousId(id) {
    this.prevId = id;
  }
  getNextId() {
    return this.nextId;
  }
  setNextId(id) {
    this.nextId = id;
  }
}

describe('LinkedList', () => {
  let list;

  beforeEach(() => {
    list = new LinkedList();
  });

  // ============================================================================
  // Constructor
  // ============================================================================

  describe('constructor', () => {
    it('initializes with empty items array', () => {
      expect(list.all()).toEqual([]);
      expect(list.count()).toBe(0);
    });

    it('initializes with null selected', () => {
      expect(list.getSelected()).toBeNull();
    });
  });

  // ============================================================================
  // add
  // ============================================================================

  describe('add', () => {
    it('adds item to empty list', () => {
      const item = new MockItem('a');
      list.add(item);

      expect(list.count()).toBe(1);
      expect(list.get('a')).toBe(item);
    });

    it('adds item at end when parentId is null', () => {
      const item1 = new MockItem('a');
      const item2 = new MockItem('b');

      list.add(item1);
      list.add(item2);

      expect(list.count()).toBe(2);
      expect(list.all()).toEqual([item1, item2]);
    });

    it('adds item after parent and updates links', () => {
      const item1 = new MockItem('a');
      const item2 = new MockItem('b');
      const item3 = new MockItem('c');

      list.add(item1);
      item1.setNextId('b');
      list.add(item2);
      item2.setPreviousId('a');

      // Insert 'c' after 'a'
      list.add(item3, 'a');

      expect(item3.getPreviousId()).toBe('a');
      expect(item3.getNextId()).toBe('b');
      expect(item1.getNextId()).toBe('c');
      expect(item2.getPreviousId()).toBe('c');
    });

    it('handles insert at end of chain', () => {
      const item1 = new MockItem('a');
      const item2 = new MockItem('b');

      list.add(item1);
      list.add(item2, 'a');

      expect(item2.getPreviousId()).toBe('a');
      expect(item2.getNextId()).toBeNull();
      expect(item1.getNextId()).toBe('b');
    });

    it('returns added item', () => {
      const item = new MockItem('a');
      const result = list.add(item);

      expect(result).toBe(item);
    });
  });

  // ============================================================================
  // remove
  // ============================================================================

  describe('remove', () => {
    it('removes item and returns it', () => {
      const item = new MockItem('a');
      list.add(item);

      const removed = list.remove('a');

      expect(removed).toBe(item);
      expect(list.count()).toBe(0);
    });

    it('returns null for non-existent item', () => {
      const result = list.remove('nonexistent');

      expect(result).toBeNull();
    });

    it('updates links when removing middle item', () => {
      const item1 = new MockItem('a');
      const item2 = new MockItem('b');
      const item3 = new MockItem('c');

      list.add(item1);
      list.add(item2);
      list.add(item3);

      item1.setNextId('b');
      item2.setPreviousId('a');
      item2.setNextId('c');
      item3.setPreviousId('b');

      list.remove('b');

      expect(item1.getNextId()).toBe('c');
      expect(item3.getPreviousId()).toBe('a');
    });

    it('clears selection if removed item was selected', () => {
      const item = new MockItem('a');
      list.add(item);
      list.select(item);

      list.remove('a');

      expect(list.getSelected()).toBeNull();
    });

    it('keeps selection if different item was removed', () => {
      const item1 = new MockItem('a');
      const item2 = new MockItem('b');
      list.add(item1);
      list.add(item2);
      list.select(item1);

      list.remove('b');

      expect(list.getSelected()).toBe(item1);
    });
  });

  // ============================================================================
  // get
  // ============================================================================

  describe('get', () => {
    it('returns item by id', () => {
      const item = new MockItem('test-id');
      list.add(item);

      expect(list.get('test-id')).toBe(item);
    });

    it('returns null for non-existent id', () => {
      expect(list.get('nonexistent')).toBeNull();
    });

    it('returns null for null id', () => {
      expect(list.get(null)).toBeNull();
    });

    it('returns null for undefined id', () => {
      expect(list.get(undefined)).toBeNull();
    });

    it('handles numeric id comparison', () => {
      const item = new MockItem(123);
      list.add(item);

      expect(list.get(123)).toBe(item);
      expect(list.get('123')).toBe(item);
    });
  });

  // ============================================================================
  // getByIndex
  // ============================================================================

  describe('getByIndex', () => {
    beforeEach(() => {
      list.add(new MockItem('a'));
      list.add(new MockItem('b'));
      list.add(new MockItem('c'));
    });

    it('returns item at valid index', () => {
      expect(list.getByIndex(0).getId()).toBe('a');
      expect(list.getByIndex(1).getId()).toBe('b');
      expect(list.getByIndex(2).getId()).toBe('c');
    });

    it('returns null for negative index', () => {
      expect(list.getByIndex(-1)).toBeNull();
    });

    it('returns null for out of bounds index', () => {
      expect(list.getByIndex(3)).toBeNull();
      expect(list.getByIndex(100)).toBeNull();
    });
  });

  // ============================================================================
  // first
  // ============================================================================

  describe('first', () => {
    it('returns first item', () => {
      const item1 = new MockItem('a');
      const item2 = new MockItem('b');
      list.add(item1);
      list.add(item2);

      expect(list.first()).toBe(item1);
    });

    it('returns null for empty list', () => {
      expect(list.first()).toBeNull();
    });
  });

  // ============================================================================
  // all / count
  // ============================================================================

  describe('all', () => {
    it('returns all items', () => {
      const item1 = new MockItem('a');
      const item2 = new MockItem('b');
      list.add(item1);
      list.add(item2);

      expect(list.all()).toEqual([item1, item2]);
    });

    it('returns empty array for empty list', () => {
      expect(list.all()).toEqual([]);
    });
  });

  describe('count', () => {
    it('returns correct count', () => {
      expect(list.count()).toBe(0);

      list.add(new MockItem('a'));
      expect(list.count()).toBe(1);

      list.add(new MockItem('b'));
      expect(list.count()).toBe(2);

      list.remove('a');
      expect(list.count()).toBe(1);
    });
  });

  // ============================================================================
  // clear
  // ============================================================================

  describe('clear', () => {
    it('removes all items', () => {
      list.add(new MockItem('a'));
      list.add(new MockItem('b'));

      list.clear();

      expect(list.count()).toBe(0);
      expect(list.all()).toEqual([]);
    });

    it('clears selection', () => {
      const item = new MockItem('a');
      list.add(item);
      list.select(item);

      list.clear();

      expect(list.getSelected()).toBeNull();
    });
  });

  // ============================================================================
  // Selection
  // ============================================================================

  describe('selection', () => {
    it('selects item', () => {
      const item = new MockItem('a');
      list.add(item);

      list.select(item);

      expect(list.getSelected()).toBe(item);
    });

    it('returns true when selecting', () => {
      const item = new MockItem('a');
      list.add(item);

      expect(list.select(item)).toBe(true);
    });

    it('replaces previous selection', () => {
      const item1 = new MockItem('a');
      const item2 = new MockItem('b');
      list.add(item1);
      list.add(item2);

      list.select(item1);
      list.select(item2);

      expect(list.getSelected()).toBe(item2);
    });
  });

  // ============================================================================
  // Iteration methods
  // ============================================================================

  describe('forEach', () => {
    it('iterates over all items', () => {
      list.add(new MockItem('a'));
      list.add(new MockItem('b'));
      list.add(new MockItem('c'));

      const ids = [];
      list.forEach(item => ids.push(item.getId()));

      expect(ids).toEqual(['a', 'b', 'c']);
    });

    it('handles empty list', () => {
      const callback = vi.fn();
      list.forEach(callback);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('map', () => {
    it('maps items to new array', () => {
      list.add(new MockItem('a'));
      list.add(new MockItem('b'));

      const result = list.map(item => item.getId().toUpperCase());

      expect(result).toEqual(['A', 'B']);
    });

    it('returns empty array for empty list', () => {
      expect(list.map(item => item)).toEqual([]);
    });
  });

  describe('find', () => {
    beforeEach(() => {
      list.add(new MockItem('a'));
      list.add(new MockItem('b'));
      list.add(new MockItem('c'));
    });

    it('finds item matching predicate', () => {
      const found = list.find(item => item.getId() === 'b');

      expect(found.getId()).toBe('b');
    });

    it('returns null when no match', () => {
      const found = list.find(item => item.getId() === 'z');

      expect(found).toBeNull();
    });
  });
});

// Import vi for forEach test
import { vi } from 'vitest';
