import Component from 'Component';
import Signals from 'signals';
import Scene from './Scene';
import { applyTransform3d } from 'utils/animation';
import { show, hide } from 'utils/dom';

export default class SceneController {
  constructor($parent) {
    this.$node = null;
    this.posX = 0;
    this.scenes = [];
    this.isActive = false;
    this.onScene = new Signals.Signal();
    this.render($parent);
  }

  init() {
    const $scenes = this.$node.querySelector('.scenes');
    this.scenes.forEach(elem => {
      $scenes.removeChild(elem.$node);
      elem = null;
    });
    this.scenes = [];
    this._redraw();

    return true;
  }

  resize() {
    this._redraw();
  }

  getChild(id) {
    if (id === null) {
      return null;
    }

    return this.scenes.find(elem => elem.id === id);
  }

  getNumChild() {
    return this.scenes.length;
  }

  add(config) {
    const scene = new Scene(this.$node.querySelector('.scenes'), config);
    const adjacentId = config.previousId;
    this.scenes.push(scene);
    this.scenes.sort((a, b) => a.getStarTime() - b.getStarTime());

    if (adjacentId) {
      const previousScene = this.getChild(adjacentId);

      if (previousScene) {
        previousScene.setEndTime(scene.getStarTime());
      }
    }

    this._sort();
  }

  edit(config) {
    const scene = this.getChild(config.id);
    const adjacentId = config.previousId;
    scene.edit(config);

    if (adjacentId) {
      const previousScene = this.getChild(adjacentId);
      previousScene.setEndTime(scene.getStarTime());
    }
  }

  remove(config) {
    const { id, adjacentId } = config;
    const obj = this.getChild(id);
    this.scenes = this.scenes.filter(elem => elem.id !== id);
    this.$node.querySelector('.scenes').removeChild(obj.$node);

    if (adjacentId) {
      const adjacentScene = this.getChild(adjacentId);

      if (adjacentScene.getStarTime() < obj.getStarTime()) {
        adjacentScene.setEndTime(obj.getEndTime());
      } else {
        adjacentScene.setStarTime(obj.getStarTime());
      }
    }
  }

  moveTo(posX) {
    if (!this.$node.classList.contains('hide')) {
      applyTransform3d(this.$node, posX, 0, 0);
      this.posX = posX;
    }
  }

  display() {
    this.isActive = !this.isActive;

    if (this.isActive) {
      show(this.$node, 'hide');
    } else {
      hide(this.$node, 'hide');
    }

    return true;
  }

  _redraw() {
    this.$node.style.top = document.querySelector('.sidebar').offsetTop + 10 * 11 + 'px';
  }

  _sort() {
    const container = this.$node.querySelector('.scenes');
    const contents = container.querySelectorAll('li');
    const list = Array.from(contents);

    list.sort((a, b) => {
      const a0 = parseFloat(a.getAttribute('data-start-time'));
      const b0 = parseFloat(b.getAttribute('data-start-time'));

      return a0 > b0 ? -1 : a0 < b0 ? 1 : 0;
    });

    list.forEach(item => container.insertBefore(item, container.firstChild));
  }

  render($parent) {
    const listeners = {
      mouseleave: e => {
        e.stopPropagation();
        e.preventDefault();
        this.isActive = false;
        hide(this.$node, 'hide');
      },
      mousedown: e => {
        e.stopPropagation();
        e.preventDefault();
        const id = e.target.getAttribute('data-menu-id');
        this.onScene.dispatch(id);
      }
    };

    this.$node = Component.render($parent, 'div', [{ class: 'controller event-transition' }], listeners);
    Component.render(this.$node, 'div', [{ class: 'arrow-up' }]);
    Component.render(this.$node, 'ul', [{ class: 'scenes' }]);
  }
}
