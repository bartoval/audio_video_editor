/**
 * WaveformPlayer - Canvas-based waveform visualization with integrated audio playback
 */
export default class WaveformPlayer {
  #$container = null;
  #$canvas = null;
  #$audio = null;
  #ctx = null;

  #waveformPath = null;
  #progress = 0;
  #duration = 0;
  #isPlaying = false;

  #onPlay = null;
  #onPause = null;
  #onEnded = null;
  #onTimeUpdate = null;
  #onSeek = null;

  constructor($parent, options = {}) {
    const { onPlay, onPause, onEnded, onTimeUpdate, onSeek } = options;

    this.#onPlay = onPlay || null;
    this.#onPause = onPause || null;
    this.#onEnded = onEnded || null;
    this.#onTimeUpdate = onTimeUpdate || null;
    this.#onSeek = onSeek || null;

    this.#render($parent);
    this.#createAudioElement();
    this.#bindEvents();
  }

  #render($parent) {
    this.#$container = document.createElement('div');
    this.#$container.className = 'waveform-player';

    this.#$canvas = document.createElement('canvas');
    this.#$canvas.className = 'waveform-player-canvas';
    this.#resizeCanvas();

    this.#$container.appendChild(this.#$canvas);
    $parent.appendChild(this.#$container);

    this.#ctx = this.#$canvas.getContext('2d');
  }

  #resizeCanvas() {
    const parentWidth = this.#$container?.clientWidth || 240;
    const parentHeight = this.#$container?.clientHeight || 48;
    const ratio = window.devicePixelRatio || 1;

    this.#$canvas.width = Math.max(240, Math.floor(parentWidth * ratio));
    this.#$canvas.height = Math.max(48, Math.floor(parentHeight * ratio));
    this.#$canvas.style.width = '100%';
    this.#$canvas.style.height = '100%';
  }

  #createAudioElement() {
    this.#$audio = document.createElement('audio');
    this.#$audio.preload = 'none';
    this.#$audio.crossOrigin = 'anonymous';
  }

  #bindEvents() {
    this.#$canvas.addEventListener('click', this.#handleCanvasClick);

    this.#$audio.addEventListener('ended', this.#handleEnded);
    this.#$audio.addEventListener('timeupdate', this.#handleTimeUpdate);
    this.#$audio.addEventListener('play', this.#handlePlay);
    this.#$audio.addEventListener('pause', this.#handlePause);
  }

  #handleCanvasClick = event => {
    if (!this.#duration) {
      return;
    }

    const rect = this.#$canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const ratio = clickX / rect.width;
    const seekTime = ratio * this.#duration;

    this.seek(seekTime);
    this.#onSeek?.(seekTime);
  };

  #handleEnded = () => {
    this.#isPlaying = false;
    this.#progress = 0;
    this.#draw();
    this.#onEnded?.();
  };

  #handleTimeUpdate = () => {
    if (!this.#duration || this.#duration <= 0) {
      return;
    }

    const currentTime = this.#$audio.currentTime;
    this.#progress = Math.max(0, Math.min(1, currentTime / this.#duration));
    this.#draw();
    this.#onTimeUpdate?.(currentTime);
  };

  #handlePlay = () => {
    this.#isPlaying = true;
    this.#onPlay?.();
  };

  #handlePause = () => {
    this.#isPlaying = false;
    this.#onPause?.();
  };

  async setSource(url, waveformData, duration) {
    this.#resizeCanvas();
    this.#duration = duration || 0;
    this.#waveformPath = waveformData || null;
    this.#progress = 0;

    if (url) {
      this.#$audio.src = url;
      this.#$audio.load();

      if (!waveformData) {
        await this.#generateWaveformFromUrl(url);
      }
    }

    this.#draw();
  }

  async #generateWaveformFromUrl(url) {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      this.#waveformPath = this.#extractWaveformData(audioBuffer);
      this.#duration = audioBuffer.duration;
      this.#draw();

      audioContext.close();
    } catch (error) {
      console.warn('Failed to generate waveform:', error);
    }
  }

  #extractWaveformData(audioBuffer) {
    const { numberOfChannels, duration } = audioBuffer;
    const channelData = [];

    for (let ch = 0; ch < numberOfChannels; ch++) {
      channelData.push(audioBuffer.getChannelData(ch));
    }

    const samples = channelData[0]?.length || 0;
    const numSamples = Math.max(1, this.#$canvas.width);
    const sampleSize = samples / numSamples;
    const sampleStep = sampleSize < 10 ? 1 : Math.max(1, Math.floor(sampleSize / 4));
    const path = new Array(numSamples * 2);

    for (let i = 0; i < numSamples; i++) {
      const start = Math.floor(i * sampleSize);
      const end = Math.min(samples, Math.floor(start + sampleSize));
      let min = 0;
      let max = 0;

      for (let ch = 0; ch < numberOfChannels; ch++) {
        const data = channelData[ch];

        for (let j = start; j < end; j += sampleStep) {
          const sample = data[j];

          if (sample > max) max = sample;
          if (sample < min) min = sample;
        }
      }

      const maxIdx = i * 2;
      path[maxIdx] = { x: i, y: max };
      path[maxIdx + 1] = { x: i, y: min };
    }

    // Duration can be missing when called without an URL-provided duration
    this.#duration = this.#duration || duration || 0;

    return path;
  }

  setWaveformData(waveformData) {
    this.#waveformPath = waveformData || null;
    this.#draw();
  }

  async generateWaveformFromUrl(url, duration) {
    this.#resizeCanvas();
    this.#duration = duration || 0;
    this.#progress = 0;

    if (url) {
      await this.#generateWaveformFromUrl(url);
    }
  }

  setProgress(currentTime) {
    if (this.#duration <= 0) {
      return;
    }

    this.#progress = Math.max(0, Math.min(1, currentTime / this.#duration));
    this.#draw();
  }

  play() {
    if (!this.#$audio.src) {
      return;
    }

    this.#$audio.play();
  }

  pause() {
    this.#$audio.pause();
  }

  stop() {
    this.#$audio.pause();
    this.#$audio.currentTime = 0;
    this.#isPlaying = false;
    this.#progress = 0;
    this.#draw();
  }

  toggle() {
    if (this.#isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  seek(time) {
    if (!this.#$audio) {
      return;
    }

    const clampedTime = Math.max(0, Math.min(time, this.#duration));
    this.#$audio.currentTime = clampedTime;
    this.#progress = this.#duration > 0 ? clampedTime / this.#duration : 0;
    this.#draw();
  }

  isPlaying() {
    return this.#isPlaying;
  }

  getCurrentTime() {
    return this.#$audio?.currentTime || 0;
  }

  getDuration() {
    return this.#duration;
  }

  setPlaybackRate(rate) {
    if (this.#$audio) {
      this.#$audio.playbackRate = rate;
    }
  }

  clear() {
    this.#waveformPath = null;
    this.#progress = 0;
    this.#duration = 0;

    if (this.#ctx) {
      this.#ctx.clearRect(0, 0, this.#$canvas.width, this.#$canvas.height);
    }
  }

  getElement() {
    return this.#$container;
  }

  setSize(width, height) {
    if (this.#$canvas) {
      const ratio = window.devicePixelRatio || 1;
      this.#$canvas.width = Math.floor(width * ratio);
      this.#$canvas.height = Math.floor(height * ratio);
      this.#$canvas.style.width = `${width}px`;
      this.#$canvas.style.height = `${height}px`;
      this.#draw();
    }
  }

  #getCssVar(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  #draw() {
    const ctx = this.#ctx;
    const width = this.#$canvas.width;
    const height = this.#$canvas.height;
    const halfHeight = height / 2;
    const yScale = 1.5;

    ctx.clearRect(0, 0, width, height);

    if (!this.#waveformPath || this.#waveformPath.length === 0) {
      return;
    }

    const progressX = width * this.#progress;
    const path = this.#waveformPath;
    const scaleX = width / (path[path.length - 1]?.x || width);

    // Design tokens (styles/tokens.css): played = accent, not yet played = neutral waveform
    const playedColor = this.#getCssVar('--accent-default', '#8b80ff');
    const unplayedColor = this.#getCssVar('--waveform', '#727b87');

    // Draw played portion
    if (progressX > 0) {
      ctx.beginPath();
      ctx.moveTo(0, halfHeight);

      for (const point of path) {
        const scaledX = point.x * scaleX;

        if (scaledX > progressX) {
          break;
        }

        const yScaled = Math.max(-1, Math.min(1, point.y * yScale));
        ctx.lineTo(scaledX, yScaled * halfHeight + halfHeight);
      }

      ctx.lineTo(progressX, halfHeight);
      ctx.strokeStyle = playedColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw unplayed portion (white)
    ctx.beginPath();
    ctx.moveTo(progressX, halfHeight);

    let started = false;

    for (const point of path) {
      const scaledX = point.x * scaleX;

      if (scaledX < progressX) {
        continue;
      }

      const yScaled = Math.max(-1, Math.min(1, point.y * yScale));

      if (!started) {
        ctx.moveTo(scaledX, yScaled * halfHeight + halfHeight);
        started = true;
      } else {
        ctx.lineTo(scaledX, yScaled * halfHeight + halfHeight);
      }
    }

    ctx.lineTo(width, halfHeight);
    ctx.strokeStyle = unplayedColor;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  destroy() {
    this.#$canvas?.removeEventListener('click', this.#handleCanvasClick);
    this.#$audio?.removeEventListener('ended', this.#handleEnded);
    this.#$audio?.removeEventListener('timeupdate', this.#handleTimeUpdate);
    this.#$audio?.removeEventListener('play', this.#handlePlay);
    this.#$audio?.removeEventListener('pause', this.#handlePause);

    this.stop();

    this.#$container?.remove();
    this.#$container = null;
    this.#$canvas = null;
    this.#$audio = null;
    this.#ctx = null;
    this.#waveformPath = null;

    this.#onPlay = null;
    this.#onPause = null;
    this.#onEnded = null;
    this.#onTimeUpdate = null;
    this.#onSeek = null;
  }
}
