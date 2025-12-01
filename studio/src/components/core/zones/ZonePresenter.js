import { Presenter } from '../../../lib/ui/mvp';
import ZoneModel from './ZoneModel';
import ZoneView from './ZoneView';

/** Zone presenter - base class for timeline elements */
export default class ZonePresenter extends Presenter {
  /**
   * @param {Object} config - Zone configuration
   * @param {HTMLElement} $parent - Parent element
   * @param {Object} [options] - Optional model/view overrides for subclasses
   * @param {ZoneModel} [options.model] - Custom model instance
   * @param {ZoneView} [options.view] - Custom view instance
   */
  constructor(config, $parent, options = {}) {
    const fullConfig = {
      ...config,
      groupId: $parent.getAttribute('data-zone-group')
    };
    const model = options.model || new ZoneModel(fullConfig);
    const view = options.view || new ZoneView($parent, fullConfig);

    super(model, view);
  }

  getId() {
    return this.get('id');
  }

  getGroupId() {
    return this.get('groupId');
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

  dragStart(type, posX = 0) {
    this.model.startDrag(type, posX);

    return true;
  }

  dragStop() {
    this.model.stopDrag();

    return true;
  }

  moveTo(posX) {
    this.model.moveTo(posX);

    return true;
  }

  zoom() {
    this.refresh();
  }

  clean() {}

  destroy() {
    this.view.dispose();
  }

  // ============================================================================
  // DOM Access Methods
  // ============================================================================

  /** Get the root DOM element */
  getRoot() {
    return this.view.getRoot();
  }

  /** Get the parent group element */
  getGroupElement() {
    return this.view.getRoot()?.parentNode || null;
  }

  /** Check if editing envelope (volume/pan) */
  isEditingEnvelope() {
    return this.view.getRoot()?.classList.contains('editing-envelope') || false;
  }

  // ============================================================================
  // State Query Methods
  // ============================================================================

  /** Check if currently dragging */
  getIsDragging() {
    return this.get('isDragging');
  }

  /** Check if currently moving */
  getIsMoving() {
    return this.get('isMoving');
  }

  /** Check if currently transforming (resizing) */
  getIsTransforming() {
    return this.get('isTransforming');
  }

  /** Check if drag is active (moving or transforming) */
  isDragActive() {
    return this.getIsMoving() || this.getIsTransforming();
  }
}
