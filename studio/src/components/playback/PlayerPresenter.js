// @ts-check

/** Player presenter - orchestrates playback controls and syncs with engine */
import { createElement } from '../../lib';
import { EVENT } from '../../config/constants';
import * as EventService from '../../services/EventService';
import Mediator from '../Mediator';
import { createControlBar } from './view';
import { playbackStore } from '../../store';

/**
 * @typedef {Object} PlayerState
 * @property {boolean} isPlaying
 * @property {number} currentTime
 * @property {number} duration
 * @property {string} aspectRatio
 * @property {boolean} disabled
 * @property {Error | null} error
 * @property {boolean} hasMarkers
 * @property {boolean} isLoopActive
 */

export default class PlayerPresenter {
  /** @type {ReturnType<typeof createControlBar> | null} */
  #controlBar = null;
  /** @type {HTMLElement | null} */
  #$container = null;
  /** @type {(() => void) | null} */
  #unsubscribeMarkersChanged = null;
  /** @type {(() => void) | null} */
  #unsubscribePlaybackStore = null;
  /** @type {PlayerState} */
  #state = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    aspectRatio: '',
    disabled: false,
    error: null,
    hasMarkers: false,
    isLoopActive: false
  };

  /** @param {HTMLElement} $parent */
  constructor($parent) {
    this.#initView($parent);
    this.#registerWithMediator();
    this.#registerEventListeners();
  }

  #registerEventListeners() {
    this.#unsubscribeMarkersChanged = EventService.on(EVENT.MARKERS_CHANGED, ({ count }) => {
      this.setState({ hasMarkers: count > 0 });
    });

    this.#unsubscribePlaybackStore = playbackStore.subscribe(() => {
      const { isPlaying, time, isLoopEnabled } = playbackStore.getState();

      const updates = {};

      if (isPlaying !== this.#state.isPlaying) {
        updates.isPlaying = isPlaying;
      }

      if (time !== this.#state.currentTime) {
        updates.currentTime = time;
      }

      if (isLoopEnabled !== this.#state.isLoopActive) {
        updates.isLoopActive = isLoopEnabled;
      }

      if (Object.keys(updates).length > 0) {
        this.setState(updates);
      }
    });
  }

  /** @param {HTMLElement} $parent */
  #initView($parent) {
    this.#$container = createElement('div', {
      className: 'w-100 flex-shrink-0 player-panel p-3 rounded-bottom',
      parent: $parent
    });

    this.#controlBar = createControlBar(this.#$container);
    this.#controlBar.bind({
      onPlay: () => this.#handlePlay(),
      onPause: () => this.#handlePause(),
      onStop: () => this.#handleStop(),
      onRewind: () => this.#handleRewind(),
      onSkipBack: seconds => this.#handleSkipBack(seconds),
      onSkipForward: seconds => this.#handleSkipForward(seconds),
      onFastForward: () => this.#handleFastForward(),
      onScrub: time => this.#handleScrub(time),
      onScrubbing: time => this.#handleScrubbing(time),
      onMarkerPrevious: () => this.#handleMarkerPrevious(),
      onMarkerNext: () => this.#handleMarkerNext(),
      onLoopToggle: () => this.#handleLoopToggle()
    });
  }

  #registerWithMediator() {
    Mediator.registerPlayer(this);
  }

  #isDisabled() {
    return this.#state.disabled || this.#state.error;
  }

  #handlePlay() {
    if (this.#isDisabled()) {
      return;
    }

    EventService.emitLocal(EVENT.PLAYBACK_SET_TIME_SLICE);
    EventService.emitLocal(EVENT.PLAYBACK_PLAY);
  }

  #handlePause() {
    if (this.#isDisabled()) {
      return;
    }

    EventService.emitLocal(EVENT.PLAYBACK_PAUSE);
  }

  #handleStop() {
    if (this.#isDisabled()) {
      return;
    }

    EventService.emitLocal(EVENT.PLAYBACK_RESET);
  }

  #handleRewind() {
    if (this.#isDisabled()) {
      return;
    }

    EventService.emitLocal(EVENT.PLAYBACK_REWIND);
  }

  /** @param {number} seconds */
  #handleSkipBack(seconds) {
    if (this.#isDisabled()) {
      return;
    }

    EventService.emitLocal(EVENT.PLAYBACK_SKIP_BACK, { seconds });
  }

  /** @param {number} seconds */
  #handleSkipForward(seconds) {
    if (this.#isDisabled()) {
      return;
    }

    EventService.emitLocal(EVENT.PLAYBACK_SKIP_FORWARD, { seconds });
  }

  #handleFastForward() {
    if (this.#isDisabled()) {
      return;
    }

    EventService.emitLocal(EVENT.PLAYBACK_FAST_FORWARD);
  }

  /** @param {number} time */
  #handleScrub(time) {
    if (this.#isDisabled()) {
      return;
    }

    EventService.emitLocal(EVENT.PLAYBACK_MOVE_FROM_PLAYER, { time });
  }

  /** @param {number} _time */
  #handleScrubbing(_time) {
    // Scrubbing state is handled by playbackStore via pause
  }

  #handleMarkerPrevious() {
    if (this.#isDisabled()) {
      return;
    }

    EventService.emitLocal(EVENT.MARKER_PREVIOUS);
  }

  #handleMarkerNext() {
    if (this.#isDisabled()) {
      return;
    }

    EventService.emitLocal(EVENT.MARKER_NEXT);
  }

  #handleLoopToggle() {
    if (this.#isDisabled()) {
      return;
    }

    EventService.emitLocal(EVENT.LOOP_TOGGLE);
  }

  /**
   * @param {number} duration
   * @param {{ displayAspectRatio?: string }} [metaInfo]
   */
  init(duration, metaInfo) {
    this.setState({
      duration,
      aspectRatio: metaInfo?.displayAspectRatio || '',
      disabled: false,
      error: null
    });
  }

  /** @param {number} duration */
  initAudioOnly(duration) {
    this.setState({
      duration,
      aspectRatio: '',
      disabled: false,
      error: null
    });
  }

  resize() {
    return this.#controlBar.resize();
  }

  /** @param {Partial<PlayerState>} partialState */
  setState(partialState) {
    this.#state = { ...this.#state, ...partialState };
    this.#controlBar.setState(partialState);
  }

  getState() {
    return { ...this.#state };
  }

  /** @param {boolean} disabled */
  setDisabled(disabled) {
    this.setState({ disabled });
  }

  /** @param {Error | null} error */
  setError(error) {
    this.setState({ error, disabled: !!error });
  }

  destroy() {
    this.#unsubscribeMarkersChanged?.();
    this.#unsubscribePlaybackStore?.();
    this.#controlBar?.destroy();
    this.#$container?.remove();
  }
}
