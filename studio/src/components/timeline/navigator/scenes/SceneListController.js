import { SCENE_COLORS } from '../../../../config/ui';
import { Signals, getTimeFromPosX, generateUuid } from '../../../../lib';
import { LinkedList } from '../../../../lib/collections';
import SceneListView from './SceneListView';
import Scene from './ScenePresenter';

/** Scene collection controller using composition */
export default class SceneListController {
  #sceneCounter = 0;

  constructor($parent) {
    this.items = new LinkedList();
    this.view = new SceneListView($parent);
    this.ruler = null;

    this.onMove = new Signals.Signal();
    this.onStart = new Signals.Signal();
    this.onStop = new Signals.Signal();
    this.onAdd = new Signals.Signal();
    this.onEdit = new Signals.Signal();
    this.onRemove = new Signals.Signal();
    this.onSetMenu = new Signals.Signal();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  async init(config, ruler) {
    this.ruler = ruler;
    this.#sceneCounter = 0;

    // Clean existing scenes
    const cleanPromises = this.items.map(scene =>
      typeof scene.clean === 'function' ? Promise.resolve(scene.clean()) : Promise.resolve()
    );
    await Promise.all(cleanPromises);

    // Destroy and clear
    this.items.forEach(scene => scene.destroy?.());
    this.items.clear();
    this.view.clear();

    // Add initial scenes
    if (config && config.length > 0) {
      let previousId = null;

      config.forEach(elem => {
        this.#sceneCounter++;
        const scene = this.add(elem, previousId);
        previousId = scene.getId();
      });
    } else {
      this.add({
        id: generateUuid(),
        label: this.#generateNextLabel(),
        color: this.#getNextColor(),
        durationTime: ruler.getDuration()
      });
    }

    this.#redraw();
    this.selectNoMove(this.items.first()?.getId());

    return true;
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  add(config, parentId = null) {
    if (!this.view.getGroup()) {
      this.view.createGroup(generateUuid());
    }

    const $group = this.view.getGroup();
    const fullConfig = { ...config, groupId: $group.getAttribute('data-zone-group') };

    parentId = this.items.count() === 0 ? null : parentId;
    const scene = this.items.add(new Scene(fullConfig, $group), parentId);

    this.onAdd.dispatch({
      id: config.id,
      label: scene.getLabel(),
      color: scene.getColor(),
      startTime: scene.getStart(),
      endTime: scene.getEnd(),
      previousId: scene.getPreviousId()
    });

    return scene;
  }

  remove() {
    if (this.items.count() <= 1) {
      return false;
    }

    const current = this.items.getSelected();

    if (!current) {
      return false;
    }

    const { id, previousId, nextId, removedDuration } = this.#extractRemoveContext(current);
    const previous = this.items.get(previousId);
    const next = this.items.get(nextId);

    // Redistribute duration to adjacent scene
    if (previous !== null) {
      previous.setDuration(previous.getDuration() + removedDuration);
    } else if (next !== null) {
      next.setStart(current.getStart());
      next.setDuration(next.getDuration() + removedDuration);
    }

    // Remove from DOM and collection
    this.view.removeScene(current.getRoot());
    current.destroy?.();
    this.items.remove(id);

    const adjacentId = previousId !== null ? previousId : nextId;
    this.select(adjacentId);
    this.#redraw();
    this.onRemove.dispatch({ id, adjacentId });

    return true;
  }

  edit(scene, config) {
    scene.edit(config);
    this.onEdit.dispatch({
      id: scene.getId(),
      label: scene.getLabel(),
      color: scene.getColor(),
      startTime: scene.getStart(),
      endTime: scene.getEnd(),
      previousId: scene.getPreviousId()
    });
  }

  // ============================================================================
  // Selection
  // ============================================================================

  selectNoMove(id) {
    this.#deselectCurrent();
    const current = this.items.get(id);

    if (current !== null) {
      this.items.select(current);
      current.select();
      this.onSetMenu.dispatch(this, current);
    }

    return current;
  }

  select(id) {
    this.#deselectCurrent();
    const current = this.items.get(id);

    if (current !== null) {
      this.items.select(current);
      current.select();
      this.onSetMenu.dispatch(this, current);
      this.onMove.dispatch({
        start: current.getStart(),
        end: current.getEnd(),
        startPosX: current.getStartPosX(),
        endPosX: current.getEndPosX()
      });
    }

    return current;
  }

  getSelected() {
    return this.items.getSelected();
  }

  #deselectCurrent() {
    const previous = this.items.getSelected();

    if (previous !== null) {
      previous.deselect();
    }
  }

  // ============================================================================
  // Navigation
  // ============================================================================

  forward() {
    const current = this.items.getSelected();

    if (current?.getNextId()) {
      this.select(current.getNextId());
    }
  }

  back() {
    const current = this.items.getSelected();

    if (current?.getPreviousId()) {
      this.select(current.getPreviousId());
    }
  }

  // ============================================================================
  // Scene Operations
  // ============================================================================

  addNew() {
    const time = getTimeFromPosX(this.ruler.getAbsolutePosX());
    const current = this.#findSceneAtTime(time);

    if (!current) {
      return;
    }

    const sliceFirst = time - current.getStart();

    if (sliceFirst <= 0) {
      return;
    }

    const newConfig = {
      id: generateUuid(),
      label: this.#generateNextLabel(),
      color: this.#getNextColor(),
      startTime: time,
      durationTime: current.getDuration() - sliceFirst
    };

    current.setDuration(sliceFirst);
    const newScene = this.add(newConfig, current.getId());
    this.select(newScene.getId());
  }

  copy(current) {
    const selectedId = current.getId();

    if (!selectedId) {
      return;
    }

    const halfDuration = current.getDuration() / 2;
    const newConfig = {
      id: generateUuid(),
      label: this.#generateNextLabel(),
      color: this.#getNextColor(),
      startTime: current.getStart() + halfDuration,
      durationTime: halfDuration
    };

    current.setDuration(halfDuration);
    const newScene = this.add(newConfig, selectedId);
    this.select(newScene.getId());
  }

  cut(current) {
    const time = getTimeFromPosX(this.ruler.getAbsolutePosX());
    const sliceFirst = time - current.getStart();

    if (sliceFirst <= 0) {
      return;
    }

    const newConfig = {
      id: generateUuid(),
      label: this.#generateNextLabel(),
      color: this.#getNextColor(),
      startTime: time,
      durationTime: current.getDuration() - sliceFirst
    };

    current.setDuration(sliceFirst);
    const newScene = this.add(newConfig, current.getId());
    this.select(newScene.getId());
  }

  // ============================================================================
  // View Updates
  // ============================================================================

  zoom() {
    this.#redraw();
    this.items.forEach(scene => scene.zoom());

    return this.moveTo(this.ruler.getPosX());
  }

  moveTo(posX) {
    this.view.setTransform(posX);

    return true;
  }

  updateFrame(posX) {
    if (posX <= 0) {
      return false;
    }

    this.view.setTransform(posX);

    return true;
  }

  // ============================================================================
  // Export
  // ============================================================================

  export() {
    return this.items.map(scene => ({
      id: scene.getId(),
      label: scene.getLabel(),
      color: scene.getColor(),
      startTime: scene.getStart(),
      durationTime: scene.getDuration(),
      endTime: scene.getEnd(),
      previousId: scene.getPreviousId(),
      nextId: scene.getNextId()
    }));
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  #redraw() {
    const width = this.ruler.getMaxWidth();
    this.view.setWidth(width);
  }

  #getNextColor() {
    return SCENE_COLORS[(this.#sceneCounter - 1) % SCENE_COLORS.length];
  }

  #generateNextLabel() {
    this.#sceneCounter++;

    return `Scene ${this.#sceneCounter}`;
  }

  #findSceneAtTime(time) {
    const allScenes = this.items.all();

    return (
      allScenes.find(scene => time >= scene.getStart() && time < scene.getEnd()) ||
      allScenes.slice(-1)[0] ||
      null
    );
  }

  #extractRemoveContext(scene) {
    return {
      id: scene.getId(),
      previousId: scene.getPreviousId(),
      nextId: scene.getNextId(),
      removedDuration: scene.getDuration()
    };
  }
}
