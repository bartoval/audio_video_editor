import Model from '../../mvp/Model.js';
import Component from 'Component';

export default class ZoneModel extends Model {
  constructor(config) {
    super({
      id: config.id,
      previous: config.previous || null,
      next: config.next || null,
      groupId: config.groupId || null,
      color: config.color || 'transparent',
      startTime: config.startTime || 0,
      durationTime: config.durationTime || 0,
      isDragging: false,
      isMoving: false,
      isTransforming: false,
      isCutting: false,
      mouseTime: 0
    });
  }

  /** Get start position in pixels */
  getStartPosX() {
    return Component.getPosXFromTime(this.get('startTime'));
  }

  /** Get duration in pixels */
  getDurationPosX() {
    return Component.getPosXFromTime(this.get('durationTime'));
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
      throw new Error('wrong input: time is ' + sec);
    }

    this.set('startTime', parseFloat(sec));

    return this.get('startTime');
  }

  /** Set duration time with validation */
  setDurationTime(sec) {
    if (isNaN(sec) || sec < 0) {
      throw new Error('wrong input: time is ' + sec);
    }

    this.set('durationTime', parseFloat(sec));

    return this.get('durationTime');
  }

  /** Start drag operation */
  startDrag(type, posX) {
    const time = Component.getTimeFromPosX(posX);
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
    const time = Component.getTimeFromPosX(posX);
    const mouseTime = this.get('mouseTime');
    const newStart = Math.max(0, time - mouseTime);

    this.setStartTime(newStart);
  }
}
