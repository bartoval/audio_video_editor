import { ZoneModel } from '../../../core/zones';
import { SCENE_COLORS } from '../../../../config/ui';

export default class SceneModel extends ZoneModel {
  constructor(config) {
    const { label = '', color = SCENE_COLORS[0], description = '' } = config;

    super(config);
    this.update({ label, color, description });
  }

  setLabel(label) {
    this.set('label', label);
    return true;
  }
  setColor(color) {
    this.set('color', color);
    return true;
  }
  setDescription(description) {
    this.set('description', description);
    return true;
  }
}
