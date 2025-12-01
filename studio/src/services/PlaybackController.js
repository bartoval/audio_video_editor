/**
 * PlaybackController - facade for playback services
 *
 * Maintains backward compatibility while delegating to:
 * - PlaybackState: time, duration, timeSlice
 * - PlaybackLoop: RAF update loop
 * - PlaybackCommands: play/pause/seek/skip actions
 */
import { PlaybackState, PlaybackLoop, PlaybackCommands } from './playback';

class PlaybackController {
  constructor() {
    // Wire up loop callbacks
    PlaybackLoop.setOnUpdate(time => this.#onLoopUpdate(time));
    PlaybackLoop.setOnEndReached(() => this.#onEndReached());
  }

  // ============================================================================
  // Component Registration
  // ============================================================================

  registerVideo(video) {
    PlaybackCommands.registerVideo(video);
  }

  registerPlayer(player) {
    PlaybackCommands.registerPlayer(player);
  }

  registerNavigator(navigator) {
    PlaybackCommands.registerNavigator(navigator);
  }

  // ============================================================================
  // Timer Interface
  // ============================================================================

  init(sec) {
    PlaybackCommands.stop();
    PlaybackState.init(sec);

    return true;
  }

  getDuration() {
    return PlaybackState.getDuration();
  }

  getTime() {
    return PlaybackState.getTime();
  }

  seekTo(sec) {
    PlaybackState.seekTo(sec);

    return true;
  }

  isRunning() {
    return PlaybackState.isPlaying();
  }

  start() {
    setTimeout(() => PlaybackState.play(), 0);

    return true;
  }

  stop() {
    PlaybackState.pause();

    return true;
  }

  reset() {
    PlaybackCommands.stop();

    return true;
  }

  // ============================================================================
  // Time Slice
  // ============================================================================

  setTimeSlice(timeSlice = null) {
    if (timeSlice) {
      PlaybackState.setTimeSlice(
        timeSlice.start ?? PlaybackState.getTime(),
        timeSlice.end ?? PlaybackState.getDuration()
      );
    }
  }

  getTimeSlice() {
    return PlaybackState.getTimeSlice();
  }

  // ============================================================================
  // Playback Actions
  // ============================================================================

  play() {
    return PlaybackCommands.play();
  }

  pause() {
    return PlaybackCommands.pause();
  }

  resetPlayback(isScene = false) {
    return PlaybackCommands.reset(isScene);
  }

  rewind() {
    return PlaybackCommands.rewind();
  }

  fastForward() {
    return PlaybackCommands.fastForward();
  }

  skipBack(seconds = 5) {
    return PlaybackCommands.skipBack(seconds);
  }

  skipForward(seconds = 5) {
    return PlaybackCommands.skipForward(seconds);
  }

  // ============================================================================
  // Scrubber Movement
  // ============================================================================

  moveFromPlayer(time) {
    return PlaybackCommands.moveFromPlayer(time);
  }

  moveFromNavigator(time) {
    return PlaybackCommands.moveFromNavigator(time);
  }

  // ============================================================================
  // Update Loop
  // ============================================================================

  startLoop() {
    PlaybackLoop.start();
  }

  #onLoopUpdate(time) {
    PlaybackCommands.updateFrame(time);
  }

  #onEndReached() {
    console.log('[PlaybackController] End of media');
    PlaybackCommands.pause();
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  cleanup() {
    PlaybackCommands.cleanup();
  }
}

export default new PlaybackController();
