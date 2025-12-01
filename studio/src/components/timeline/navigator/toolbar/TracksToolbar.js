import { THEME } from '../../../../config/ui';
import { TRACK_ACTION } from '../../../../constants';
import { View } from '../../../../lib';

const { btnVariant } = THEME;

/** Debounce helper */
const debounce = (fn, delay) => {
  let timeoutId;

  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

/** Tracks editing toolbar */
export default class TracksToolbar extends View {
  #$pitchInput = null;
  #$pitchValue = null;
  #zones = null;
  #zone = null;
  #commands = {};
  #cmdEnabled = '';
  #onAction = null;
  #debouncedPitch = null;

  constructor($parent, { onAction }) {
    super($parent);
    this.#onAction = onAction;
    this.#debouncedPitch = debounce(value => {
      if (this.#zone) {
        this.#zone.setPitch(value);
      }
    }, 400);
    this.mount();
  }

  template() {
    return `
      <div class="d-flex align-items-center gap-2">
        <div class="btn-group">
          <button data-action="${TRACK_ACTION.CUT}" class="btn btn-${btnVariant.primary}" title="Cut" disabled>
            <i class="bi bi-scissors"></i>
          </button>
          <button data-action="${TRACK_ACTION.COPY}" class="btn btn-${btnVariant.primary}" title="Copy" disabled>
            <i class="bi bi-copy"></i>
          </button>
          <button data-action="${TRACK_ACTION.REMOVE}" class="btn btn-${btnVariant.primary}" title="Delete" disabled>
            <i class="bi bi-trash"></i>
          </button>
        </div>
        <div class="btn-group ms-2">
          <button data-action="${TRACK_ACTION.VOLUME}" class="btn btn-${btnVariant.primary}" title="Volume envelope" disabled>
            <i class="bi bi-volume-up"></i>
          </button>
          <button data-action="${TRACK_ACTION.PAN}" class="btn btn-${btnVariant.primary}" title="Pan envelope" disabled>
            <i class="bi bi-arrows-expand"></i>
          </button>
        </div>
        <div class="d-flex align-items-center gap-2 ms-3">
          <small class="text-body-tertiary">Pitch</small>
          <input data-ref="pitch" type="range" class="form-range" style="width: 80px" min="-12" max="12" value="0" disabled>
          <small data-ref="pitchValue" class="text-body-secondary font-monospace" style="width: 2rem">0</small>
        </div>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);

    this.#$pitchInput = this.$node.querySelector('[data-ref="pitch"]');
    this.#$pitchValue = this.$node.querySelector('[data-ref="pitchValue"]');
  }

  onMount() {
    this.$node.addEventListener('click', this.#handleClick);
    this.#$pitchInput.addEventListener('input', this.#handlePitchInput);
  }

  set(zones) {
    const zone = zones?.getSelected() || null;

    if (zone && this.#zone !== zone) {
      this.#zones = zones;
      this.#zone = zone;
      this.#commands = { ...zone.getCommands() };

      // Sync button state with actual track visibility state
      const isVolumeVisible = zone.model?.isVolumeVisible?.() || false;
      const isPanVisible = zone.model?.isPanVisible?.() || false;
      this.#commands.volume = isVolumeVisible;
      this.#commands.pan = isPanVisible;
      this.#cmdEnabled = isVolumeVisible
        ? TRACK_ACTION.VOLUME
        : isPanVisible
          ? TRACK_ACTION.PAN
          : '';

      this.#updateUI();

      return true;
    }

    if (!zone) {
      this.#zone = null;
      this.#zones = null;
      this.#clean();
      this.#updateUI();
    }

    return true;
  }

  // ============================================================================
  // Private
  // ============================================================================

  #handleClick = e => {
    const $target = e.target.closest('[data-action]');

    if (!$target) {
      return;
    }

    e.stopPropagation();
    e.preventDefault();

    const { action } = $target.dataset;

    if (!this.#zone) {
      return;
    }

    switch (action) {
      case TRACK_ACTION.CUT:
        this.#enableCmd(action) ? this.#zones.startCutMode() : this.#zones.cancelCutMode();
        break;
      case TRACK_ACTION.COPY:
        this.#zones.clone();
        break;
      case TRACK_ACTION.REMOVE:
        this.#clean();
        this.#updateUI();
        this.#zones.remove();
        break;
      case TRACK_ACTION.VOLUME:
        this.#enableCmd(action) ? this.#zone.volumeShow() : this.#zone.volumeHide();
        break;
      case TRACK_ACTION.PAN:
        this.#enableCmd(action) ? this.#zone.panShow() : this.#zone.panHide();
        break;
    }

    this.#onAction?.(action, this.#zone);
  };

  #handlePitchInput = e => {
    this.#$pitchValue.textContent = e.target.value;
    this.#debouncedPitch(e.target.value);
  };

  #clean() {
    this.#zone = null;
    this.#cmdEnabled = '';
    Object.keys(this.#commands).forEach(key => {
      this.#commands[key] = false;
    });
  }

  #enableCmd(cmd) {
    this.#commands[this.#cmdEnabled] = !this.#commands[this.#cmdEnabled];
    this.#commands[cmd] = this.#cmdEnabled !== cmd;
    this.#cmdEnabled = this.#cmdEnabled !== cmd ? cmd : '';
    this.#updateUI();

    return this.#commands[cmd];
  }

  #updateUI() {
    const hasSelection = this.#zone !== null;

    this.$node.querySelectorAll('button, input').forEach($el => {
      $el.disabled = !hasSelection;
    });

    if (!hasSelection) {
      if (this.#$pitchInput) {
        this.#$pitchInput.value = 0;
        this.#$pitchValue.textContent = '0';
      }

      return;
    }

    this.$node.querySelectorAll('[data-action]').forEach($btn => {
      const { action } = $btn.dataset;
      $btn.classList.toggle('active', this.#commands[action]);
    });

    if (this.#$pitchInput) {
      const pitch = this.#zone.getPitch?.() || 0;
      this.#$pitchInput.value = pitch;
      this.#$pitchValue.textContent = pitch;
    }
  }
}
