/**
 * Created by valerio bartolini.
 */
import Component from 'Component';
import Signals from 'signals';
import Controller from './scenes/Controller';

/** *************************************************************************************
 *
 *                                        Private methods
 *
 ***************************************************************************************/
/**
 * send messages to other components
 *
 * @param self
 * @private
 */
let _addSignals = self => {
  self.sceneController.onScene.add(id => {
    self.onScene.dispatch(id);
  });
};

export default class Menu {
  constructor($parent) {
    this.$node = null;
    // rendering component
    this.render($parent);

    this.sceneController = new Controller(this.$node);
    // signals
    this.onScene = new Signals.Signal();
    _addSignals(this);
  }

  /** *************************************************************************************
   *
   *                                        Public methods
   *
   ***************************************************************************************/
  /**
   *
   * @returns {boolean}
   */
  init() {
    return this.sceneController.init();
  }

  resize() {
    this.sceneController.resize();
  }

  /**
   *
   * @param scene
   */
  add(scene) {
    this.sceneController.add(scene);
  }

  /**
   *
   * @param scene
   */
  edit(scene) {
    this.sceneController.edit(scene);
  }

  /**
   *
   * @param config
   */
  remove(config) {
    this.sceneController.remove(config);
  }

  render($parent) {
    let props, listeners,
      $block;
    props = [{class: ''}];
    this.$node = Component.render($parent, 'div', props);
    props = [{class: 'block'}]; // empty block
    Component.render(this.$node, 'div', props);
    props = [{class: 'block'}]; // empty block
    Component.render(this.$node, 'div', props);
    props = [{class: 'block'}]; // empty block
    Component.render(this.$node, 'div', props);
    props = [{class: 'block'}]; // empty block
    Component.render(this.$node, 'div', props);
    props = [{class: 'block'}]; // empty block
    Component.render(this.$node, 'div', props);
    props = [{class: 'block'}]; // empty block
    Component.render(this.$node, 'div', props);
    props = [{class: 'block'}]; // empty block
    Component.render(this.$node, 'div', props);
    props = [{class: 'block'}]; // empty block
    Component.render(this.$node, 'div', props);
    props = [{class: 'block'}]; // empty block
    Component.render(this.$node, 'div', props);
    props = [{class: 'block'}]; // empty block
    Component.render(this.$node, 'div', props);
    props = [{class: 'block'}]; // empty block
    Component.render(this.$node, 'div', props);
    // navigator scenes block
    props = [{class: 'block'}];
    $block = Component.render(this.$node, 'div', props);
    props = [{class: 'bi bi-collection', title: 'scenes navigator'}];
    listeners = {
      click: e => {
        e.stopPropagation();
        e.preventDefault();
        let posX = this.$node.offsetWidth;
        this.sceneController.getNumChild() > 0 && this.sceneController.display() && this.sceneController.moveTo(posX);
      }
    };
    Component.render($block, 'i', props, listeners);
  }
}
