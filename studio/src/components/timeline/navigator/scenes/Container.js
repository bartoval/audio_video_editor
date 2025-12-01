import Component from 'Component';
import Signals from 'signals';
import Container from 'Zones/Container';
import Config from 'Config';
import Scene from './Scene';

const { sceneColors } = Config.getUI();

export default class ContainerScenes extends Container {
  constructor($parent) {
    super();
    this.sceneCounter = 0;
    this.render($parent);
    super.render($parent.querySelector('.scenes'));
    this.onMove = new Signals.Signal();
    this.onStart = new Signals.Signal();
    this.onStop = new Signals.Signal();
    this.onAdd = new Signals.Signal();
    this.onEdit = new Signals.Signal();
    this.onRemove = new Signals.Signal();
    this.onSetMenu = new Signals.Signal();
  }

  _getNextColor() {
    return sceneColors[this.sceneCounter % sceneColors.length];
  }

  _getNextLabel() {
    this.sceneCounter++;

    return `Scene ${this.sceneCounter}`;
  }

  /** *************************************************************************************
   *
   *                                        Public methods
   *
   ***************************************************************************************/
  /**
   * Initialize scenes container, cleaning existing scenes first.
   * @param config
   * @param ruler
   * @returns {Promise<boolean>}
   */
  async init(config, ruler) {
    await super.init(ruler);
    this.$compositeNode = null;
    this.sceneCounter = 0;

    if (config && config.length > 0) {
      config.forEach(elem => {
        this.sceneCounter++;
        this.add(elem);
      });
    } else {
      this.add({
        id: this.getNewId(),
        label: this._getNextLabel(),
        color: this._getNextColor(),
        durationTime: ruler.getDuration()
      });
    }

    this.selectNoMove(this.getAllChildren()[0]?.getId());

    return true;
  }

  /**
   *
   * @param config
   * @param parentId
   */
  add(config, parentId = null) {
    if (!this.$compositeNode) {
      this.addComposite();
    }

    parentId = this.children.length === 0 ? null : parentId;
    const scene = super.add(new Scene(config, this.$compositeNode), parentId);
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

  /**
   *
   * @param id
   * @returns {Object}
   */
  selectNoMove(id) {
    let currentZone = this.setSelected(this.getChild(id)) && this.getSelected();
    currentZone !== null && this.onSetMenu.dispatch(this, currentZone); // this.controller.show() && this.controller.init(currentZone) &&  // if currentZone exists, show controller
    currentZone !== null && currentZone.select();
    return currentZone;
  }

  /**
   *
   * @param id
   * @returns {Object}
   */
  select(id) {
    let currentZone = this.setSelected(this.getChild(id)) && this.getSelected();
    currentZone !== null && currentZone.select() && this.onSetMenu.dispatch(this, currentZone); // this.controller.show() && this.controller.init(currentZone) &&  // if currentZone exists, show controller
    currentZone !== null && currentZone.select();
    currentZone !== null && this.onMove.dispatch({
      start: currentZone.getStart(),
      end: currentZone.getEnd(),
      startPosX: currentZone.getStartPosX(),
      endPosX: currentZone.getEndPosX()
    });
    return currentZone;
  }

  play() {
    this.onStart.dispatch(true);
  }

  stop() {
    this.onStop.dispatch(true);
  }

  forward() {
    let currentZone = this.getSelected();
    currentZone.getNextId() && this.select(currentZone.getNextId()); // currentZone.id === id
  }

  back() {
    let currentZone = this.getSelected();
    currentZone.previous && this.select(currentZone.previous); // currentZone.id === id
  }

  /**
   *  Creates a new scene from the previous scene
   * @param currentZone
   * @param config
   */
  copy(currentZone, config) {
    const selectedId = currentZone.getId();

    if (selectedId) {
      config.id = this.getNewId();
      config.label = this._getNextLabel();
      config.color = this._getNextColor();
      config.startTime = currentZone.getStart() + currentZone.getDuration() / 2;
      config.durationTime = currentZone.getDuration() / 2;

      currentZone.setDuration(currentZone.getDuration() / 2);
      currentZone = this.add(config, selectedId);

      this.select(currentZone.id);
    }
  }

  /**
   * Creates a new scene at the current scrubber position
   */
  addNew() {
    const time = Component.getTimeFromPosX(this.ruler.getAbsolutePosX());
    const allScenes = this.getAllChildren();
    const currentZone = allScenes.find(scene =>
      time >= scene.getStart() && time < scene.getEnd()
    ) || allScenes.slice(-1)[0];

    if (!currentZone) {
      return;
    }

    const sliceFirst = time - currentZone.getStart();

    if (sliceFirst <= 0) {
      return;
    }

    const config = {
      id: this.getNewId(),
      label: this._getNextLabel(),
      color: this._getNextColor(),
      startTime: time,
      durationTime: currentZone.getDuration() - sliceFirst
    };

    currentZone.setDuration(sliceFirst);
    const newScene = this.add(config, currentZone.getId());

    this.select(newScene.id);
  }

  /**
   *
   * @returns {boolean}
   */
  remove() {
    if (this.getNumChildren() <= 1) {
      return false;
    }

    const currentZone = this.getSelected();
    const id = currentZone.id;
    const adjacentId = currentZone.previous === null
      ? (currentZone.next ? currentZone.getNextId() : null)
      : currentZone.getPreviousId();

    super.remove();
    this.select(adjacentId);
    this.onRemove.dispatch({ id, adjacentId });

    return true;
  }

  cut(currentZone, config) {
    const time = Component.getTimeFromPosX(this.ruler.getAbsolutePosX());

    if (time - currentZone.getStart() > 0) {
      const selectedId = currentZone.getId();
      const sliceFirst = time - currentZone.getStart();

      config.id = this.getNewId();
      config.label = this._getNextLabel();
      config.color = this._getNextColor();
      config.startTime = time;
      config.durationTime = currentZone.getDuration() - sliceFirst;
      currentZone.setDuration(sliceFirst);
      currentZone = this.add(config, selectedId);

      this.select(currentZone.id);
    }
  }

  edit(currentZone, config) {
    currentZone.edit(config);
    this.onEdit.dispatch({
      id: currentZone.getId(),
      label: currentZone.getLabel(),
      color: currentZone.getColor(),
      startTime: currentZone.getStart(),
      endTime: currentZone.getEnd(),
      previousId: currentZone.getPreviousId()
    });
  }

  /**
   *
   * @param posX
   * @returns {boolean}
   */
  moveTo(posX) {
    return super.moveTo(posX);
  }

  /**
   *
   * @param posX
   * @returns {boolean}
   */
  updateFrame(posX) {
    return posX > 0 && super.updateFrame(posX);
  }

  /**
   *
   * @returns {Array}
   */
  export() {
    return this.getAllChildren().map(elem => {
      return {
        id: elem.id,
        label: elem.getLabel(),
        color: elem.getColor(),
        startTime: elem.getStart(),
        durationTime: elem.getDuration(),
        endTime: elem.getEnd(),
        previousId: elem.getPreviousId(),
        next: elem.getNextId(),
        previous: elem.previous
      };
    });
  }

  render($parent) {
    // Scenes are readonly - no mouse events
    Component.render($parent, 'div', [{class: 'scenes'}]);
  }
}
