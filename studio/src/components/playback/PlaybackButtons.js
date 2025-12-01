import { Signals, createElement, createIconButton, togglePair, View } from '../../lib';

const SKIP_SECONDS = 5;

export default class PlaybackButtons extends View {
  #$playBtn = null;
  #$pauseBtn = null;
  #isPlaying = false;

  onPlay = new Signals.Signal();
  onPause = new Signals.Signal();
  onStop = new Signals.Signal();
  onRewind = new Signals.Signal();
  onSkipBack = new Signals.Signal();
  onSkipForward = new Signals.Signal();
  onFastForward = new Signals.Signal();

  constructor($parent) {
    super($parent);
    this.mount();
  }

  render() {
    this.$node = createElement('div', {
      className: 'btn-group btn-group-sm',
      parent: this.$parent
    });

    const handleClick = callback => e => {
      e.preventDefault();
      e.stopPropagation();
      callback();
    };

    // Rewind to start
    createIconButton({
      icon: 'skip-start-fill',
      title: 'Rewind to start',
      onClick: handleClick(() => {
        this.setIsPlaying(false);
        this.onRewind.dispatch();
      }),
      parent: this.$node
    });

    // Skip back 5s
    createIconButton({
      icon: 'skip-backward-fill',
      title: `Skip back ${SKIP_SECONDS}s`,
      onClick: handleClick(() => this.onSkipBack.dispatch(SKIP_SECONDS)),
      parent: this.$node
    });

    // Play
    this.#$playBtn = createIconButton({
      icon: 'play-fill',
      title: 'Play',
      onClick: handleClick(() => this.setIsPlaying(true) && this.onPlay.dispatch()),
      parent: this.$node
    });

    // Pause
    this.#$pauseBtn = createIconButton({
      icon: 'pause-fill',
      title: 'Pause',
      onClick: handleClick(() => this.setIsPlaying(false) && this.onPause.dispatch()),
      parent: this.$node
    });
    this.#$pauseBtn.classList.add('d-none');

    // Stop
    createIconButton({
      icon: 'stop-fill',
      title: 'Stop',
      onClick: handleClick(() => {
        this.setIsPlaying(false);
        this.onStop.dispatch();
      }),
      parent: this.$node
    });

    // Skip forward 5s
    createIconButton({
      icon: 'skip-forward-fill',
      title: `Skip forward ${SKIP_SECONDS}s`,
      onClick: handleClick(() => this.onSkipForward.dispatch(SKIP_SECONDS)),
      parent: this.$node
    });

    // Fast forward to end
    createIconButton({
      icon: 'skip-end-fill',
      title: 'Go to end',
      onClick: handleClick(() => {
        this.setIsPlaying(false);
        this.onFastForward.dispatch();
      }),
      parent: this.$node
    });
  }

  init() {
    this.#isPlaying = false;
    this.#updateButtons();

    return true;
  }

  setIsPlaying(isPlaying) {
    this.#isPlaying = isPlaying;
    this.#updateButtons();

    return true;
  }

  #updateButtons() {
    if (this.#isPlaying) {
      togglePair(this.#$pauseBtn, this.#$playBtn);
    } else {
      togglePair(this.#$playBtn, this.#$pauseBtn);
    }
  }
}
