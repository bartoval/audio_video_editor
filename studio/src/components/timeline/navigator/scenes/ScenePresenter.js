import { Presenter } from '../../../../lib/ui/mvp';
import SceneModel from './SceneModel';
import SceneView from './SceneView';

export default class ScenePresenter extends Presenter {
  #commands = { add: false, cut: false, remove: false, play: false, stop: false };

  constructor(config, $parent) {
    const fullConfig = { ...config, groupId: $parent.getAttribute('data-zone-group') };
    const model = new SceneModel(fullConfig);
    const view = new SceneView($parent, fullConfig);

    super(model, view);
  }

  init() {}

  /** Zone position/time */
  getId() {
    return this.get('id');
  }
  getPreviousId() {
    return this.get('previous');
  }
  getNextId() {
    return this.get('next');
  }
  setNextId(id) {
    this.set('next', id || null);
  }
  setPreviousId(id) {
    this.set('previous', id || null);
  }
  getStart() {
    return this.get('startTime');
  }
  getDuration() {
    return this.get('durationTime');
  }
  getEnd() {
    return this.model.getEnd();
  }
  setStart(sec) {
    return this.model.setStartTime(sec);
  }
  setDuration(sec) {
    return this.model.setDurationTime(sec);
  }
  getStartPosX() {
    return this.model.getStartPosX();
  }
  getEndPosX() {
    return this.model.getEndPosX();
  }
  getWidth() {
    return this.model.getDurationPosX();
  }

  /** Drag operations */
  dragStart(type, posX = 0) {
    this.model.startDrag(type, posX);

    return true;
  }

  dragStop() {
    this.model.stopDrag();

    return true;
  }

  /** Zoom refresh */
  zoom() {
    this.refresh();
  }

  /** State query */
  getIsTransforming() {
    return this.get('isTransforming');
  }

  /** DOM access */
  getRoot() {
    return this.view.getRoot();
  }
  getGroupElement() {
    return this.view.getRoot()?.parentNode || null;
  }

  /** Selection */
  select() {
    this.view.select();

    return true;
  }

  deselect() {
    this.view.deselect();

    return true;
  }

  /** Scene properties */
  getLabel() {
    return this.get('label');
  }
  setLabel(label) {
    this.set('label', label);
    return true;
  }
  getDescription() {
    return this.get('description');
  }
  setDescription(description) {
    this.set('description', description);
    return true;
  }
  getColor() {
    return this.get('color');
  }
  setColor(color) {
    this.set('color', color);
    return true;
  }
  getCommands() {
    return this.#commands;
  }

  /** Edit multiple properties */
  edit({ color, label, description }) {
    this.model.batch(() => {
      if (color !== undefined) {
        this.setColor(color);
      }
      if (label !== undefined) {
        this.setLabel(label);
      }
      if (description !== undefined) {
        this.setDescription(description);
      }
    });

    return true;
  }

  /** Resize with adjacent scene */
  drag(time, nextScene) {
    if (!this.getIsTransforming()) {
      return false;
    }

    if (time > nextScene.getEnd() - 0.5 || time < this.getStart() + 0.5) {
      return false;
    }

    const newDuration = time - this.getStart();
    const nextNewDuration =
      nextScene.getDuration() + (nextScene.getStart() - (this.getStart() + newDuration));

    this.setDuration(newDuration);
    nextScene.setDuration(nextNewDuration);
    nextScene.setStart(this.getEnd());

    return true;
  }

  /** Cleanup */
  clean() {
    return Promise.resolve(true);
  }
  destroy() {
    this.dispose();
  }
}
