import { getTimeFromPosX, getPosXFromTime } from '../../../../lib';

/**
 * DragStrategy - Strategy pattern for track drag operations
 *
 * Each strategy handles a specific drag mode:
 * - MoveDragStrategy: moving track position
 * - ResizeDragStrategy: resizing/stretching track
 * - VolumeDragStrategy: drawing volume envelope
 * - PanDragStrategy: adjusting pan value
 */

// ============================================================================
// Base Strategy
// ============================================================================

class DragStrategy {
  constructor(presenter) {
    this.presenter = presenter;
  }

  canHandle() {
    return false;
  }

  onDrag(posX, posY) {
    throw new Error('onDrag must be implemented');
  }

  onDragEnd() {
    // Optional cleanup
  }
}

// ============================================================================
// Move Strategy
// ============================================================================

export class MoveDragStrategy extends DragStrategy {
  canHandle() {
    return this.presenter.getIsMoving();
  }

  onDrag(posX) {
    this.presenter.moveTo(posX);
    this.presenter.blob.moveTo(this.presenter.getStart());
  }
}

// ============================================================================
// Resize Strategy
// ============================================================================

export class ResizeDragStrategy extends DragStrategy {
  constructor(presenter, controllerResize, controllerWaveform, controllerVolume) {
    super(presenter);
    this.controllerResize = controllerResize;
    this.controllerWaveform = controllerWaveform;
    this.controllerVolume = controllerVolume;
  }

  canHandle() {
    return this.presenter.getIsTransforming();
  }

  onDrag(posX) {
    const time = getTimeFromPosX(posX);
    const startTime = this.presenter.getStart();
    const endTime = this.presenter.getEnd();
    const minStartTime = startTime + getTimeFromPosX(50);
    const maxEndTime = endTime - getTimeFromPosX(50);
    const hookOffset = getTimeFromPosX(0);

    const duration =
      time <= maxEndTime
        ? endTime - time + hookOffset
        : time >= minStartTime
          ? time - startTime
          : 1;

    const durationRatio = duration / this.presenter.model.getOriginalDuration();

    if (this.controllerResize.setStretchFactor(durationRatio)) {
      if (time <= maxEndTime) {
        this.presenter.setStart(time - hookOffset);
        this.presenter.setDuration(endTime - time + hookOffset);
      } else if (time >= minStartTime) {
        this.presenter.setDuration(time - startTime);
      }
    }
  }

  onDragEnd() {
    this.controllerWaveform.loading(true);
    this.presenter.blob.resize(this.presenter.getStart(), this.presenter.getDuration());

    const newWidth = this.presenter.getWidth();

    this.presenter.blob
      .stretchBuffer(this.controllerResize.getStretchFactor(), this.presenter.getPitch())
      .then(() => {
        this.controllerWaveform.loading(false);
        this.controllerWaveform.resize(newWidth);
        this.controllerVolume.resize(newWidth);
      })
      .catch(() => {
        this.controllerWaveform.loading(false);
      });
  }
}

// ============================================================================
// Volume Strategy
// ============================================================================

export class VolumeDragStrategy extends DragStrategy {
  constructor(presenter, controllerVolume) {
    super(presenter);
    this.controllerVolume = controllerVolume;
  }

  canHandle() {
    return this.controllerVolume.isEnabled();
  }

  onDrag(posX, posY) {
    const adjustedPosX = this.#clampPosX(posX);
    // Pass position relative to track (0 to trackWidth)
    // VolumeService.scale handles conversion to SVG coordinates
    this.controllerVolume.draw(adjustedPosX, posY);
  }

  onDragEnd() {
    this.controllerVolume.drawEnd();
  }

  #clampPosX(posX) {
    let bounded = posX <= 0 ? 0 : posX - this.presenter.getStartPosX();
    bounded = bounded >= this.presenter.getWidth() ? this.presenter.getWidth() : bounded;

    return parseFloat(bounded);
  }
}

// ============================================================================
// Pan Strategy
// ============================================================================

export class PanDragStrategy extends DragStrategy {
  constructor(presenter, controllerPan) {
    super(presenter);
    this.controllerPan = controllerPan;
  }

  canHandle() {
    return this.controllerPan.isEnabled();
  }

  onDrag(posX, posY) {
    const adjustedPosX = this.#clampPosX(posX);
    this.controllerPan.setValue(adjustedPosX, posY);
  }

  onDragEnd() {
    this.controllerPan.setValueEnd();
  }

  #clampPosX(posX) {
    let bounded = posX <= 0 ? 0 : posX - this.presenter.getStartPosX();
    bounded = bounded >= this.presenter.getWidth() ? this.presenter.getWidth() : bounded;

    return parseFloat(bounded);
  }
}

// ============================================================================
// Drag Coordinator
// ============================================================================

export default class DragCoordinator {
  constructor(strategies) {
    this.strategies = strategies;
    this.activeStrategy = null;
  }

  drag(posX, posY) {
    // Cache active strategy for performance
    if (!this.activeStrategy) {
      this.activeStrategy = this.strategies.find(s => s.canHandle());
    }

    this.activeStrategy?.onDrag(posX, posY);
  }

  dragEnd() {
    this.activeStrategy?.onDragEnd();
    this.activeStrategy = null;
  }

  reset() {
    this.activeStrategy = null;
  }
}
