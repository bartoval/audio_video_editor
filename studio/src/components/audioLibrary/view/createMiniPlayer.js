import { createElement, WaveformPlayer } from '../../../lib';
import { CSS_CLASS } from '../../../config/ui';

export function createMiniPlayer($parent) {
  let handlers = {};
  let waveformPlayer = null;

  const $el = createElement('div', {
    className: 'library-mini-player',
    html: `
      <div class="mini-player-content">
        <button class="btn btn-sm btn-outline-info mini-player-pause" title="Pause">
          <i class="bi bi-pause-fill"></i>
        </button>
        <span class="mini-player-track text-truncate"></span>
        <div class="mini-player-waveform-container"></div>
        <button class="btn btn-sm btn-outline-secondary mini-player-goto" title="Go to track">
          <i class="bi bi-arrow-up-circle"></i>
        </button>
      </div>
    `,
    parent: $parent
  });

  const $track = $el.querySelector('.mini-player-track');
  const $pauseBtn = $el.querySelector('.mini-player-pause');
  const $waveformContainer = $el.querySelector('.mini-player-waveform-container');

  waveformPlayer = new WaveformPlayer($waveformContainer, {
    onSeek: time => handlers.onSeek?.(time)
  });

  $pauseBtn.addEventListener('click', () => handlers.onPause?.());
  $el.querySelector('.mini-player-goto').addEventListener('click', () => handlers.onGoTo?.());

  return {
    el: $el,
    bind(newHandlers) {
      handlers = newHandlers;
    },

    show(trackName) {
      $track.textContent = trackName;
      $el.classList.add(CSS_CLASS.VISIBLE);
    },

    hide() {
      $el.classList.remove(CSS_CLASS.VISIBLE);
    },

    updateState(isPlaying) {
      const $icon = $pauseBtn.querySelector('i');
      $icon.className = isPlaying ? 'bi bi-pause-fill' : 'bi bi-play-fill';
      $pauseBtn.title = isPlaying ? 'Pause' : 'Play';
    },

    async setWaveformSource(url, duration, peaks = null) {
      if (peaks) {
        waveformPlayer?.setPeaks(peaks, duration);

        return;
      }

      await waveformPlayer?.generateWaveformFromUrl(url, duration);
    },

    setWaveformProgress(currentTime) {
      waveformPlayer?.setProgress(currentTime);
    },

    clearWaveform() {
      waveformPlayer?.clear();
    },

    destroy() {
      waveformPlayer?.destroy();
      waveformPlayer = null;
    }
  };
}
