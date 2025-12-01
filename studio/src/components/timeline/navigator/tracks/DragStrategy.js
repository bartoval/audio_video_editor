import { getTimeFromPosX } from '../../../../lib';

/**
 * DragStrategy - Strategy pattern for track drag operations
 *
 * Each strategy handles a specific drag mode:
 * - MoveDragStrategy: moving track position
 * - ResizeDragStrategy: resizing/stretching track
 */

class DragStrategy {
  constructor(presenter) {
    this.presenter = presenter;
  }

  canHandle() {
    return false;
  }

  onDrag(_posX, _posY) {
    throw new Error('onDrag must be implemented');
  }

  onDragEnd() {}
}

export class MoveDragStrategy extends DragStrategy {
  canHandle() {
    return this.presenter.getIsMoving();
  }

  onDrag(posX) {
    this.presenter.moveTo(posX);
    this.presenter.blob.moveTo(this.presenter.getStart());
  }
}

export class ResizeDragStrategy extends DragStrategy {
  constructor(
    presenter,
    controllerResize,
    controllerWaveform,
    controllerVolume,
    stretchOverlay = null
  ) {
    super(presenter);
    this.controllerResize = controllerResize;
    this.controllerWaveform = controllerWaveform;
    this.controllerVolume = controllerVolume;
    this.stretchOverlay = stretchOverlay;
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

      if (this.stretchOverlay) {
        this.stretchOverlay.show();
        this.stretchOverlay.update(durationRatio, duration);
      }
    }
  }

  onDragEnd() {
    if (this.stretchOverlay) {
      this.stretchOverlay.hide();
    }

    const stretchFactor = this.controllerResize.getStretchFactor();
    this.presenter.model.setStretchFactor(stretchFactor);

    this.controllerWaveform.loading(true);
    this.presenter.blob.resize(this.presenter.getStart(), this.presenter.getDuration());

    const newWidth = this.presenter.getWidth();
    const duration = this.presenter.getDuration();

    this.presenter.blob
      .stretchBuffer(stretchFactor, this.presenter.getPitch())
      .then(() => {
        this.controllerWaveform.loading(false);
        this.controllerWaveform.resize(newWidth);
        this.controllerVolume.resize(newWidth, duration);
      })
      .catch(() => {
        this.controllerWaveform.loading(false);
      });
  }
}

export default class DragCoordinator {
  constructor(strategies) {
    this.strategies = strategies;
    this.activeStrategy = null;
  }

  start() {
    this.activeStrategy = this.strategies.find(strategy => strategy.canHandle()) || null;
  }

  drag(posX, posY) {
    if (!this.activeStrategy) {
      this.activeStrategy = this.strategies.find(strategy => strategy.canHandle()) || null;
    }

    this.activeStrategy?.onDrag(posX, posY);
  }

  dragEnd() {
    this.activeStrategy?.onDragEnd();
    this.activeStrategy = null;
  }
}
