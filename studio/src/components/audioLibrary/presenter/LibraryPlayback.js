/**
 * LibraryPlayback - handles audio playback and oscilloscope visualization
 */
import LibraryPlayer from '../LibraryPlayer';
import { Oscilloscope } from '../../../lib';

export default class LibraryPlayback {
  #player = null;
  #listOscilloscope = null;
  #currentPlayingId = null;

  // View reference for UI updates
  #view = null;

  constructor() {
    this.#player = new LibraryPlayer();

    this.#listOscilloscope = new Oscilloscope({
      fftSize: 128,
      smoothing: 0.7,
      color: '#64b5f6',
      mode: 'frequency'
    });
  }

  // ============================================================================
  // Setup
  // ============================================================================

  setView(view) {
    this.#view = view;
  }

  // ============================================================================
  // State
  // ============================================================================

  getCurrentPlayingId() {
    return this.#currentPlayingId;
  }

  setCurrentPlayingId(id) {
    this.#currentPlayingId = id;
  }

  getAnalyser() {
    return this.#player.getAnalyser();
  }

  // ============================================================================
  // Playback Control
  // ============================================================================

  async play(id, item) {
    const currentId = this.#currentPlayingId;

    // Toggle play/pause for current track
    if (currentId === id) {
      const isPlaying = await this.#player.togglePlayPause();

      this.#view?.setPlayButtonState(id, isPlaying);
      this.#view?.updateMiniPlayerState(isPlaying);

      if (isPlaying) {
        this.#listOscilloscope.start();
      } else {
        this.#listOscilloscope.stop();
      }

      return;
    }

    // Stop previous track
    if (currentId) {
      this.#player.stop();
      this.#listOscilloscope.stop();
      this.#view?.setPlayButtonState(currentId, false);
    }

    // Play new track
    this.#currentPlayingId = id;

    this.#player.play(id, {
      onReady: () => {
        requestAnimationFrame(() => {
          // Attach VU meter oscilloscope to mini-player canvas
          const $miniCanvas = this.#view?.getMiniPlayerCanvas();

          if ($miniCanvas) {
            this.#player.attachOscilloscope($miniCanvas);
          }

          // Attach frequency oscilloscope to list item canvas
          const $listCanvas = this.#view?.getOscilloscopeCanvas(id);
          const analyser = this.#player.getAnalyser();

          if ($listCanvas && analyser) {
            this.#listOscilloscope.attachAnalyser(analyser);
            this.#listOscilloscope.attach($listCanvas);
            this.#listOscilloscope.start();
          }
        });

        this.#view?.setPlayButtonState(id, true);
        this.#view?.showMiniPlayer(item?.name || 'Unknown');
        this.#view?.updateMiniPlayerState(true);
      },
      onEnded: () => {
        this.#view?.setPlayButtonState(id, false);
        this.#view?.hideMiniPlayer();
        this.#listOscilloscope.stop();
        this.#currentPlayingId = null;
      }
    });
  }

  async togglePlayPause() {
    const currentId = this.#currentPlayingId;

    if (!currentId) {
      return;
    }

    const isPlaying = await this.#player.togglePlayPause();

    this.#view?.setPlayButtonState(currentId, isPlaying);
    this.#view?.updateMiniPlayerState(isPlaying);

    if (isPlaying) {
      this.#listOscilloscope.start();
    } else {
      this.#listOscilloscope.stop();
    }
  }

  stop() {
    this.#player.stop();
    this.#listOscilloscope.stop();
    this.#view?.hideMiniPlayer();
    this.#currentPlayingId = null;
  }

  // ============================================================================
  // Oscilloscope
  // ============================================================================

  attachListOscilloscope(id) {
    const $canvas = this.#view?.getOscilloscopeCanvas(id);

    if ($canvas) {
      const analyser = this.#player.getAnalyser();

      if (analyser) {
        this.#listOscilloscope.attachAnalyser(analyser);
        this.#listOscilloscope.attach($canvas);
        this.#listOscilloscope.start();
      }
    }
  }

  stopOscilloscope() {
    this.#listOscilloscope.stop();
  }

  // ============================================================================
  // Mini Player
  // ============================================================================

  goToCurrentTrack() {
    if (this.#currentPlayingId) {
      this.#view?.scrollToItem(this.#currentPlayingId);
    }
  }
}
