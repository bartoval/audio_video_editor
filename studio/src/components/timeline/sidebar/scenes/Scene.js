/**
 * Created by valerio bartolini.
 */
import Component from 'Component';
import Signals from 'signals';

/** *************************************************************************************
 *
 *                                        Private methods
 *
 ***************************************************************************************/
/**
 *
 * @param self
 * @private
 */
let _redraw = self => {
  let label = self.$node.querySelector('.label'),
    duration = self.$node.querySelector('.duration');
  label.textContent = self.label;
  duration.textContent = Component.getTimeFormatted(self.startTime) + ' - ' + Component.getTimeFormatted(self.endTime);

  self.$node.style.backgroundColor = self.color;
};
/** *************************************************************************************
 *
 *                                        Class
 *
 ***************************************************************************************/
export default class Scene {
  constructor($parent, config) {
    // dom nodes
    this.$parent = $parent;
    this.$node = null;
    // attributes
    this.id = config.id;
    this.label = config.label;
    this.color = config.color;
    this.startTime = config.startTime;
    this.endTime = config.endTime;
    // signals
    this.onScene = new Signals.Signal();
    // rendering component
    this.render($parent, config.id);
  }

  /**
   *
   * @param config
   * @returns {boolean}
   */
  edit(config) {
    this.label = config.label;
    this.color = config.color;
    this.startTime = config.startTime;
    this.endTime = config.endTime;
    _redraw(this);
    return true;
  }

  /**
   *
   * @returns {Number}
   */
  getStarTime() {
    return parseFloat(this.startTime);
  }

  /**
   *
   * @returns {Number}
   */
  getEndTime() {
    return parseFloat(this.endTime);
  }

  /**
   *
   * @param sec
   * @returns {boolean}
   */
  setStarTime(sec) {
    if (isNaN(sec) || sec < 0) {
      throw new Error('wrong input: time is ' + sec);
    }
    this.startTime = sec;
    _redraw(this);
    return true;
  }

  /**
   *
   * @param sec
   * @returns {boolean}
   */
  setEndTime(sec) {
    if (isNaN(sec) || sec < 0) {
      throw new Error('wrong input: time is ' + sec);
    }
    this.endTime = sec;
    _redraw(this);
    return true;
  }

  render($parent, id) {
    let props;
    // root
    props = [{class: 'scene', 'data-menu-id': id, 'data-start-time': this.startTime}];
    this.$node = Component.render($parent, 'li', props);
    // attribute label
    props = [{class: 'label', 'data-menu-id': id, 'data-start-time': this.startTime}];
    Component.render(this.$node, 'span', props);
    props = [{class: 'duration', 'data-menu-id': id}];
    Component.render(this.$node, 'div', props);
    _redraw(this);
  }
}
