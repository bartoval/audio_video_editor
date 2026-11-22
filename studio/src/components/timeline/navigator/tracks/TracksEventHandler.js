// @ts-check

import { TRACK_ACTION, CUT_STATE } from '../../../../config/constants';
import { generateUuid, getTimeFromPosX, getPosXFromTime } from '../../../../lib';
import * as ToolMode from '../../../../services/ToolMode';
import * as CutService from '../../../../services/CutService';
import SnappingService from '../../../../services/SnappingService';
import uiStore from '../../../../store/uiStore';
import { findTrackEdgeSnap, buildTrackEdges } from './SnapCalculator';

/**
 * TracksEventHandler - Tool-first event handling for tracks
 */
export default class TracksEventHandler {
  static SNAP_TOLERANCE_PX = 15;
  #container = null;
  #controller = null;
  #$tracks = null;

  #activeDragZone = null;
  #isMoveDrag = false;
  #$rowDropIndicator = null;

  #pendingPosX = null;
  #pendingClientY = null;
  #pendingUseSnap = true;
  #snapRaf = null;
  #pendingCutAction = null;
  #prevDragPosX = null;
  #dragClickOffsetPx = 0;

  constructor(container, controller, $tracks) {
    this.#container = container;
    this.#controller = controller;
    this.#$tracks = $tracks;
    this.#bindEvents();
  }

  #bindEvents() {
    this.#$tracks.addEventListener('dragover', event => event.preventDefault());
    this.#$tracks.addEventListener('drop', this.#handleDrop);
    this.#$tracks.addEventListener('mousedown', this.#handleMouseDown);
    this.#$tracks.addEventListener('dblclick', this.#handleDblClick);
  }

  #handleMouseDown = event => {
    // Only the primary button edits tracks
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const $node = event.target;
    const $zoneNode = $node.closest('[data-zone-id]');
    const id = $zoneNode?.getAttribute('data-zone-id');

    if (!id) {
      if (this.#container.isSplitMode()) {
        this.#container.exitSplitMode();
      }

      return;
    }

    const clickedZone = this.#controller.getChild(id);

    if (!clickedZone) {
      return;
    }

    const posX = this.#container.getPosXFromClientX(event.clientX);

    if (this.#container.isSplitMode()) {
      this.#container.handleSplitClick(clickedZone, posX);

      return;
    }

    if (CutService.isActive()) {
      this.#handleCutModeClick(clickedZone, posX, event);

      return;
    }

    if (ToolMode.isActive()) {
      this.#container.select(id);
      const toolMode = ToolMode.getMode();

      if (toolMode === TRACK_ACTION.VOLUME) {
        this.#handleEnvelopeToolAction(clickedZone, posX, event, toolMode);

        return;
      }

      this.#handleToolAction(clickedZone, posX);

      return;
    }

    this.#handleNormalMouseDown(id, clickedZone, posX, $node, event);
  };

  #handleToolAction(clickedZone, _posX) {
    const toolMode = ToolMode.getMode();

    switch (toolMode) {
      case TRACK_ACTION.COPY:
        this.#container.clone(clickedZone);
        break;

      case TRACK_ACTION.REMOVE:
        this.#container.remove(clickedZone);
        break;
    }
  }

  #handleCutModeClick(clickedZone, posX, event) {
    const cutState = CutService.getState();

    if (cutState === CUT_STATE.READY) {
      CutService.cancel();

      return;
    }

    if (cutState === CUT_STATE.ACTIVE) {
      this.#pendingCutAction = {
        zone: clickedZone,
        posX,
        clientX: event.clientX
      };

      requestAnimationFrame(() => {
        if (!this.#pendingCutAction) {
          return;
        }

        const { zone, posX: actionPosX, clientX } = this.#pendingCutAction;
        this.#pendingCutAction = null;

        if (CutService.setStart(actionPosX, zone, clientX)) {
          this.#container.select(zone.getId());
          document.addEventListener('mousemove', this.#handleCutDrag, false);
          document.addEventListener('mouseup', this.#handleCutMouseUp, false);
        }
      });

      return;
    }
  }

  #handleDblClick = event => {
    if (!CutService.isActive()) {
      return;
    }

    const $node = event.target;
    const $zoneNode = $node.closest('[data-zone-id]');
    const id = $zoneNode?.getAttribute('data-zone-id');

    if (!id) {
      return;
    }

    const clickedZone = this.#controller.getChild(id);

    if (!clickedZone) {
      return;
    }

    this.#pendingCutAction = null;

    const posX = this.#container.getPosXFromClientX(event.clientX);
    this.#handleCutDoubleClick(clickedZone, posX);
  };

  #handleCutDrag = event => {
    event.preventDefault();
    const posX = this.#container.getPosXFromClientX(event.clientX);
    CutService.updateEnd(posX, event.clientX);
  };

  #handleCutMouseUp = event => {
    event.preventDefault();
    document.removeEventListener('mousemove', this.#handleCutDrag, false);
    document.removeEventListener('mouseup', this.#handleCutMouseUp, false);

    const posX = this.#container.getPosXFromClientX(event.clientX);

    if (!CutService.setEnd(posX, event.clientX)) {
      return;
    }
  };

  #handleCutDoubleClick(clickedZone, posX) {
    const clickTime = getTimeFromPosX(posX);
    const trackStart = clickedZone.getStart();
    const trackEnd = clickedZone.getEnd();

    if (clickTime <= trackStart || clickTime >= trackEnd) {
      return;
    }

    this.#container.enterSplitMode(clickedZone);
    this.#container.handleSplitClick(clickedZone, posX);
    CutService.deactivate();
  }

  #handleEnvelopeToolAction(clickedZone, posX, event, toolMode) {
    if (toolMode === TRACK_ACTION.VOLUME) {
      if (!clickedZone.model?.isVolumeVisible()) {
        clickedZone.volumeShow();
      }

      return;
    }
  }

  #handleNormalMouseDown(id, clickedZone, posX, $node, _event) {
    const previousZone = this.#controller.getSelected();
    const $volumeZone = $node.closest('.volume-zone');

    if ($volumeZone && clickedZone.isEditingEnvelope()) {
      if (previousZone === null || String(previousZone.getId()) !== id) {
        this.#container.select(id, { reveal: true });
      } else {
        this.#container.revealSelection();
      }

      return;
    }

    if (this.#activeDragZone) {
      this.#activeDragZone.dragStop();
      this.#activeDragZone = null;
    }

    document.removeEventListener('mousemove', this.#handleDrag, false);
    document.removeEventListener('mouseup', this.#handleDragEnd, false);

    this.#activeDragZone = clickedZone;

    if ($node.classList.contains('hook-resize')) {
      clickedZone.dragStart('resize');
      this.#isMoveDrag = false;
    } else {
      clickedZone.dragStart('move', posX);
      this.#dragClickOffsetPx = posX - (clickedZone.getStartPosX?.() ?? 0);
      this.#isMoveDrag = true;
      this.#$tracks.classList.add('dragging');
    }

    SnappingService.beginDrag({
      excludeTrackId: clickedZone.getId?.(),
      visibleRange: {
        start: getTimeFromPosX(this.#controller.getPosX()),
        end: getTimeFromPosX(this.#controller.getPosX() + this.#$tracks.clientWidth)
      },
      allowGridSnap: false,
      allowTracks: true,
      allowMarkers: false,
      allowPlayhead: false,
      tolerance: TracksEventHandler.SNAP_TOLERANCE_PX
    });

    document.addEventListener('mousemove', this.#handleDrag, false);
    document.addEventListener('mouseup', this.#handleDragEnd, false);
    window.addEventListener('blur', this.#handleDragEnd, false);

    if (previousZone === null || String(previousZone.getId()) !== id) {
      this.#container.select(id, { reveal: true });
    } else {
      this.#container.revealSelection();
    }
  }

  #handleDrag = event => {
    event.preventDefault();
    event.stopPropagation();

    if (!this.#activeDragZone) {
      return;
    }

    const posX = this.#container.getPosXFromClientX(event.clientX);
    this.#pendingPosX = posX;
    this.#pendingClientY = event.clientY;
    this.#pendingUseSnap = this.#activeDragZone.isSnapEnabled?.() ?? true;

    if (!this.#snapRaf) {
      this.#snapRaf = requestAnimationFrame(this.#flushDragFrame);
    }
  };

  #handleDragEnd = event => {
    event.preventDefault();
    event.stopPropagation();

    if (this.#activeDragZone && this.#isMoveDrag) {
      this.#handleRowChange(event.clientY);
    }

    if (this.#activeDragZone) {
      this.#activeDragZone.dragStop();
      this.#activeDragZone = null;
    }

    this.#isMoveDrag = false;
    this.#prevDragPosX = null;
    this.#$tracks.classList.remove('dragging');
    this.#hideRowDropIndicator();
    if (this.#snapRaf) {
      cancelAnimationFrame(this.#snapRaf);
      this.#snapRaf = null;
    }
    SnappingService.endDrag();
    document.removeEventListener('mousemove', this.#handleDrag, false);
    document.removeEventListener('mouseup', this.#handleDragEnd, false);
    window.removeEventListener('blur', this.#handleDragEnd, false);

    this.#container.updateSnapPoints();
    uiStore.actions.refreshInspector();
  };

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

    const dropTime = getTimeFromPosX(this.#container.getPosXFromClientX(event.clientX));
    const $target = event.target;
    const $zones = $target.closest('.zones');
    const $zoneContainer = $target.closest('.zone-container');
    const $tracksEl = $target.closest('.tracks');

    tracks.forEach(data => {
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
        $parent = $zones;
      } else if ($zoneContainer || $tracksEl) {
        $parent = this.#controller.addComposite();
      } else {
        return;
      }

      this.#container.addTrack(config, $parent);
    });
  };

  #handleRowChange(clientY) {
    const { group, isNewRow, insertBefore } = this.#controller.getGroupAtY(clientY);
    const zoneId = this.#activeDragZone.getId();
    const currentGroup = this.#activeDragZone.getRoot().parentNode;

    if (isNewRow) {
      const $newGroup = this.#controller.view.createGroupAt(generateUuid(), insertBefore);
      this.#controller.moveToGroup(zoneId, $newGroup);
    } else if (group && group !== currentGroup) {
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

    if (group === currentGroup && !isNewRow) {
      this.#$rowDropIndicator.classList.remove('visible');

      return;
    }

    this.#$rowDropIndicator.classList.add('visible');

    if (isNewRow) {
      this.#$rowDropIndicator.classList.add('new-row');
      this.#$rowDropIndicator.classList.remove('existing-row');

      if (insertBefore) {
        const rect = insertBefore.getBoundingClientRect();
        const tracksRect = this.#$tracks.getBoundingClientRect();
        this.#$rowDropIndicator.style.top = `${rect.top - tracksRect.top - 2}px`;
      } else {
        const groups = this.#controller.getGroups();

        if (groups.length > 0) {
          const lastRect = groups[groups.length - 1].getBoundingClientRect();
          const tracksRect = this.#$tracks.getBoundingClientRect();
          this.#$rowDropIndicator.style.top = `${lastRect.bottom - tracksRect.top + 5}px`;
        }
      }
    } else if (group) {
      this.#$rowDropIndicator.classList.add('existing-row');
      this.#$rowDropIndicator.classList.remove('new-row');

      const rect = group.getBoundingClientRect();
      const tracksRect = this.#$tracks.getBoundingClientRect();
      this.#$rowDropIndicator.style.top = `${rect.top - tracksRect.top}px`;
      this.#$rowDropIndicator.style.height = `${rect.height}px`;
    }
  }

  #hideRowDropIndicator() {
    this.#$rowDropIndicator?.classList.remove('visible');
  }

  #flushDragFrame = () => {
    this.#snapRaf = null;

    if (!this.#activeDragZone || this.#pendingPosX === null) {
      return;
    }

    const useSnap = this.#pendingUseSnap;
    const posX = this.#pendingPosX;
    const clientY = this.#pendingClientY;

    let finalPosX = posX;

    if (useSnap) {
      const durationTime = this.#activeDragZone.getDuration?.() ?? 0;
      const durationPx = getPosXFromTime(durationTime);
      const actualStartPx = posX - this.#dragClickOffsetPx;
      const trackCount = this.#container.getNumTracks?.() ?? this.#controller.getNumTracks?.() ?? 0;
      const activeId = this.#activeDragZone?.getId?.();
      const edges = buildTrackEdges(this.#controller, trackCount, activeId, getPosXFromTime);

      const snapTarget = findTrackEdgeSnap(
        edges,
        actualStartPx,
        durationPx,
        TracksEventHandler.SNAP_TOLERANCE_PX,
        this.#prevDragPosX
      );

      if (snapTarget) {
        finalPosX = snapTarget.newStartPx + this.#dragClickOffsetPx;
      }
    }

    this.#activeDragZone.drag(finalPosX, 0);
    this.#prevDragPosX = finalPosX - this.#dragClickOffsetPx;

    if (this.#isMoveDrag) {
      this.#updateRowDropIndicator(clientY);
    }

    this.#pendingPosX = null;
    this.#pendingClientY = null;
  };

  destroy() {
    if (this.#activeDragZone) {
      this.#activeDragZone.dragStop();
      this.#activeDragZone = null;
    }

    if (this.#snapRaf) {
      cancelAnimationFrame(this.#snapRaf);
      this.#snapRaf = null;
    }

    this.#pendingCutAction = null;

    document.removeEventListener('mousemove', this.#handleDrag, false);
    document.removeEventListener('mouseup', this.#handleDragEnd, false);
    document.removeEventListener('mousemove', this.#handleCutDrag, false);
    document.removeEventListener('mouseup', this.#handleCutMouseUp, false);
    window.removeEventListener('blur', this.#handleDragEnd, false);

    if (this.#$tracks) {
      this.#$tracks.removeEventListener('mousedown', this.#handleMouseDown);
      this.#$tracks.removeEventListener('drop', this.#handleDrop);
      this.#$tracks.removeEventListener('dblclick', this.#handleDblClick);
    }

    if (this.#$rowDropIndicator) {
      this.#$rowDropIndicator.remove();
      this.#$rowDropIndicator = null;
    }

    this.#container = null;
    this.#controller = null;
    this.#$tracks = null;
  }
}
