import { CUT_STATE } from '../../../../../config/constants';
import * as CutService from '../../../../../services/CutService';
import { View } from '../../../../../lib';

/**
 * CutZoneOverlay - Visual overlay showing the cut zone selection
 *
 * Displays a colored rectangle over the track area to indicate
 * the region that will be cut. Updates in real-time during drag.
 * Attaches to the specific track zone being cut.
 *
 * In READY state, the overlay is clickable to confirm the cut.
 */
export default class CutZoneOverlay extends View {
  #onConfirmClick = null;

  constructor($parent, onConfirmClick = null) {
    super($parent);
    this.$overlay = null;
    this.$startMarker = null;
    this.$endMarker = null;
    this.$currentZoneRoot = null;
    this.unsubscribe = null;
    this.#onConfirmClick = onConfirmClick;
    this.mount();
  }

  render() {
    this.$overlay = document.createElement('div');
    this.$overlay.className = 'cut-zone-overlay hide';

    this.$startMarker = document.createElement('div');
    this.$startMarker.className = 'cut-zone-marker cut-zone-start hide';

    this.$endMarker = document.createElement('div');
    this.$endMarker.className = 'cut-zone-marker cut-zone-end hide';

    // Use mousedown to intercept before TracksEventHandler
    this.$overlay.addEventListener('mousedown', this.#handleOverlayMouseDown);
    this.unsubscribe = CutService.onChange(this.handleStateChange.bind(this));
  }

  #handleOverlayMouseDown = event => {
    if (CutService.isReady() && this.#onConfirmClick) {
      event.stopPropagation();
      event.preventDefault();
      this.#onConfirmClick();
    }
  };

  handleStateChange({ state, cutZone }) {
    if (state === CUT_STATE.INACTIVE || state === CUT_STATE.ACTIVE) {
      this.hide();
      this.detachFromZone();

      return;
    }

    if (!cutZone || !cutZone.zone) {
      this.hide();

      return;
    }

    this.attachToZone(cutZone.zone);
    this.updatePosition(cutZone);
    this.updateState(state);
    this.show();
  }

  attachToZone(zone) {
    const $zoneRoot = zone.getRoot?.();

    if (!$zoneRoot || $zoneRoot === this.$currentZoneRoot) {
      return;
    }

    this.detachFromZone();
    this.$currentZoneRoot = $zoneRoot;

    const $zoneContent = $zoneRoot.querySelector('.zone-content') || $zoneRoot;
    $zoneContent.appendChild(this.$overlay);
    $zoneContent.appendChild(this.$startMarker);
    $zoneContent.appendChild(this.$endMarker);
  }

  detachFromZone() {
    this.$overlay?.remove();
    this.$startMarker?.remove();
    this.$endMarker?.remove();
    this.$currentZoneRoot = null;
  }

  updatePosition(cutZone) {
    const { startPosX, endPosX, zone } = cutZone;
    const zoneStartPosX = zone.getStartPosX?.() || 0;
    const relativeStartX = startPosX - zoneStartPosX;
    const relativeEndX = endPosX - zoneStartPosX;

    const left = Math.round(Math.min(relativeStartX, relativeEndX));
    const width = Math.max(0, Math.round(Math.abs(relativeEndX - relativeStartX)));

    this.$overlay.style.left = `${left}px`;
    this.$overlay.style.width = `${width}px`;

    this.$startMarker.style.left = `${Math.round(relativeStartX)}px`;
    this.$endMarker.style.left = `${Math.round(relativeEndX)}px`;
  }

  updateState(state) {
    this.$overlay.classList.remove('pending', 'dragging', 'ready');
    this.$overlay.classList.add(state);

    this.$startMarker.classList.remove('pending', 'dragging', 'ready');
    this.$startMarker.classList.add(state);

    this.$endMarker.classList.remove('pending', 'dragging', 'ready');
    this.$endMarker.classList.add(state);
  }

  show() {
    this.$overlay.classList.remove('hide');
    this.$startMarker.classList.remove('hide');
    this.$endMarker.classList.remove('hide');
  }

  hide() {
    this.$overlay.classList.add('hide');
    this.$startMarker.classList.add('hide');
    this.$endMarker.classList.add('hide');
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.$overlay?.removeEventListener('mousedown', this.#handleOverlayMouseDown);
    this.$overlay?.remove();
    this.$startMarker?.remove();
    this.$endMarker?.remove();
    this.#onConfirmClick = null;
  }
}
