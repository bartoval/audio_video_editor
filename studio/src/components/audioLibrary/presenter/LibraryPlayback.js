/**
 * LibraryPlayback - handles audio playback and oscilloscope visualization
 */
import LibraryPlaybackEngine from '../LibraryPlaybackEngine';
import { Oscilloscope } from '../../../lib';
import { audioRecord, audioUrl } from '../../../services/offline/LocalMedia';
import * as WaveformPeaks from '../../../services/offline/WaveformPeaks';
import { getUuid } from '../../../services/workspace';

export default class LibraryPlayback {
  #player = null;
  #listOscilloscope = null;
  #currentPlayingId = null;
  #view = null;

  constructor() {
    this.#player = new LibraryPlaybackEngine();

    this.#listOscilloscope = new Oscilloscope({
      fftSize: 128,
      smoothing: 0.7,
      color: 'var(--accent-light)'
    });
  }

  setView(view) {
    this.#view = view;
  }

  getCurrentPlayingId() {
    return this.#currentPlayingId;
  }

  setCurrentPlayingId(id) {
    this.#currentPlayingId = id;
  }

  getAnalyser() {
    return this.#player.getAnalyser();
  }

  async play(id, item) {
    const currentId = this.#currentPlayingId;

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

    if (currentId) {
      this.#player.stop();
      this.#listOscilloscope.stop();
      this.#view?.setPlayButtonState(currentId, false);
    }

    this.#currentPlayingId = id;

    this.#player.play(id, {
      onReady: async duration => {
        requestAnimationFrame(() => {
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

        // Stored peaks draw at once; without them the file is decoded once and its
        // peaks kept, so the next play is immediate.
        const uuid = getUuid();
        const peaks = await WaveformPeaks.ensure(
          uuid,
          id,
          async () => (await audioRecord(uuid, id))?.blob
        ).catch(() => null);

        if (this.#currentPlayingId !== id) {
          return;
        }

        if (peaks) {
          this.#view?.setMiniPlayerWaveform(null, duration, peaks);
        } else {
          this.#view?.setMiniPlayerWaveform(await audioUrl(id), duration);
        }
      },
      onTimeUpdate: currentTime => {
        this.#view?.setMiniPlayerProgress(currentTime);
      },
      onEnded: () => {
        this.#view?.setPlayButtonState(id, false);
        this.#view?.hideMiniPlayer();
        this.#view?.clearMiniPlayerWaveform();
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

  seek(time) {
    this.#player.seek(time);
  }

  goToCurrentTrack() {
    if (this.#currentPlayingId) {
      this.#view?.scrollToItem(this.#currentPlayingId);
    }
  }
}
