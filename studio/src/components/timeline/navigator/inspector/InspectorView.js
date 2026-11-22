import { View, formatDuration, WaveformPlayer } from '../../../../lib';

/** Pure view for Inspector - handles DOM rendering and user interactions */
export default class InspectorView extends View {
  #$parent = null;
  #$panel = null;
  #$header = null;
  #$closeBtn = null;
  #$pitchInput = null;
  #$pitchValue = null;
  #$speedInput = null;
  #$speedValue = null;
  #$gainInput = null;
  #$gainValue = null;
  #$panInput = null;
  #$panValue = null;
  #$trackInfo = null;
  #$playBtn = null;
  #$waveformContainer = null;
  #waveformPlayer = null;

  #isDragging = false;
  /** Docked inside the side panel: no drag, no floating position, no close button */
  #isDocked = false;
  #dragOffset = { x: 0, y: 0 };
  #hasSelection = false;

  #onClose = null;
  #onPitchPreview = null;
  #onPitchChange = null;
  #onSpeedChange = null;
  #onGainChange = null;
  #onPanChange = null;
  #onPlayClick = null;
  #onSeek = null;
  #onTimeUpdate = null;
  #onPlayStateChange = null;

  constructor($parent, callbacks = {}) {
    super($parent);
    this.#$parent = $parent;

    this.#onClose = callbacks.onClose || (() => {});
    this.#onPitchPreview = callbacks.onPitchPreview || (() => {});
    this.#onPitchChange = callbacks.onPitchChange || (() => {});
    this.#onSpeedChange = callbacks.onSpeedChange || (() => {});
    this.#onGainChange = callbacks.onGainChange || (() => {});
    this.#onPanChange = callbacks.onPanChange || (() => {});
    this.#onPlayClick = callbacks.onPlayClick || (() => {});
    this.#onSeek = callbacks.onSeek || (() => {});
    this.#onTimeUpdate = callbacks.onTimeUpdate || (() => {});
    this.#onPlayStateChange = callbacks.onPlayStateChange || (() => {});

    this.mount();
  }

  template() {
    return `
      <div class="inspector-panel">
        <div class="inspector-header">
          <span class="inspector-title">Inspector</span>
          <button class="inspector-close" title="Close (I)" aria-label="Close inspector">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="inspector-body">
          <div class="inspector-section">
            <div class="inspector-player">
              <button data-ref="playBtn" class="inspector-play-btn" disabled aria-label="Play preview">
                <i class="bi bi-play-fill"></i>
              </button>
              <div data-ref="waveformContainer" class="inspector-waveform-container"></div>
            </div>
          </div>
          <div class="inspector-section">
            <div class="inspector-row-inline">
              <label class="inspector-label-inline">Pitch</label>
              <input data-ref="pitch" type="range" class="form-range inspector-range" min="-12" max="12" value="0" disabled>
              <span data-ref="pitchValue" class="inspector-value">0</span>
            </div>
            <div class="inspector-row-inline">
              <label class="inspector-label-inline">Speed</label>
              <input data-ref="speed" type="range" class="form-range inspector-range" min="50" max="200" value="100" disabled>
              <span data-ref="speedValue" class="inspector-value">100%</span>
            </div>
            <div class="inspector-row-inline">
              <label class="inspector-label-inline">Volume</label>
              <input data-ref="gain" type="range" class="form-range inspector-range" min="0" max="100" value="100" disabled>
              <span data-ref="gainValue" class="inspector-value">100%</span>
            </div>
            <div class="inspector-row-inline">
              <label class="inspector-label-inline">Pan</label>
              <input data-ref="pan" type="range" class="form-range inspector-range" min="-100" max="100" value="0" disabled>
              <span data-ref="panValue" class="inspector-value">C</span>
            </div>
          </div>
          <div data-ref="trackInfo">
            <div class="inspector-info-placeholder">
              <i class="bi bi-music-note"></i>
              <span>Select a track</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.#$panel = wrapper.firstElementChild;
    this.#isDocked = this.#$parent.classList.contains('side-panel__pane');
    this.#$panel.classList.toggle('inspector-panel--docked', this.#isDocked);
    this.#$parent.appendChild(this.#$panel);

    this.#$header = this.#$panel.querySelector('.inspector-header');
    this.#$closeBtn = this.#$header.querySelector('button');
    this.#$pitchInput = this.#$panel.querySelector('[data-ref="pitch"]');
    this.#$pitchValue = this.#$panel.querySelector('[data-ref="pitchValue"]');
    this.#$speedInput = this.#$panel.querySelector('[data-ref="speed"]');
    this.#$speedValue = this.#$panel.querySelector('[data-ref="speedValue"]');
    this.#$gainInput = this.#$panel.querySelector('[data-ref="gain"]');
    this.#$gainValue = this.#$panel.querySelector('[data-ref="gainValue"]');
    this.#$panInput = this.#$panel.querySelector('[data-ref="pan"]');
    this.#$panValue = this.#$panel.querySelector('[data-ref="panValue"]');
    this.#$trackInfo = this.#$panel.querySelector('[data-ref="trackInfo"]');
    this.#$playBtn = this.#$panel.querySelector('[data-ref="playBtn"]');
    this.#$waveformContainer = this.#$panel.querySelector('[data-ref="waveformContainer"]');

    this.#waveformPlayer = new WaveformPlayer(this.#$waveformContainer, {
      onSeek: time => this.#onSeek(time),
      onTimeUpdate: time => this.#onTimeUpdate(time),
      onPlay: () => this.#onPlayStateChange(true),
      onPause: () => this.#onPlayStateChange(false),
      onEnded: () => this.#onPlayStateChange(false)
    });
  }

  onMount() {
    this.#$closeBtn.addEventListener('click', this.#handleClose);
    this.#$pitchInput.addEventListener('input', this.#handlePitchInput);
    this.#$pitchInput.addEventListener('change', this.#handlePitchCommit);
    this.#$speedInput.addEventListener('input', this.#handleSpeedInput);
    this.#$gainInput.addEventListener('input', this.#handleGainInput);
    this.#$panInput.addEventListener('input', this.#handlePanInput);
    this.#$playBtn.addEventListener('click', this.#handlePlayClick);

    if (!this.#isDocked) {
      this.#$header.addEventListener('mousedown', this.#handleDragStart);
      document.addEventListener('mousemove', this.#handleDragMove);
      document.addEventListener('mouseup', this.#handleDragEnd);
    }
  }

  onDestroy() {
    this.#$closeBtn?.removeEventListener('click', this.#handleClose);
    this.#$pitchInput?.removeEventListener('input', this.#handlePitchInput);
    this.#$pitchInput?.removeEventListener('change', this.#handlePitchCommit);
    this.#$speedInput?.removeEventListener('input', this.#handleSpeedInput);
    this.#$gainInput?.removeEventListener('input', this.#handleGainInput);
    this.#$panInput?.removeEventListener('input', this.#handlePanInput);
    this.#$playBtn?.removeEventListener('click', this.#handlePlayClick);
    this.#$header?.removeEventListener('mousedown', this.#handleDragStart);
    document.removeEventListener('mousemove', this.#handleDragMove);
    document.removeEventListener('mouseup', this.#handleDragEnd);

    this.#waveformPlayer?.destroy();
    this.#waveformPlayer = null;
    this.#$panel?.remove();
    super.onDestroy();
  }

  open() {
    this.#$panel?.classList.add('open');
  }

  close() {
    this.#$panel?.classList.remove('open');
  }

  setWaveformSource(url, waveformData, duration) {
    const containerWidth = this.#$waveformContainer.clientWidth || 240;
    const containerHeight = this.#$waveformContainer.clientHeight || 48;
    this.#waveformPlayer?.setSize(containerWidth, containerHeight);
    this.#waveformPlayer?.setSource(url, waveformData, duration);
  }

  playWaveform() {
    this.#waveformPlayer?.play();
  }

  pauseWaveform() {
    this.#waveformPlayer?.pause();
  }

  stopWaveform() {
    this.#waveformPlayer?.stop();
  }

  toggleWaveform() {
    this.#waveformPlayer?.toggle();
  }

  seekWaveform(time) {
    this.#waveformPlayer?.seek(time);
  }

  isWaveformPlaying() {
    return this.#waveformPlayer?.isPlaying() ?? false;
  }

  clearWaveform() {
    this.#waveformPlayer?.clear();
  }

  setWaveformPlaybackRate(rate) {
    this.#waveformPlayer?.setPlaybackRate(rate);
  }

  setState(state) {
    const { hasSelection, pitch, speed, gain, pan, trackInfo } = state;
    this.#hasSelection = hasSelection;

    this.#$pitchInput.disabled = !hasSelection;
    this.#$speedInput.disabled = !hasSelection;
    this.#$gainInput.disabled = !hasSelection;
    this.#$panInput.disabled = !hasSelection;
    this.#$playBtn.disabled = !hasSelection;

    this.#$pitchInput.value = pitch;
    this.#$pitchValue.textContent = pitch;

    this.#$speedInput.value = speed;
    this.#$speedValue.textContent = `${speed}%`;

    this.#$gainInput.value = gain;
    this.#$gainValue.textContent = `${gain}%`;

    this.#$panInput.value = pan;
    this.#$panValue.textContent = this.#formatPan(pan / 100);

    this.#$trackInfo.innerHTML = '';

    if (trackInfo) {
      this.#$trackInfo.appendChild(this.#createTrackInfo(trackInfo));
    } else {
      this.#$trackInfo.appendChild(this.#createPlaceholder());
    }
  }

  setPitchValue(value) {
    this.#$pitchValue.textContent = value;
  }

  setPlayState(isPlaying) {
    const $icon = this.#$playBtn?.querySelector('i');

    if ($icon) {
      $icon.className = isPlaying ? 'bi bi-pause-fill' : 'bi bi-play-fill';
    }
  }

  setLoadingState(isLoading) {
    const $icon = this.#$playBtn?.querySelector('i');

    if ($icon) {
      if (isLoading) {
        $icon.className = 'bi bi-hourglass-split';
        this.#$playBtn.disabled = true;
      } else {
        $icon.className = 'bi bi-play-fill';
        this.#$playBtn.disabled = !this.#hasSelection;
      }
    }
  }

  #handleClose = () => {
    this.#onClose();
  };

  #handlePitchInput = event => {
    this.#onPitchPreview(event.target.value);
  };

  #handlePitchCommit = event => {
    this.#onPitchChange(event.target.value);
  };

  #handleSpeedInput = event => {
    const { value } = event.target;
    this.#$speedValue.textContent = `${value}%`;
    this.#onSpeedChange(value);
  };

  #handleGainInput = event => {
    const { value } = event.target;
    this.#$gainValue.textContent = `${value}%`;
    this.#onGainChange(value);
  };

  #handlePanInput = event => {
    const { value } = event.target;
    this.#$panValue.textContent = this.#formatPan(Number(value) / 100);
    this.#onPanChange(value);
  };

  #handlePlayClick = () => {
    this.#onPlayClick();
  };

  #handleDragStart = event => {
    if (event.target.closest('button')) {
      return;
    }

    this.#isDragging = true;
    this.#$panel.style.cursor = 'grabbing';

    const rect = this.#$panel.getBoundingClientRect();
    this.#dragOffset.x = event.clientX - rect.left;
    this.#dragOffset.y = event.clientY - rect.top;

    event.preventDefault();
  };

  #handleDragMove = event => {
    if (!this.#isDragging) {
      return;
    }

    const posX = event.clientX - this.#dragOffset.x;
    const posY = event.clientY - this.#dragOffset.y;

    const maxX = window.innerWidth - this.#$panel.offsetWidth;
    const maxY = window.innerHeight - this.#$panel.offsetHeight;

    const boundedX = Math.max(0, Math.min(posX, maxX));
    const boundedY = Math.max(0, Math.min(posY, maxY));

    this.#$panel.style.left = `${boundedX}px`;
    this.#$panel.style.top = `${boundedY}px`;
    this.#$panel.style.right = 'auto';
    this.#$panel.style.bottom = 'auto';
  };

  #handleDragEnd = () => {
    if (!this.#isDragging) {
      return;
    }

    this.#isDragging = false;
    this.#$panel.style.cursor = '';
  };

  #formatPan(pan) {
    if (pan === 0) return 'C';
    if (pan < 0) return `L${Math.abs(Math.round(pan * 100))}`;

    return `R${Math.round(pan * 100)}`;
  }

  #createTrackInfo(info) {
    const { label, duration, start, end } = info;
    const $fragment = document.createDocumentFragment();

    $fragment.appendChild(this.#createInfoRow('Name', label, 'span'));
    $fragment.appendChild(this.#createInfoRow('Duration', formatDuration(duration), 'code'));
    $fragment.appendChild(this.#createInfoRow('Start', formatDuration(start), 'code'));
    $fragment.appendChild(this.#createInfoRow('End', formatDuration(end), 'code'));

    return $fragment;
  }

  #createInfoRow(labelText, valueText, valueTag = 'span') {
    const $row = document.createElement('div');
    $row.className = 'inspector-info-row';

    const $label = document.createElement('span');
    $label.className = 'inspector-info-label';
    $label.textContent = labelText;

    const $value = document.createElement(valueTag);
    $value.className = 'inspector-info-value';
    $value.textContent = valueText;

    $row.appendChild($label);
    $row.appendChild($value);

    return $row;
  }

  #createPlaceholder() {
    const $placeholder = document.createElement('div');
    $placeholder.className = 'inspector-info-placeholder';

    const $icon = document.createElement('i');
    $icon.className = 'bi bi-music-note';

    const $text = document.createElement('span');
    $text.textContent = 'Select a track';

    $placeholder.appendChild($icon);
    $placeholder.appendChild($text);

    return $placeholder;
  }
}
