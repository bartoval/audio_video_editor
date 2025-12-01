import { Model } from '../../../lib/ui/mvp';
import Scale from '../../../lib/utils/scale';

/** Zone model with position/time state */
export default class ZoneModel extends Model {
  constructor(config) {
    const {
      id,
      previous = null,
      previousId = null,
      next = null,
      nextId = null,
      groupId = null,
      color = 'transparent',
      startTime = 0,
      durationTime = 0
    } = config;

    super({
      id,
      previous: previous || previousId,
      next: next || nextId,
      groupId,
      color,
      startTime,
      durationTime,
      isDragging: false,
      isMoving: false,
      isTransforming: false,
      isCutting: false,
      mouseTime: 0
    });
  }

  /** Get start position in pixels */
  getStartPosX() {
    return Scale.getPosXFromTime(this.get('startTime'));
  }

  /** Get duration in pixels */
  getDurationPosX() {
    return Scale.getPosXFromTime(this.get('durationTime'));
  }

  /** Get end position in pixels */
  getEndPosX() {
    return this.getStartPosX() + this.getDurationPosX();
  }

  /** Get end time in seconds */
  getEnd() {
    return this.get('startTime') + this.get('durationTime');
  }

  /** Set start time with validation */
  setStartTime(sec) {
    if (isNaN(sec) || sec < 0) {
      throw new Error(`Invalid time: ${sec}`);
    }

    this.set('startTime', parseFloat(sec));

    return this.get('startTime');
  }

  /** Set duration time with validation */
  setDurationTime(sec) {
    if (isNaN(sec) || sec < 0) {
      throw new Error(`Invalid time: ${sec}`);
    }

    this.set('durationTime', parseFloat(sec));

    return this.get('durationTime');
  }

  /** Start drag operation */
  startDrag(type, posX) {
    const time = Scale.getTimeFromPosX(posX);
    const mouseTime = time - this.get('startTime');

    this.update({
      isDragging: true,
      isMoving: type === 'move',
      isTransforming: type === 'resize',
      mouseTime
    });
  }

  /** Stop drag operation */
  stopDrag() {
    this.update({
      isDragging: false,
      isMoving: false,
      isTransforming: false
    });
  }

  /** Move zone to position */
  moveTo(posX) {
    const time = Scale.getTimeFromPosX(posX);
    const mouseTime = this.get('mouseTime');
    const newStart = Math.max(0, time - mouseTime);

    this.setStartTime(newStart);
  }
}
