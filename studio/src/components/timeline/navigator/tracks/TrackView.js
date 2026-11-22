// @ts-check

import { ZoneView } from '../../../core/zones';

/**
 * TrackView - extends ZoneView with audio track rendering
 */
export default class TrackView extends ZoneView {
  constructor($parent, config = {}) {
    super($parent, config);
    this.$content = null;
    this.$label = null;
  }

  template() {
    const { id, groupId } = this._config;

    return `
      <div class="zone track-content" data-zone-group="${groupId}" data-zone-id="${id}" data-testid="track-item">
        <div data-ref="content" class="zone-content" data-zone-id="${id}"></div>
        <div data-ref="label" class="track-label"></div>
        <i class="bi bi-volume-mute track-muted-badge" aria-label="Muted"></i>
        <div data-ref="gainIndicator" class="track-gain-indicator"></div>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$root = wrapper.firstElementChild;
    this.$parent.appendChild(this.$root);

    this.$content = this.$root.querySelector('[data-ref="content"]');
    this.$label = this.$root.querySelector('[data-ref="label"]');
    this.$gainIndicator = this.$root.querySelector('[data-ref="gainIndicator"]');
  }

  /** Update track with state */
  update(state) {
    this._updateStyle(state);
    this.#updateLabel(state.label);
  }

  /** Partial update on state change */
  patch(changes, state) {
    super.patch(changes, state);

    if (changes.label !== undefined) {
      this.#updateLabel(state.label);
    }

    if (changes.gain !== undefined) {
      this.#updateGainIndicator(state.gain);
    }

    if (changes.volumeVisible !== undefined) {
      const editing = state.volumeVisible;
      this.$root.classList.toggle('editing-envelope', editing);
    }
  }

  #updateLabel(label) {
    const text = label || '';
    this.$label.textContent = text;
    this.$label.title = text;
  }

  #updateGainIndicator(gain) {
    if (gain >= 1) {
      this.$gainIndicator.style.display = 'none';
      return;
    }
    this.$gainIndicator.style.display = 'block';
    this.$gainIndicator.style.height = `${(1 - gain) * 100}%`;
  }

  /** Muted tracks are dimmed and show a badge, so the state is visible without selecting */
  setMuted(muted) {
    this.$root.classList.toggle('muted', muted);
  }

  /** Get content container for controllers */
  getContent() {
    return this.$content;
  }

  /** Add selected state */
  select() {
    this.$root.classList.add('selected');
  }

  /** Remove selected state */
  deselect() {
    this.$root.classList.remove('selected');
  }

  /** Update label position to stay visible */
  updateStickyLabel(posX) {
    const trackLeft = this.$root.offsetLeft;
    const trackWidth = this.$root.offsetWidth;
    const labelWidth = this.$label.offsetWidth;

    const labelOffset = Math.max(0, posX - trackLeft);
    const maxOffset = trackWidth - labelWidth - 16;

    this.$label.style.left = `${Math.min(labelOffset + 8, maxOffset)}px`;
  }
}
