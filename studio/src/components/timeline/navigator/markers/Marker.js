import { generateUuid } from '../../../../lib/utils/uuid';

/**
 * Marker model - represents a point in time on the timeline
 */
export default class Marker {
  constructor(config = {}) {
    const { id = generateUuid(), time = 0, label = '', type = 'user' } = config;

    this.id = id;
    this.time = Math.max(0, time);
    this.label = label;
    this.type = type;
  }

  getId() {
    return this.id;
  }

  getTime() {
    return this.time;
  }

  setTime(time) {
    this.time = Math.max(0, time);

    return this.time;
  }

  getLabel() {
    return this.label;
  }

  setLabel(label) {
    this.label = label;

    return this.label;
  }

  getType() {
    return this.type;
  }

  toJSON() {
    return {
      id: this.id,
      time: this.time,
      label: this.label,
      type: this.type
    };
  }

  static fromJSON(data) {
    return new Marker(data);
  }

  static fromScene(scene) {
    const minutes = Math.floor(scene.time / 60);
    const seconds = Math.floor(scene.time % 60);
    const timeLabel = `${minutes}:${String(seconds).padStart(2, '0')}`;
    const typeLabel = scene.type === 'fade' ? 'Fade' : 'Cut';

    return new Marker({
      time: scene.time,
      label: `Scene ${typeLabel} @${timeLabel}`,
      type: 'scene'
    });
  }
}
