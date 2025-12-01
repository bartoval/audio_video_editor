import Component from 'Component';

export default class Composite {
  constructor() {
    this.$node = null;
    this.children = [];
    this.counter = 0;
  }

  /** Initialize and clean children */
  init() {
    this.children.forEach(elem => {
      this.remove(elem.id);
    });
  }

  /** Resize all children */
  resize() {
    this.children.forEach(elem => {
      elem.init();
    });
  }

  /** Add child after id */
  add(obj, id) {
    if (id !== null) {
      let current = this.getChild(id),
        next = this.getChild(current.next);
      obj.previous = current.id;
      obj.next = current.next;
      current.next = obj.id;
      if (next !== null) {
        next.previous = obj.id;
      }
    }
    this.children.push(obj);
    this.counter++;
    // _redraw(this);
    return obj;
  }

  /** Remove child by id */
  remove(id) {
    let current = this.getChild(id),
      previous = this.getChild(current.previous),
      next = this.getChild(current.next);

    if (previous !== null) {
      previous.next = current.next;
      previous.setDuration(previous.getDuration() + current.getDuration());
    }
    if (next !== null) {
      next.previous = current.previous;
      if (previous === null) {
        next.setStart(current.getStart());
        next.setDuration(next.getDuration() + current.getDuration());
      }
    }
    this.children = this.children.filter((elem) => {
      return elem.id !== id;
    });
    this.$node.removeChild(current.$node);
    current = null;
  }

  /** Get number of children */
  getNumChildren() {
    return this.children.length;
  }

  /** Get first child */
  getFirstChild() {
    return this.children[0];
  }

  /** Get child by id */
  getChild(id) {
    let obj = null;
    if (id !== null) {
      obj = this.children.find((elem) => {
        return elem.id === id;
      });
    }
    return obj;
  }

  /** Render DOM */
  render($parent) {
    let props = [{class: 'zones'}];
    this.$node = Component.render($parent, 'div', props);
  }
}
