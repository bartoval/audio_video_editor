/**
 * Generic doubly linked list for managing ordered items with prev/next pointers.
 * Items must implement: getId(), getPreviousId(), setPreviousId(), getNextId(), setNextId()
 */
export default class LinkedList {
  constructor() {
    this.items = [];
    this.selected = null;
  }

  /** Add item after parentId, or at end if null */
  add(item, parentId = null) {
    if (parentId !== null) {
      const parent = this.get(parentId);
      const next = this.get(parent.getNextId());

      item.setPreviousId(parent.getId());
      item.setNextId(parent.getNextId());
      parent.setNextId(item.getId());

      if (next !== null) {
        next.setPreviousId(item.getId());
      }
    }

    this.items.push(item);

    return item;
  }

  /** Remove item by id, returns removed item or null */
  remove(id) {
    const item = this.get(id);

    if (!item) {
      return null;
    }

    const previousId = item.getPreviousId();
    const nextId = item.getNextId();
    const previous = this.get(previousId);
    const next = this.get(nextId);

    if (previous !== null) {
      previous.setNextId(nextId);
    }

    if (next !== null) {
      next.setPreviousId(previousId);
    }

    this.items = this.items.filter(i => i.getId() !== id);

    if (this.selected?.getId() === id) {
      this.selected = null;
    }

    return item;
  }

  /** Get item by id */
  get(id) {
    if (id === null || id === undefined) {
      return null;
    }

    const idStr = String(id);

    return this.items.find(item => String(item.getId()) === idStr) || null;
  }

  /** Get item by index */
  getByIndex(index) {
    if (index < 0 || index >= this.items.length) {
      return null;
    }

    return this.items[index];
  }

  /** Get first item */
  first() {
    return this.items[0] || null;
  }

  /** Get all items */
  all() {
    return this.items;
  }

  /** Get count */
  count() {
    return this.items.length;
  }

  /** Clear all items */
  clear() {
    this.items = [];
    this.selected = null;
  }

  /** Selection management */
  select(item) {
    this.selected = item;

    return true;
  }

  getSelected() {
    return this.selected;
  }

  /** Iterate with callback */
  forEach(callback) {
    this.items.forEach(callback);
  }

  /** Map items */
  map(callback) {
    return this.items.map(callback);
  }

  /** Find item */
  find(predicate) {
    return this.items.find(predicate) || null;
  }
}
