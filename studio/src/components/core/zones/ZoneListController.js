import { LinkedList } from '../../../lib/collections';
import { generateUuid } from '../../../lib';
import ZoneListView from './ZoneListView';

/** Zone list controller managing child zones */
export default class ZoneListController {
  #ruler = null;
  #selected = null;

  constructor($parent) {
    this.items = new LinkedList();
    this.view = new ZoneListView($parent);
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /** Initialize controller and clean existing children */
  async init(ruler) {
    this.#ruler = ruler;
    this.#selected = null;

    const cleanPromises = this.items.map(elem =>
      typeof elem.clean === 'function' ? Promise.resolve(elem.clean()) : Promise.resolve()
    );

    await Promise.all(cleanPromises);

    // Destroy and clear
    this.items.forEach(elem => elem.destroy?.());
    this.items.clear();
    this.view.clear();

    this.#redraw();

    return true;
  }

  // ============================================================================
  // Group Management
  // ============================================================================

  /** Add composite group container */
  addComposite(id = null) {
    const groupId = id || generateUuid();

    return this.view.createGroup(groupId);
  }

  getComposite(id) {
    return this.view.getGroupById(id);
  }

  // ============================================================================
  // Children Management
  // ============================================================================

  /** Add child to collection */
  add(obj, parentId = null) {
    return this.items.add(obj, parentId);
  }

  /** Remove zone by id */
  remove(id = null) {
    const targetId = id || this.#selected?.getId();

    if (!targetId) {
      return false;
    }

    const current = this.items.get(targetId);

    if (!current) {
      return false;
    }

    // Remove from DOM
    this.view.removeZone(current.getRoot());
    current.destroy?.();

    // Remove from collection
    this.items.remove(targetId);

    // Clear selection if removed zone was selected
    if (this.#selected?.getId() === targetId) {
      this.#selected = null;
    }

    this.#redraw();

    return true;
  }

  getChild(id) {
    return this.items.get(id);
  }

  getChildByIndex(index) {
    if (index === null || index < 0 || index >= this.items.count()) {
      return null;
    }

    return this.items.all()[index];
  }

  getFirstChild() {
    return this.items.first();
  }

  getNumChildren() {
    return this.items.count();
  }

  getAllChildren() {
    return this.items.all();
  }

  // ============================================================================
  // Selection
  // ============================================================================

  setSelected(zone) {
    this.#selected = zone;

    return true;
  }

  getSelected() {
    return this.#selected;
  }

  // ============================================================================
  // View Updates
  // ============================================================================

  /** Recalculate dimensions on zoom */
  zoom() {
    this.#redraw();
    this.items.forEach(elem => elem.zoom());

    return this.moveTo(this.#ruler.getPosX());
  }

  moveTo(posX) {
    this.view.setTransform(posX);
    this.#updateStickyLabels(posX);

    return true;
  }

  updateFrame(posX) {
    this.view.setTransform(posX);
    this.#updateStickyLabels(posX);

    return true;
  }

  #updateStickyLabels(posX) {
    this.items.forEach(elem => {
      elem.view?.updateStickyLabel?.(posX);
    });
  }

  // ============================================================================
  // Row/Group Management
  // ============================================================================

  /**
   * Move a zone to a different group (row)
   * @param {string} zoneId - Zone to move
   * @param {HTMLElement} $targetGroup - Target group element
   * @returns {boolean} Success
   */
  moveToGroup(zoneId, $targetGroup) {
    const zone = this.items.get(zoneId);

    if (!zone || !$targetGroup) {
      return false;
    }

    const $root = zone.getRoot();
    const $currentGroup = $root.parentNode;

    if ($currentGroup === $targetGroup) {
      return false;
    }

    // Move DOM element to new group
    $targetGroup.appendChild($root);

    // Update zone's groupId
    const newGroupId = $targetGroup.getAttribute('data-zone-group');
    zone.set('groupId', newGroupId);
    $root.setAttribute('data-zone-group', newGroupId);

    // Clean up empty group
    if ($currentGroup && $currentGroup.childNodes.length === 0) {
      $currentGroup.remove();
    }

    this.#redraw();

    return true;
  }

  /**
   * Get all group elements
   * @returns {Array<HTMLElement>}
   */
  getGroups() {
    return this.view.getGroups();
  }

  /**
   * Get group element at Y position
   * @param {number} clientY - Mouse Y position
   * @returns {HTMLElement|null}
   */
  getGroupAtY(clientY) {
    return this.view.getGroupAtY(clientY);
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /** Generate UUID */
  getNewId() {
    return generateUuid();
  }

  /** Get ruler reference */
  getRuler() {
    return this.#ruler;
  }

  /** Get current posX */
  getPosX() {
    return this.view.getPosX();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  #redraw() {
    if (!this.#ruler) {
      return;
    }

    const width = this.#ruler.getMaxWidth();
    this.view.setWidth(width);
    this.view.updateHeight();
  }
}
