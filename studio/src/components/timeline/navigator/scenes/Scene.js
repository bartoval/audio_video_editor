/**
 * Created by valerio bartolini.
 */
import Component from 'Component';
import Zone from 'Zones/Zone';
import Config from 'Config';
/** *************************************************************************************
 *
 *                                        Private methods
 *
 ***************************************************************************************/
/**
 *
 * @param self
 * @returns {boolean}
 * @private
 */
let _redraw = (self) => {
  let $label = self.$node.querySelector('.label');
  $label.innerText = self.label;
  self.$node.title = self.description;
  self.$node.style.backgroundColor = self.color;

  return true;
};
/** *************************************************************************************
 *
 *                                        Class
 *
 ***************************************************************************************/
export default class Scene extends Zone {
  constructor(config, $parent) {
    super(config, $parent);
    // attributes
    this.color = config.color || Config.getColorMap()[0];
    this.label = config.label || '';
    this.description = config.description || '';
    this.commands = {
      add: false, cut: false, remove: false, play: false, stop: false
    };
    // rendering component
    this.render();
  }

  init() {
  }

  /**
   *
   * @returns {boolean}
   */
  select() {
    this.$node.classList.add('selected');
    return true;
  }

  deselect() {
    this.$node.classList.remove('selected');
    return true;
  }

  /**
   *
   * @returns {string|*}
   */
  getLabel() {
    return this.label;
  }

  /**
   *
   * @param label
   * @returns {boolean}
   */
  setLabel(label) {
    this.label = label;
    return true;
  }

  /**
   *
   * @returns {*|string}
   */
  getDescription() {
    return this.description;
  }

  /**
   *
   * @param description
   * @returns {boolean}
   */
  setDescription(description) {
    this.description = description;
    return true;
  }

  /**
   *
   * @returns {*|string|string|string}
   */
  getColor() {
    return this.color;
  }

  /**
   *
   * @param color
   * @returns {boolean}
   */
  setColor(color) {
    this.color = color;
    return true;
  }

  /**
   *
   * @param config
   * @returns {boolean}
   */
  edit(config) {
    return this.setColor(config.color) && this.setLabel(config.label) && this.setDescription(config.description) && _redraw(this);
  }

  /**
   *
   * @param start
   * @returns {Number}
   */
  setStart(start) {
    return super.setStart(start);
  }

  /**
   *
   * @param duration
   * @returns {Number}
   */
  setDuration(duration) {
    return super.setDuration(duration);
  }

  /**
   *
   * @param time
   * @param nextScene
   * @returns {boolean|Number|*}
   */
  drag(time, nextScene) {
    return this.isTransforming === true &&
      time <= nextScene.getEnd() - 0.5 && time >= this.getStart() + 0.5 &&
      this.setDuration(time - this.getStart()) &&
      nextScene.setDuration(nextScene.getDuration() + (nextScene.getStart() - this.getEnd())) && nextScene.setStart(this.getEnd());
  }

  /**
   *
   * @returns {{add: boolean, cut: boolean, remove: boolean, play: boolean, stop: boolean}|*}
   */
  getCommands() {
    return this.commands;
  }

  /** *************************************************************************************
   *
   *                                        Public methods
   *
   ***************************************************************************************/
  render() {
    let $node = this.$node, props;
    // title scene
    props = [{class: 'label', 'data-zone-id': this.id}];
    Component.render($node, 'div', props, {}, this.label);
    // hooks for drag
    props = [{class: 'hook resizable', style: 'right:0', 'data-zone-id': this.id}];
    Component.render($node, 'div', props);

    _redraw(this);
    this.zoom();
  }
}

