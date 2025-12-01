import { getLibraryTrackUrl } from '../../services/workspace';

/**
 * LibraryPlaybackEngine - handles audio playback and oscilloscope visualization
 */
export default class LibraryPlaybackEngine {
  #$audio = null;
  #audioContext = null;
  #audioSource = null;
  #analyser = null;
  #isPlaying = false;

  constructor() {
    this.#createAudioElement();
  }

  play(id, { onReady, onEnded, onTimeUpdate } = {}) {
    this.#$audio.src = getLibraryTrackUrl(id);
    this.#$audio.load();

    this.#$audio.onloadeddata = async () => {
      await this.#initAudioContext();
      this.#$audio.play();
      this.#isPlaying = true;
      onReady?.(this.#$audio.duration);
    };

    this.#$audio.ontimeupdate = () => {
      if (this.#isPlaying) {
        onTimeUpdate?.(this.#$audio.currentTime);
      }
    };

    this.#$audio.onended = () => {
      this.#isPlaying = false;
      onEnded?.();
    };
  }

  seek(time) {
    if (this.#$audio) {
      this.#$audio.currentTime = Math.max(0, Math.min(time, this.#$audio.duration || 0));
    }
  }

  getDuration() {
    return this.#$audio?.duration || 0;
  }

  stop() {
    this.#$audio.pause();
    this.#$audio.currentTime = 0;
    this.#isPlaying = false;
  }

  async togglePlayPause() {
    if (this.#$audio.paused) {
      if (this.#audioContext?.state === 'suspended') {
        await this.#audioContext.resume();
      }

      this.#$audio.play();
      this.#isPlaying = true;
    } else {
      this.#$audio.pause();
      this.#isPlaying = false;
    }

    return this.#isPlaying;
  }

  isActive() {
    return !this.#$audio.paused;
  }

  getAnalyser() {
    return this.#analyser;
  }

  #createAudioElement() {
    this.#$audio = document.createElement('audio');
    this.#$audio.preload = 'none';
    this.#$audio.crossOrigin = 'anonymous';
    document.body.appendChild(this.#$audio);
  }

  async #initAudioContext() {
    if (this.#audioContext) {
      if (this.#audioContext.state === 'suspended') {
        await this.#audioContext.resume();
      }

      return;
    }

    this.#audioContext = new AudioContext();
    this.#audioSource = this.#audioContext.createMediaElementSource(this.#$audio);
    this.#analyser = this.#audioContext.createAnalyser();
    this.#analyser.fftSize = 1024;
    this.#analyser.smoothingTimeConstant = 0.7;
    this.#audioSource.connect(this.#analyser);
    this.#analyser.connect(this.#audioContext.destination);
  }
}
