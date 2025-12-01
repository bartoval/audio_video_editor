import { View } from '../../../../lib';

/** DOM container for scenes */
export default class SceneListView extends View {
  #$container = null;
  #$group = null;

  constructor($parent) {
    super($parent);
    this.mount();
  }

  template() {
    return `
      <div class="scenes">
        <div class="zone-container"></div>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);
    this.#$container = this.$node.querySelector('.zone-container');
  }

  /** Create zone group for scenes */
  createGroup(id) {
    this.#$group = document.createElement('div');
    this.#$group.id = id;
    this.#$group.className = 'zones';
    this.#$group.setAttribute('data-zone-group', id);
    this.#$container.appendChild(this.#$group);

    return this.#$group;
  }

  /** Get current group element */
  getGroup() {
    return this.#$group;
  }

  /** Update container width */
  setWidth(width) {
    this.#$container.style.width = `${width}px`;
  }

  /** Apply transform for scrolling */
  setTransform(posX) {
    const t = `translate3d(${-posX}px, 0, 0)`;
    this.#$container.style.transform = t;
  }

  /** Clear all children */
  clear() {
    while (this.#$container.firstChild) {
      this.#$container.removeChild(this.#$container.firstChild);
    }

    this.#$group = null;
  }

  /** Remove scene element from DOM */
  removeScene($root) {
    const $group = $root?.parentNode;

    if ($group) {
      $group.removeChild($root);

      if ($group.childNodes.length === 0) {
        $group.remove();
        this.#$group = null;
      }
    }
  }
}
