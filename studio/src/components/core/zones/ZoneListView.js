import { View } from '../../../lib';

/** DOM container for zones */
export default class ZoneListView extends View {
  #$container = null;
  #$group = null;
  #posX = 0;

  constructor($parent) {
    super($parent);
    this.mount();
  }

  template() {
    return '<div class="zone-container"></div>';
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.#$container = this.$node;
    this.$parent.appendChild(this.$node);
  }

  // ============================================================================
  // Group Management
  // ============================================================================

  /** Create zone group */
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

  /** Get group by id */
  getGroupById(id) {
    if (id === null) {
      return null;
    }

    return this.#$container.querySelector(`[id="${id}"]`);
  }

  // ============================================================================
  // DOM Operations
  // ============================================================================

  /** Update container width */
  setWidth(width) {
    this.#$container.style.width = `${width}px`;
  }

  /** Update container height based on groups */
  updateHeight() {
    const numGroups = this.#$container.childNodes.length;

    if (numGroups > 1) {
      const firstGroup = this.#$container.childNodes[0];
      const groupHeight = firstGroup.offsetHeight;
      const groupStyle = getComputedStyle(firstGroup);
      const marginBottom = parseFloat(groupStyle.marginBottom) || 0;
      const totalGroupHeight = groupHeight + marginBottom;

      this.#$container.style.height = `${(numGroups + 1) * totalGroupHeight}px`;
    }

    return numGroups;
  }

  /** Apply transform for scrolling */
  setTransform(posX) {
    const transform = `translate3d(${-posX}px, 0, 0)`;
    this.#$container.style.transform = transform;
    this.#$container.style.msTransform = transform;
    this.#posX = posX;
  }

  /** Get current position */
  getPosX() {
    return this.#posX;
  }

  /** Clear all children */
  clear() {
    while (this.#$container.firstChild) {
      this.#$container.removeChild(this.#$container.firstChild);
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

  // ============================================================================
  // Group Query Methods
  // ============================================================================

  /**
   * Get all group elements
   * @returns {Array<HTMLElement>}
   */
  getGroups() {
    return Array.from(this.#$container.querySelectorAll('.zones'));
  }

  /**
   * Get group element at Y position
   * @param {number} clientY - Mouse Y position
   * @returns {{group: HTMLElement|null, isNewRow: boolean, insertBefore: HTMLElement|null}}
   */
  getGroupAtY(clientY) {
    const groups = this.getGroups();

    // Check if above all groups - new row at top
    if (groups.length > 0) {
      const firstRect = groups[0].getBoundingClientRect();

      if (clientY < firstRect.top) {
        return { group: null, isNewRow: true, insertBefore: groups[0] };
      }
    }

    for (let i = 0; i < groups.length; i++) {
      const rect = groups[i].getBoundingClientRect();

      // Within group bounds
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return { group: groups[i], isNewRow: false, insertBefore: null };
      }

      // Between this group and next - new row
      if (i < groups.length - 1) {
        const nextRect = groups[i + 1].getBoundingClientRect();

        if (clientY > rect.bottom && clientY < nextRect.top) {
          return { group: null, isNewRow: true, insertBefore: groups[i + 1] };
        }
      }
    }

    // Below all groups - new row at bottom
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
      this.#$container.insertBefore($group, insertBefore);
    } else {
      this.#$container.appendChild($group);
    }

    this.#$group = $group;

    return $group;
  }
}
