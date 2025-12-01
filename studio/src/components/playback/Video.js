import Mediator from '../Mediator';
import { getRouteUrl, getVideoSrc, getTrackUrl } from '../../services/workspace';
import { RESIZE_BOUNDS } from '../../config/ui';
import { MasterClock, View } from '../../lib';

export default class Video extends View {
  #$player = null;
  #$source = null;
  #$resizer = null;
  #hasVideo = false;
  #displayAspectRatio = '';
  #rafId = null;
  #initialOffset = 0;

  constructor($parent) {
    super($parent);
    this.mount();
  }

  template() {
    return `
      <div class="content-video hide">
        <video data-ref="player" id="my-video" class="viewer" crossorigin="anonymous">
          <source data-ref="source" id="my-video-src" src="#" type="video/mp4">
        </video>
        <div data-ref="resizer" class="resizer" title="Resize video">
          <i class="bi bi-arrows-angle-expand"></i>
        </div>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);

    this.#$player = this.$node.querySelector('[data-ref="player"]');
    this.#$player.volume = 0;
    this.#$source = this.$node.querySelector('[data-ref="source"]');
    this.#$resizer = this.$node.querySelector('[data-ref="resizer"]');
  }

  onMount() {
    Mediator.registerVideo(this);
    this.#$resizer.addEventListener('mousedown', this.#handleResizerMouseDown);
  }

  hasVideo() {
    return this.#hasVideo;
  }

  show() {
    this.$node.classList.remove('hide');
  }

  hide() {
    this.$node.classList.add('hide');
  }

  // ============================================================================
  // Resize
  // ============================================================================

  #handleResizerMouseDown = e => {
    e.preventDefault();
    const rect = this.$node.getBoundingClientRect();
    this.#initialOffset = e.clientY - rect.bottom;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'nwse-resize';
    document.addEventListener('mouseup', this.#handleResizerMouseUp, true);
    document.addEventListener('mousemove', this.#handleResizerMouseMove, true);
  };

  #handleResizerMouseMove = e => {
    e.stopPropagation();
    e.preventDefault();

    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
    }

    this.#rafId = requestAnimationFrame(() => {
      const rect = this.$node.getBoundingClientRect();
      const newHeight = e.clientY - rect.top - this.#initialOffset;
      Mediator.onResize(newHeight);
      this.#rafId = null;
    });
  };

  #handleResizerMouseUp = () => {
    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }

    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', this.#handleResizerMouseMove, true);
    document.removeEventListener('mouseup', this.#handleResizerMouseUp, true);
  };

  resize(y = 0) {
    if (!this.#displayAspectRatio) {
      return;
    }

    const bounds = RESIZE_BOUNDS;
    const [w, h] = this.#displayAspectRatio.split(':');
    const aspectRatio = h / w;

    const effectiveY = y === 0 ? bounds.defaultHeight : Math.max(y, bounds.minHeight);
    let width = effectiveY / aspectRatio;
    let height = width * aspectRatio;

    const maxWidth = document.body.offsetWidth * 0.6;
    if (width > maxWidth) {
      width = maxWidth;
      height = width * aspectRatio;
    }

    this.$node.style.width = width + 'px';
    this.$node.style.height = height + 'px';
  }

  // ============================================================================
  // Load
  // ============================================================================

  async load() {
    try {
      const res = await window.fetch(getRouteUrl('video'));

      if (!res.ok) {
        this.#hasVideo = false;

        throw Error('no video found');
      }

      const response = await res.json();

      if (Object.keys(response).length === 0) {
        this.#hasVideo = false;

        throw Error('no video found');
      }

      this.#hasVideo = true;
      this.show();

      const duration = response.duration / 1000;
      this.#displayAspectRatio = response.displayAspectRatio;

      this.#$source.src = getVideoSrc();
      this.#$player.load();
      this.resize();

      MasterClock.registerVideo(this.#$player);

      const tracks =
        response.isMuteVideo === true
          ? []
          : [
              {
                id: '-1',
                durationTime: duration,
                label: 'audio',
                src: getTrackUrl(),
                start: 0,
                startTime: 0,
                volumeValues: []
              }
            ];

      return {
        url: getVideoSrc(),
        duration,
        displayAspectRatio: this.#displayAspectRatio,
        tracks
      };
    } catch (err) {
      this.#hasVideo = false;
      this.hide();

      throw err;
    }
  }

  // ============================================================================
  // Playback
  // ============================================================================

  getDuration() {
    return parseFloat(this.#$player.duration);
  }

  setCurrentTime(time) {
    if (isNaN(time) || time < 0) {
      throw new Error('wrong input: current time is ' + time);
    }

    this.#$player.currentTime = time;

    return true;
  }

  getCurrentTime() {
    return this.#$player.currentTime;
  }

  isPlaying() {
    return !this.#$player.paused;
  }

  play() {
    this.#$player.play();

    return true;
  }

  stop(time) {
    if (isNaN(time) || time < 0) {
      throw new Error('wrong input: current time is ' + time);
    }

    this.#$player.pause();
    this.#$player.currentTime = time;

    return true;
  }

  getData() {
    return {
      src: getVideoSrc(),
      duration: this.getDuration(),
      displayAspectRatio: this.#displayAspectRatio
    };
  }

  reset() {
    this.#$player.pause();
    this.#$player.currentTime = 0;
    this.#$source.src = '';
    this.#$player.load();
    this.#hasVideo = false;
    this.#displayAspectRatio = '';
    this.hide();
  }
}
