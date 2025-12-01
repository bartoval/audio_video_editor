import Component from 'Component';

export default class Container {
  constructor() {
    this.$node = null;
    this.$compositeNode = null;
    this.children = [];
    this.posX = 0;
    this.ruler = null;
    this.numComposite = 0;
    this.selected = null;
    this.animation = false;
  }

  /** Initialize container and clean existing children */
  async init(ruler) {
    this.ruler = ruler;
    this._redraw();
    this.selected = null;

    const cleanPromises = this.children.map(elem => {
      if (typeof elem.clean === 'function') {
        return Promise.resolve(elem.clean());
      }

      return Promise.resolve();
    });

    await Promise.all(cleanPromises);

    const ids = this.children.map(elem => elem.id);
    ids.forEach(id => this.remove(id));

    return true;
  }

  /** Recalculate dimensions on zoom */
  zoom() {
    this._redraw();
    this.children.forEach(elem => elem.zoom());

    return this._moveTo(this.ruler.getPosX());
  }

  /** Set selected zone */
  setSelected(zone) {
    this.selected = zone;

    return true;
  }

  /** Get selected zone */
  getSelected() {
    return this.selected;
  }

  /** Add composite group container */
  addComposite(id = null) {
    id = id || this.getNewId();
    const props = [{ id: id, class: 'zones', 'data-zone-group': id }];
    this.$compositeNode = Component.render(this.$node, 'div', props);
    this._redraw();

    return this.$compositeNode;
  }

  /** Get composite by id */
  getComposite(id) {
    return id !== null && this.$node.querySelector('[id="' + id + '"]');
  }

  /** Add child to collection */
  add(obj, selectedId = null) {
    if (selectedId !== null) {
      const current = this.getChild(selectedId);
      const next = this.getChild(current.next);
      obj.previous = current.id;
      obj.next = current.next;
      current.next = obj.id;

      if (next !== null) {
        next.previous = obj.id;
      }
    }

    this.children.push(obj);

    return obj;
  }

  /** Remove selected zone */
  remove(id = null) {
    const targetId = id || this.getSelected()?.id;

    if (!targetId) {
      return false;
    }

    const current = this.getChild(targetId);
    const previousId = current.getPreviousId();
    const nextId = current.getNextId();
    const previous = this.getChild(previousId);
    const next = this.getChild(nextId);

    if (previous !== null) {
      previous.setNextId(nextId);
      previous.setDuration(previous.getDuration() + current.getDuration());
    }

    if (next !== null) {
      next.setPreviousId(previousId);

      if (previous === null) {
        next.setStart(current.getStart());
        next.setDuration(next.getDuration() + current.getDuration());
      }
    }

    this.children = this.children.filter(elem => elem.id !== targetId);

    const $root = document.getElementById(current.$node.getAttribute('data-zone-group'));
    $root.removeChild(current.$node);
    current.$node = null;
    current.$parent = null;

    if ($root.childNodes.length === 0) {
      $root.remove();
      this.$compositeNode = null;
    }

    if (id === null) {
      this.setSelected(null);
      this._redraw();
    }

    return true;
  }

  /** Get child by id */
  getChild(id) {
    if (id === null) {
      return null;
    }

    return this.children.find(elem => elem.id === id) || null;
  }

  /** Get child by index */
  getChildByIndex(index) {
    if (index === null || index < 0 || index >= this.children.length) {
      return null;
    }

    return this.children[index];
  }

  /** Get first child */
  getFirstChild() {
    return this.children[0];
  }

  /** Get children count */
  getNumChildren() {
    return this.children.length;
  }

  /** Get all children */
  getAllChildren() {
    return this.children;
  }

  /** Generate unique id */
  getNewId() {
    let d = new Date().getTime();

    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      d += performance.now();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (d + Math.random() * 16) % 16 | 0;
      d = Math.floor(d / 16);

      return c === 'x' ? r.toString(16) : ((r & 0x3) | 0x8).toString(16);
    });
  }

  /** Move container to position */
  moveTo(posX) {
    return this._moveTo(posX);
  }

  /** Update frame position */
  updateFrame(posX) {
    this.animation = false;

    return this._moveTo(posX);
  }

  /** Render container element */
  render($parent) {
    const props = [{ class: 'zone-container' }];
    this.$node = Component.render($parent, 'div', props);
  }

  /** Redraw container dimensions */
  _redraw() {
    const width = this.ruler.getMaxWidth();
    this.$node.style.width = width + 'px';

    this.numComposite = this.$node.childNodes.length;

    if (this.numComposite > 1) {
      this.$node.style.height = (this.numComposite + 1) * this.$node.childNodes[0].offsetHeight + 'px';
    }

    return true;
  }

  /** Apply transform to container */
  _moveTo(posX) {
    const t = 'translate3d(' + -posX + 'px, 0, 0)';
    this.$node.style.transform = t;
    this.$node.style.msTransform = t;
    this.posX = posX;

    return true;
  }
}
