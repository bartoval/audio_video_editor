import Presenter from '../../mvp/Presenter.js';
import ZoneModel from './ZoneModel.js';
import ZoneView from './ZoneView.js';

export default class ZonePresenter extends Presenter {
  constructor(config, $parent) {
    const model = new ZoneModel({ ...config, groupId: $parent.getAttribute('data-zone-group') });
    const view = new ZoneView($parent);

    super(model, view);
  }

  /** Get zone id */
  getId() {
    return this.get('id');
  }

  /** Get parent group id */
  getGroupId() {
    return this.get('groupId');
  }

  /** Get previous zone id in chain */
  getPreviousId() {
    return this.get('previous');
  }

  /** Get next zone id in chain */
  getNextId() {
    return this.get('next');
  }

  /** Set next zone id */
  setNextId(id) {
    this.set('next', id || null);
  }

  /** Set previous zone id */
  setPreviousId(id) {
    this.set('previous', id || null);
  }

  /** Get start time in seconds */
  getStart() {
    return this.get('startTime');
  }

  /** Get duration in seconds */
  getDuration() {
    return this.get('durationTime');
  }

  /** Get end time in seconds */
  getEnd() {
    return this.model.getEnd();
  }

  /** Set start time */
  setStart(sec) {
    return this.model.setStartTime(sec);
  }

  /** Set duration time */
  setDuration(sec) {
    return this.model.setDurationTime(sec);
  }

  /** Get start position in pixels */
  getStartPosX() {
    return this.model.getStartPosX();
  }

  /** Get end position in pixels */
  getEndPosX() {
    return this.model.getEndPosX();
  }

  /** Get width in pixels */
  getWidth() {
    return this.model.getDurationPosX();
  }

  /** Start drag operation */
  dragStart(type, posX = 0) {
    this.model.startDrag(type, posX);

    return true;
  }

  /** Stop drag operation */
  dragStop() {
    this.model.stopDrag();

    return true;
  }

  /** Move zone to position */
  moveTo(posX) {
    this.model.moveTo(posX);

    return true;
  }

  /** Recalculate on zoom change */
  zoom() {
    this.refresh();
  }

  /** Cleanup hook */
  clean() {}

  /** Legacy getter: id */
  get id() {
    return this.get('id');
  }

  /** Legacy getter: previous */
  get previous() {
    return this.get('previous');
  }

  /** Legacy setter: previous */
  set previous(val) {
    this.set('previous', val);
  }

  /** Legacy getter: next */
  get next() {
    return this.get('next');
  }

  /** Legacy setter: next */
  set next(val) {
    this.set('next', val);
  }

  /** Legacy getter: DOM node */
  get $node() {
    return this.view.getRoot();
  }

  /** Legacy getter: isMoving */
  get isMoving() {
    return this.get('isMoving');
  }

  /** Legacy getter: isTransforming */
  get isTransforming() {
    return this.get('isTransforming');
  }

  /** Legacy getter: parent element */
  get $parent() {
    return this.view.$parent;
  }
}
