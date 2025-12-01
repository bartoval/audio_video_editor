import { View } from '../../../lib';

/** DOM container for zones */
export default class ZoneListView extends View {
  #$container = null;
  #$wrapper = null;
  #$group = null;
  #posX = 0;

  constructor($parent) {
    super($parent);
    this.mount();
  }

  template() {
    return '<div class="zone-container"><div class="zones-wrapper"></div><div class="zone-spacer"></div></div>';
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.#$container = this.$node;
    this.#$wrapper = this.$node.querySelector('.zones-wrapper');
    this.$parent.appendChild(this.$node);
  }

  /** Create zone group */
  createGroup(id) {
    this.#$group = document.createElement('div');
    this.#$group.id = id;
    this.#$group.className = 'zones';
    this.#$group.setAttribute('data-zone-group', id);

    this.#$wrapper.appendChild(this.#$group);

    return this.#$group;
  }

  /** Get current group element */
  getGroup() {
    return this.#$group;
  }

  /** Get group by id */
  getGroupById(id) {
    if (id === null) {
      return null;
    }

    return this.#$container.querySelector(`[id="${id}"]`);
  }

  /** Update container width */
  setWidth(width) {
    this.#$container.style.width = `${width}px`;
  }

  /** Update container height based on groups */
  updateHeight() {
    const groups = this.getGroups();

    this.#$container.style.removeProperty('height');
    this.#$container.style.removeProperty('overflow');

    return groups.length;
  }

  /** Apply transform for scrolling */
  setTransform(posX) {
    this.#$wrapper.style.transform = `translate3d(${-posX}px, 0, 0)`;
    this.#posX = posX;
  }

  /** Get current position */
  getPosX() {
    return this.#posX;
  }

  /** Clear all children */
  clear() {
    while (this.#$wrapper.firstChild) {
      this.#$wrapper.removeChild(this.#$wrapper.firstChild);
    }

    this.#$group = null;
  }

  /** Remove zone element from DOM */
  removeZone($root) {
    const $group = $root?.parentNode;

    if ($group) {
      $group.removeChild($root);

      if ($group.childNodes.length === 0) {
        $group.remove();
        this.#$group = null;
      }
    }
  }

  /**
   * Get all group elements
   * @returns {Array<HTMLElement>}
   */
  getGroups() {
    return Array.from(this.#$wrapper.querySelectorAll('.zones'));
  }

  /**
   * Get group element at Y position
   * @param {number} clientY - Mouse Y position
   * @returns {{group: HTMLElement|null, isNewRow: boolean, insertBefore: HTMLElement|null}}
   */
  getGroupAtY(clientY) {
    const groups = this.getGroups();

    if (groups.length > 0) {
      const firstRect = groups[0].getBoundingClientRect();

      if (clientY < firstRect.top) {
        return { group: null, isNewRow: true, insertBefore: groups[0] };
      }
    }

    for (let i = 0; i < groups.length; i++) {
      const rect = groups[i].getBoundingClientRect();

      if (clientY >= rect.top && clientY <= rect.bottom) {
        return { group: groups[i], isNewRow: false, insertBefore: null };
      }

      if (i < groups.length - 1) {
        const nextRect = groups[i + 1].getBoundingClientRect();

        if (clientY > rect.bottom && clientY < nextRect.top) {
          return { group: null, isNewRow: true, insertBefore: groups[i + 1] };
        }
      }
    }

    return { group: null, isNewRow: true, insertBefore: null };
  }

  /**
   * Create new group at specific position
   * @param {string} id - Group ID
   * @param {HTMLElement|null} insertBefore - Insert before this element
   * @returns {HTMLElement}
   */
  createGroupAt(id, insertBefore = null) {
    const $group = document.createElement('div');
    $group.id = id;
    $group.className = 'zones';
    $group.setAttribute('data-zone-group', id);

    if (insertBefore) {
      this.#$wrapper.insertBefore($group, insertBefore);
    } else {
      this.#$wrapper.appendChild($group);
    }

    this.#$group = $group;

    return $group;
  }
}
