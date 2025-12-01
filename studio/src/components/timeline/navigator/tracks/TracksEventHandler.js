import { MARGIN } from '../../../../config/ui';
import { TRACKS } from '../../../../constants';
import { getTimeFromPosX, getTimeFormatted, generateUuid } from '../../../../lib';

const { DRAG_THROTTLE_MS, TOOLTIP_THROTTLE_MS } = TRACKS;

/**
 * TracksEventHandler - handles all DOM events for tracks container
 *
 * Manages:
 * - Drag operations (move, resize, volume, pan)
 * - Drop (from library)
 * - Tooltip display
 * - Cut mode interactions
 * - Row change during drag
 */
export default class TracksEventHandler {
  #container = null;
  #controller = null;
  #$tracks = null;
  #offsetLeft = 0;

  // Drag state
  #activeDragZone = null;
  #activeEnvelopeZone = null;
  #activeEnvelopeRect = null;
  #lastDragTime = 0;
  #isMoveDrag = false;
  #$rowDropIndicator = null;

  // Tooltip state
  #$tooltip = null;
  #lastTooltipTime = 0;

  constructor(container, controller, $tracks) {
    this.#container = container;
    this.#controller = controller;
    this.#$tracks = $tracks;
    this.#offsetLeft = $tracks.parentElement.offsetLeft + MARGIN;

    this.#bindEvents();
  }

  // ============================================================================
  // Event Binding
  // ============================================================================

  #bindEvents() {
    this.#$tracks.addEventListener('dragover', e => e.preventDefault());
    this.#$tracks.addEventListener('drop', this.#handleDrop);
    this.#$tracks.addEventListener('mousedown', this.#handleMouseDown);
    this.#$tracks.addEventListener('mousemove', this.#handleMouseMove);
    this.#$tracks.addEventListener('mouseleave', this.#hideTooltip);
  }

  // ============================================================================
  // Mouse Down - Drag Start
  // ============================================================================

  #handleMouseDown = event => {
    event.preventDefault();
    event.stopPropagation();

    const $node = event.target;
    const $zoneNode = $node.closest('[data-zone-id]');
    const id = $zoneNode ? $zoneNode.getAttribute('data-zone-id') : null;
    const previousZone = this.#controller.getSelected();
    const posX = this.#getPosX(event);

    if (!id) {
      return;
    }

    // Handle cut mode click
    if (this.#container.isCutMode && previousZone !== null && String(previousZone.getId()) === id) {
      this.#container.handleCutClick(posX);

      return;
    }

    const clickedZone = this.#controller.getChild(id);

    if (!clickedZone) {
      return;
    }

    // Cleanup previous drag
    if (this.#activeDragZone) {
      this.#activeDragZone.dragStop();
      this.#activeDragZone = null;
    }

    document.removeEventListener('mousemove', this.#handleDrag, false);
    document.removeEventListener('mouseup', this.#handleDragEnd, false);

    this.#lastDragTime = 0;
    this.#activeDragZone = clickedZone;

    // Determine drag type
    const isEditingEnvelope = clickedZone.isEditingEnvelope();
    const $panZone = $node.closest('.pan-zone');
    const $volumeZone = $node.closest('.volume-zone');
    let posY = 0;

    if ($panZone) {
      this.#activeEnvelopeRect = $panZone.getBoundingClientRect();
      posY = event.clientY - this.#activeEnvelopeRect.top;
    } else if ($volumeZone) {
      this.#activeEnvelopeRect = $volumeZone.getBoundingClientRect();
      posY = event.clientY - this.#activeEnvelopeRect.top;
    }

    if ($node.classList.contains('hook-resize')) {
      clickedZone.dragStart('resize');
      this.#isMoveDrag = false;
    } else if ($panZone && isEditingEnvelope) {
      this.#activeEnvelopeZone = $panZone;
      clickedZone.setPanStart(posX, posY);
      this.#isMoveDrag = false;
    } else if ($volumeZone && isEditingEnvelope) {
      this.#activeEnvelopeZone = $volumeZone;
      clickedZone.setVolumeStart(posX, posY);
      this.#isMoveDrag = false;
    } else {
      clickedZone.dragStart('move', posX);
      this.#isMoveDrag = true;
    }

    document.addEventListener('mousemove', this.#handleDrag, false);
    document.addEventListener('mouseup', this.#handleDragEnd, false);

    // Select if different
    if (previousZone === null || String(previousZone.getId()) !== id) {
      this.#container.select(id);
    }
  };

  // ============================================================================
  // Drag
  // ============================================================================

  #handleDrag = event => {
    event.preventDefault();
    event.stopPropagation();

    if (!this.#activeDragZone) {
      return;
    }

    const now = performance.now();

    if (now - this.#lastDragTime < DRAG_THROTTLE_MS) {
      return;
    }

    this.#lastDragTime = now;

    const posX = this.#getPosX(event);
    let posY = 0;

    if (this.#activeEnvelopeZone && this.#activeEnvelopeRect) {
      posY = event.clientY - this.#activeEnvelopeRect.top;
    }

    this.#activeDragZone.drag(posX, posY);

    // Show row drop indicator during move drag
    if (this.#isMoveDrag) {
      this.#updateRowDropIndicator(event.clientY);
    }

    if (this.#activeDragZone.isDragActive()) {
      this.#updateTooltip(this.#activeDragZone, event);
    }
  };

  #handleDragEnd = event => {
    event.preventDefault();
    event.stopPropagation();

    // Handle row change on drag end
    if (this.#activeDragZone && this.#isMoveDrag) {
      this.#handleRowChange(event.clientY);
    }

    if (this.#activeDragZone) {
      this.#activeDragZone.dragStop();
      this.#activeDragZone = null;
    }

    this.#isMoveDrag = false;
    this.#hideRowDropIndicator();
    this.#activeEnvelopeZone = null;
    this.#activeEnvelopeRect = null;
    document.removeEventListener('mousemove', this.#handleDrag, false);
    document.removeEventListener('mouseup', this.#handleDragEnd, false);
  };

  // ============================================================================
  // Drop
  // ============================================================================

  #handleDrop = event => {
    event.preventDefault();
    event.stopPropagation();

    const rawData = event.dataTransfer.getData('text/plain');

    if (!rawData) {
      return;
    }

    let parsed;

    try {
      parsed = JSON.parse(rawData);
    } catch {
      return;
    }

    const tracks = Array.isArray(parsed) ? parsed : [parsed];

    if (tracks.length === 0) {
      return;
    }

    const dropTime = getTimeFromPosX(this.#getPosX(event));

    // Find proper drop target using closest
    const $target = event.target;
    const $zones = $target.closest('.zones');
    const $zoneContainer = $target.closest('.zone-container');
    const $tracksEl = $target.closest('.tracks');

    tracks.forEach(data => {
      // All tracks start at drop position (on separate rows)
      const config = {
        id: this.#controller.getNewId(),
        idTrack: data.id,
        label: data.label,
        startTimeBuffer: 0,
        endTimeBuffer: data.duration,
        startTime: dropTime,
        durationTime: data.duration
      };

      let $parent;

      if ($zones) {
        // Drop on existing track row
        $parent = $zones;
      } else if ($zoneContainer || $tracksEl) {
        // Drop on container or tracks area - create new row
        $parent = this.#controller.addComposite();
      } else {
        return;
      }

      this.#container.addTrack(config, $parent);
    });
  };

  // ============================================================================
  // Mouse Move - Tooltip & Cut Preview
  // ============================================================================

  #handleMouseMove = event => {
    const now = performance.now();

    if (now - this.#lastTooltipTime < TOOLTIP_THROTTLE_MS) {
      return;
    }

    this.#lastTooltipTime = now;

    // Cut preview mode
    if (this.#container.isCutMode && this.#container.cutStartTime !== null) {
      const posX = this.#getPosX(event);
      this.#container.updateCutPreview(posX);

      return;
    }

    // Tooltip
    const $node = event.target;
    const $zoneNode = $node.closest('[data-zone-id]');
    const id = $zoneNode ? $zoneNode.getAttribute('data-zone-id') : null;
    const track = id ? this.#controller.getChild(id) : null;

    if (track && !this.#activeEnvelopeZone) {
      this.#updateTooltip(track, event);
    } else {
      this.#hideTooltip();
    }
  };

  // ============================================================================
  // Tooltip
  // ============================================================================

  #createTooltip() {
    this.#$tooltip = document.createElement('div');
    this.#$tooltip.className = 'track-tooltip';
    this.#$tooltip.innerHTML = `
      <div class="tooltip-title"></div>
      <div class="tooltip-row tooltip-current-row"><span>Current:</span><span class="tooltip-current"></span></div>
      <div class="tooltip-row"><span>Start:</span><span class="tooltip-start"></span></div>
      <div class="tooltip-row"><span>End:</span><span class="tooltip-end"></span></div>
      <div class="tooltip-row"><span>Duration:</span><span class="tooltip-duration"></span></div>
    `;
    document.body.appendChild(this.#$tooltip);
  }

  #updateTooltip = (track, event) => {
    if (!this.#$tooltip) {
      this.#createTooltip();
    }

    const posX = this.#getPosX(event);
    const currentTime = getTimeFromPosX(posX);

    this.#$tooltip.querySelector('.tooltip-title').textContent = track.getLabel() || 'Track';
    this.#$tooltip.querySelector('.tooltip-current').textContent = getTimeFormatted(currentTime);
    this.#$tooltip.querySelector('.tooltip-start').textContent = getTimeFormatted(track.getStart());
    this.#$tooltip.querySelector('.tooltip-end').textContent = getTimeFormatted(track.getEnd());
    this.#$tooltip.querySelector('.tooltip-duration').textContent = getTimeFormatted(
      track.getDuration()
    );

    this.#$tooltip.style.left = event.clientX + 15 + 'px';
    this.#$tooltip.style.top = event.clientY + 15 + 'px';
    this.#$tooltip.classList.add('visible');
  };

  #hideTooltip = () => {
    if (this.#$tooltip) {
      this.#$tooltip.classList.remove('visible');
    }
  };

  // ============================================================================
  // Row Change
  // ============================================================================

  #handleRowChange(clientY) {
    const { group, isNewRow, insertBefore } = this.#controller.getGroupAtY(clientY);
    const zoneId = this.#activeDragZone.getId();
    const currentGroup = this.#activeDragZone.getRoot().parentNode;

    if (isNewRow) {
      // Create new row and move track there
      const newGroupId = generateUuid();
      const $newGroup = this.#controller.view.createGroupAt(newGroupId, insertBefore);
      this.#controller.moveToGroup(zoneId, $newGroup);
    } else if (group && group !== currentGroup) {
      // Move to existing row
      this.#controller.moveToGroup(zoneId, group);
    }
  }

  #createRowDropIndicator() {
    this.#$rowDropIndicator = document.createElement('div');
    this.#$rowDropIndicator.className = 'row-drop-indicator';
    this.#$tracks.appendChild(this.#$rowDropIndicator);
  }

  #updateRowDropIndicator(clientY) {
    if (!this.#$rowDropIndicator) {
      this.#createRowDropIndicator();
    }

    const { group, isNewRow, insertBefore } = this.#controller.getGroupAtY(clientY);
    const currentGroup = this.#activeDragZone.getRoot().parentNode;

    // Don't show indicator if staying in same row
    if (group === currentGroup && !isNewRow) {
      this.#$rowDropIndicator.classList.remove('visible');

      return;
    }

    this.#$rowDropIndicator.classList.add('visible');

    if (isNewRow) {
      // Show line between rows
      this.#$rowDropIndicator.classList.add('new-row');
      this.#$rowDropIndicator.classList.remove('existing-row');

      if (insertBefore) {
        const rect = insertBefore.getBoundingClientRect();
        const tracksRect = this.#$tracks.getBoundingClientRect();
        this.#$rowDropIndicator.style.top = `${rect.top - tracksRect.top - 2}px`;
      } else {
        // At bottom
        const groups = this.#controller.getGroups();

        if (groups.length > 0) {
          const lastRect = groups[groups.length - 1].getBoundingClientRect();
          const tracksRect = this.#$tracks.getBoundingClientRect();
          this.#$rowDropIndicator.style.top = `${lastRect.bottom - tracksRect.top + 5}px`;
        }
      }
    } else if (group) {
      // Highlight target row
      this.#$rowDropIndicator.classList.add('existing-row');
      this.#$rowDropIndicator.classList.remove('new-row');

      const rect = group.getBoundingClientRect();
      const tracksRect = this.#$tracks.getBoundingClientRect();
      this.#$rowDropIndicator.style.top = `${rect.top - tracksRect.top}px`;
      this.#$rowDropIndicator.style.height = `${rect.height}px`;
    }
  }

  #hideRowDropIndicator() {
    if (this.#$rowDropIndicator) {
      this.#$rowDropIndicator.classList.remove('visible');
    }
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  #getPosX(event) {
    return event.clientX - this.#offsetLeft + this.#controller.getPosX();
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy() {
    document.removeEventListener('mousemove', this.#handleDrag, false);
    document.removeEventListener('mouseup', this.#handleDragEnd, false);

    if (this.#$tooltip) {
      this.#$tooltip.remove();
      this.#$tooltip = null;
    }

    if (this.#$rowDropIndicator) {
      this.#$rowDropIndicator.remove();
      this.#$rowDropIndicator = null;
    }
  }
}
