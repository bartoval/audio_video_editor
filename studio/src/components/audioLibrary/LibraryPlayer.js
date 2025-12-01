import { Oscilloscope } from '../../lib';
import { getLibraryTrackUrl } from '../../services/workspace';

/**
 * LibraryPlayer - handles audio playback and oscilloscope visualization
 */
export default class LibraryPlayer {
  #$audio = null;
  #audioContext = null;
  #audioSource = null;
  #analyser = null;
  #oscilloscope = null;
  #isPlaying = false;

  constructor() {
    this.#oscilloscope = new Oscilloscope({
      fftSize: 128,
      smoothing: 0.7,
      color: '#64b5f6',
      lineWidth: 1.5,
      mode: 'vu'
    });

    this.#createAudioElement();
  }

  // ============================================================================
  // Public API
  // ============================================================================

  play(id, { onReady, onEnded } = {}) {
    this.#$audio.src = getLibraryTrackUrl(id);
    this.#$audio.load();

    this.#$audio.onloadeddata = async () => {
      await this.#initAudioContext();
      this.#$audio.play();
      this.#isPlaying = true;
      onReady?.();
      // start() is called inside attachOscilloscope if canvas exists
      // or here as fallback (will work when canvas is attached later)
      if (!this.#oscilloscope.isActive()) {
        this.#oscilloscope.start();
      }
    };

    this.#$audio.onended = () => {
      this.#isPlaying = false;
      this.#oscilloscope.stop();
      onEnded?.();
    };
  }

  stop() {
    this.#$audio.pause();
    this.#$audio.currentTime = 0;
    this.#isPlaying = false;
    this.#oscilloscope.stop();
  }

  async togglePlayPause() {
    if (this.#$audio.paused) {
      // Resume AudioContext if suspended
      if (this.#audioContext?.state === 'suspended') {
        await this.#audioContext.resume();
      }

      this.#$audio.play();
      this.#isPlaying = true;
      this.#oscilloscope.start();
    } else {
      this.#$audio.pause();
      this.#isPlaying = false;
      this.#oscilloscope.stop();
    }

    return this.#isPlaying;
  }

  isActive() {
    return this.#oscilloscope.isActive();
  }

  attachOscilloscope($canvas) {
    if (!$canvas || !this.#analyser) {
      return;
    }

    // Detach from previous canvas (clears it)
    this.#oscilloscope.detach();

    this.#oscilloscope.attachAnalyser(this.#analyser);
    this.#oscilloscope.attach($canvas);

    // Auto-start if audio is playing
    if (this.#isPlaying) {
      this.#oscilloscope.start();
    }
  }

  getAnalyser() {
    return this.#analyser;
  }

  // ============================================================================
  // Private
  // ============================================================================

  #createAudioElement() {
    this.#$audio = document.createElement('audio');
    this.#$audio.preload = 'none';
    this.#$audio.crossOrigin = 'anonymous';
    document.body.appendChild(this.#$audio);
  }

  async #initAudioContext() {
    if (this.#audioContext) {
      // Resume if suspended (browser autoplay policy)
      if (this.#audioContext.state === 'suspended') {
        await this.#audioContext.resume();
      }

      return;
    }

    this.#audioContext = new AudioContext();
    this.#audioSource = this.#audioContext.createMediaElementSource(this.#$audio);
    this.#analyser = this.#audioContext.createAnalyser();
    this.#analyser.fftSize = 128;

    this.#audioSource.connect(this.#analyser);
    this.#analyser.connect(this.#audioContext.destination);

    // Resume immediately after creation
    if (this.#audioContext.state === 'suspended') {
      await this.#audioContext.resume();
    }
  }
}
