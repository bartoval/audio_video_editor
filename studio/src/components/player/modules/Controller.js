import Signals from 'signals';
import { createElement, createIconButton, togglePair } from 'utils/dom';

export default class Controller {
  constructor($parent) {
    this.$node = null;
    this.$playBtn = null;
    this.$pauseBtn = null;
    this.isPlaying = false;

    this.onFullScreen = new Signals.Signal();
    this.onPlay = new Signals.Signal();
    this.onStop = new Signals.Signal();
    this.onPause = new Signals.Signal();

    this.render($parent);
  }

  init() {
    this.isPlaying = false;
    this._updateButtons();

    return true;
  }

  setIsPlaying(isPlaying) {
    this.isPlaying = isPlaying;
    this._updateButtons();

    return true;
  }

  _updateButtons() {
    if (this.isPlaying) {
      togglePair(this.$pauseBtn, this.$playBtn);
    } else {
      togglePair(this.$playBtn, this.$pauseBtn);
    }
  }

  render($parent) {
    this.$node = createElement('div', {
      className: 'btn-group btn-group-sm',
      parent: $parent
    });

    const handleClick = (callback) => (e) => {
      e.preventDefault();
      e.stopPropagation();
      callback();
    };

    this.$playBtn = createIconButton({
      icon: 'play-fill',
      title: 'Play',
      onClick: handleClick(() => this.setIsPlaying(true) && this.onPlay.dispatch()),
      parent: this.$node
    });

    this.$pauseBtn = createIconButton({
      icon: 'pause-fill',
      title: 'Pause',
      onClick: handleClick(() => this.setIsPlaying(false) && this.onPause.dispatch()),
      parent: this.$node
    });
    this.$pauseBtn.classList.add('d-none');

    createIconButton({
      icon: 'stop-fill',
      title: 'Stop',
      onClick: handleClick(() => this.setIsPlaying(false) && this.onStop.dispatch()),
      parent: this.$node
    });
  }
}
