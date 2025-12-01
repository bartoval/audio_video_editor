// @ts-check

/**
 * PlaybackController - facade for playback services
 *
 * Maintains backward compatibility while delegating to:
 * - playbackStore: time, duration, timeSlice state
 * - PlaybackLoop: RAF update loop
 * - PlaybackCommands: play/pause/seek/skip actions
 */
import { PlaybackLoop, PlaybackCommands } from './playback';
import { playbackStore } from '../store';
import * as EventService from './EventService';
import { EVENT } from '../config/constants';

class PlaybackController {
  /** @type {Array<() => void>} */
  #eventUnsubscribes = [];

  constructor() {
    PlaybackLoop.setOnUpdate(time => this.#onLoopUpdate(time));
    PlaybackLoop.setOnEndReached(() => this.#onEndReached());
    this.#initEventListeners();
  }

  #initEventListeners() {
    this.#eventUnsubscribes = [
      EventService.on(EVENT.PLAYBACK_PLAY, () => this.play()),
      EventService.on(EVENT.PLAYBACK_PAUSE, () => this.pause()),
      EventService.on(EVENT.PLAYBACK_RESET, ({ isScene } = {}) => this.resetPlayback(isScene)),
      EventService.on(EVENT.PLAYBACK_REWIND, () => this.rewind()),
      EventService.on(EVENT.PLAYBACK_SKIP_BACK, ({ seconds } = {}) => this.skipBack(seconds)),
      EventService.on(EVENT.PLAYBACK_SKIP_FORWARD, ({ seconds } = {}) => this.skipForward(seconds)),
      EventService.on(EVENT.PLAYBACK_FAST_FORWARD, () => this.fastForward()),
      EventService.on(EVENT.PLAYBACK_SET_TIME_SLICE, timeSlice => this.setTimeSlice(timeSlice)),
      EventService.on(EVENT.PLAYBACK_MOVE_FROM_NAVIGATOR, ({ time } = {}) =>
        this.moveFromNavigator(time)
      ),
      EventService.on(EVENT.PLAYBACK_MOVE_FROM_PLAYER, ({ time } = {}) => this.moveFromPlayer(time))
    ];
  }

  /** @param {HTMLVideoElement} video */
  registerVideo(video) {
    PlaybackCommands.registerVideo(video);
  }

  /** @param {any} navigator */
  registerNavigator(navigator) {
    PlaybackCommands.registerNavigator(navigator);
  }

  /** @param {number} sec */
  init(sec) {
    PlaybackCommands.stop();
    playbackStore.actions.init(sec);

    return true;
  }

  getDuration() {
    return playbackStore.getState().duration;
  }

  getTime() {
    return playbackStore.getState().time;
  }

  /** @param {number} sec */
  seekTo(sec) {
    playbackStore.actions.seek(sec);

    return true;
  }

  isRunning() {
    return playbackStore.getState().isPlaying;
  }

  start() {
    setTimeout(() => playbackStore.actions.play(), 0);

    return true;
  }

  stop() {
    playbackStore.actions.pause();

    return true;
  }

  reset() {
    PlaybackCommands.stop();

    return true;
  }

  /** @param {{ start?: number, end?: number } | null} [timeSlice] */
  setTimeSlice(timeSlice = null) {
    if (timeSlice) {
      const state = playbackStore.getState();
      playbackStore.actions.setTimeSlice({
        start: timeSlice.start ?? state.time,
        end: timeSlice.end ?? state.duration
      });
    }
  }

  getTimeSlice() {
    return playbackStore.getState().timeSlice;
  }

  play() {
    return PlaybackCommands.play();
  }

  pause() {
    return PlaybackCommands.pause();
  }

  /** @param {boolean} [isScene] */
  resetPlayback(isScene = false) {
    return PlaybackCommands.reset(isScene);
  }

  rewind() {
    return PlaybackCommands.rewind();
  }

  fastForward() {
    return PlaybackCommands.fastForward();
  }

  /** @param {number} [seconds] */
  skipBack(seconds = 5) {
    return PlaybackCommands.skipBack(seconds);
  }

  /** @param {number} [seconds] */
  skipForward(seconds = 5) {
    return PlaybackCommands.skipForward(seconds);
  }

  /** @param {number} time */
  moveFromPlayer(time) {
    return PlaybackCommands.moveFromPlayer(time);
  }

  /** @param {number} time */
  moveFromNavigator(time) {
    return PlaybackCommands.moveFromNavigator(time);
  }

  startLoop() {
    PlaybackLoop.start();
  }

  /** @param {number} time */
  #onLoopUpdate(time) {
    PlaybackCommands.updateFrame(time);
  }

  #onEndReached() {
    console.log('[PlaybackController] End of media');
    PlaybackCommands.pause();
  }

  cleanup() {
    PlaybackCommands.cleanup();
  }

  destroy() {
    this.#eventUnsubscribes.forEach(unsub => unsub?.());
    this.#eventUnsubscribes = [];
  }
}

export default new PlaybackController();
