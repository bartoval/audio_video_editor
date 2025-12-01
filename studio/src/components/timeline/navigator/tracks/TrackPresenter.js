import { Audio, getPosXFromTime } from '../../../../lib';
import { ZonePresenter } from '../../../core/zones';
import TrackModel from './TrackModel';
import TrackView from './TrackView';
import { fromFlat, toFlat } from './TrackConfig';
import WaveformController from './controllers/WaveformController';
import VolumeController from './controllers/VolumeController';
import PanController from './controllers/PanController';
import CutZoneController from './controllers/CutZoneController';
import MoveHandle from './views/MoveHandle';
import ResizeHandles from './views/ResizeHandles';
import DragCoordinator, {
  MoveDragStrategy,
  ResizeDragStrategy,
  VolumeDragStrategy,
  PanDragStrategy
} from './DragStrategy';

/**
 * TrackPresenter - extends ZonePresenter with audio track functionality
 *
 * Coordinates:
 * - TrackModel (state)
 * - TrackView (DOM)
 * - Audio blob (Web Audio)
 * - Controllers (waveform, volume, pan, resize, move, cut)
 */
export default class TrackPresenter extends ZonePresenter {
  constructor(flatConfig, $parent) {
    // Convert flat config to structured
    const config = fromFlat({
      ...flatConfig,
      groupId: $parent.getAttribute('data-zone-group')
    });

    const { id, track, audio, cut, transform, waveform } = config;

    // Create track-specific model and view
    const model = new TrackModel(config);
    const view = new TrackView($parent, { id, ...track });

    // Pass custom model/view to ZonePresenter
    super({ id, ...track }, $parent, { model, view });

    // Initialize audio blob
    this.blob = new Audio({
      id,
      idTrack: track.idTrack,
      startTimeBuffer: cut.startTimeBuffer,
      endTimeBuffer: cut.endTimeBuffer,
      isCutBuffer: cut.isCutBuffer,
      start: cut.start,
      end: cut.end,
      buffer: audio.buffer,
      startTime: track.startTime,
      panValue: audio.panValue,
      volumeData: audio.volumeValues
    });

    // Initialize controllers
    const $content = this.view.getContent();
    const controllerConfig = {
      id,
      stretchFactor: transform.stretchFactor,
      panValue: audio.panValue,
      volumePaths: audio.volumePaths,
      path: waveform.path,
      viewBox: waveform.viewBox
    };

    this.controllerWaveform = new WaveformController(
      controllerConfig,
      this.blob,
      this.view.getRoot()
    );
    this.resizeHandles = new ResizeHandles(controllerConfig, $content);
    this.moveHandle = new MoveHandle(controllerConfig, $content);
    this.cutZone = new CutZoneController(controllerConfig, $content);
    this.controllerVolume = new VolumeController(controllerConfig, $content);
    this.controllerPan = new PanController(controllerConfig, $content);

    // Setup controller signals
    this.#setupSignals();

    // Setup drag coordinator with strategies
    this.#setupDragCoordinator();

    // Initial zoom
    this.zoom();
  }

  #setupDragCoordinator() {
    this.dragCoordinator = new DragCoordinator([
      new MoveDragStrategy(this),
      new ResizeDragStrategy(
        this,
        this.resizeHandles,
        this.controllerWaveform,
        this.controllerVolume
      ),
      new VolumeDragStrategy(this, this.controllerVolume),
      new PanDragStrategy(this, this.controllerPan)
    ]);
  }

  // ============================================================================
  // Signal Setup
  // ============================================================================

  #setupSignals() {
    this.controllerVolume.onChangeVolume.add(volumeArray => {
      this.blob.setVolumeData(volumeArray);
    });

    this.controllerPan.onChangePan.add(value => {
      this.blob.setPanValue(value);
    });
  }

  // ============================================================================
  // Selection
  // ============================================================================

  select() {
    this.moveHandle.show();
    this.resizeHandles.show();

    if (this.model.isVolumeVisible()) {
      this.controllerVolume.enable();
    }

    if (this.model.isPanVisible()) {
      this.controllerPan.enable();
    }

    this.view.select();

    return true;
  }

  deselect() {
    if (!this.getIsDragging()) {
      this.moveHandle.hide();
      this.resizeHandles.hide();
    }

    // Hide volume/pan panels completely on deselect
    if (this.model.isPanVisible()) {
      this.panHide();
    }

    if (this.model.isVolumeVisible()) {
      this.volumeHide();
    }

    this.view.deselect();

    return true;
  }

  // ============================================================================
  // Zoom
  // ============================================================================

  zoom() {
    super.zoom();

    const width = this.getWidth();
    this.controllerVolume?.resize(width);
    this.controllerWaveform?.resize(width);
  }

  // ============================================================================
  // Drag Operations
  // ============================================================================

  dragStart(operation, posX = 0) {
    this.resizeHandles.validThreshold = false;
    this.model.startDrag(operation, posX);
    this.dragCoordinator.reset();

    return true;
  }

  drag(posX, posY = 0) {
    const boundedPosX = Math.max(0, posX);
    this.dragCoordinator.drag(boundedPosX, posY);
  }

  dragStop() {
    this.dragCoordinator.dragEnd();
    this.model.stopDrag();
  }

  #clampPosX(posX) {
    let bounded = posX <= 0 ? 0 : posX - this.getStartPosX();
    bounded = bounded >= this.getWidth() ? this.getWidth() : bounded;

    return parseFloat(bounded);
  }

  // ============================================================================
  // Volume Panel
  // ============================================================================

  volumeShow() {
    if (this.model.isPanVisible()) {
      this.panHide();
    }

    // Setting volumeVisible triggers patch() which adds editing-envelope class
    this.model.setVolumeVisible(true);

    if (!this.controllerVolume.isEnabled()) {
      this.controllerVolume.enable();
    }

    return true;
  }

  volumeHide() {
    // Setting volumeVisible triggers patch() which removes editing-envelope class
    this.model.setVolumeVisible(false);

    if (this.controllerVolume.isEnabled()) {
      this.controllerVolume.disable();
    }

    return true;
  }

  setVolumeStart(posX, posY) {
    if (this.model.isVolumeVisible()) {
      const adjustedPosX = this.#clampPosX(posX);
      // Pass position relative to track (0 to trackWidth)
      // VolumeService.scale handles conversion to SVG coordinates
      this.controllerVolume.drawStart(adjustedPosX, posY);
    }

    return true;
  }

  // ============================================================================
  // Pan Panel
  // ============================================================================

  panShow() {
    if (this.model.isVolumeVisible()) {
      this.volumeHide();
    }

    // Setting panVisible triggers patch() which adds editing-envelope class
    this.model.setPanVisible(true);

    if (!this.controllerPan.isEnabled()) {
      this.controllerPan.enable();
      this.controllerWaveform.mono();
    }

    return true;
  }

  panHide() {
    // Setting panVisible triggers patch() which removes editing-envelope class
    this.model.setPanVisible(false);

    if (this.controllerPan.isEnabled()) {
      this.controllerPan.disable();
      this.controllerWaveform.stereo();
    }

    return true;
  }

  setPanStart(posX, posY) {
    if (this.model.isPanVisible()) {
      const adjustedPosX = this.#clampPosX(posX);
      this.controllerPan.setValueStart(adjustedPosX, posY);
    }

    return true;
  }

  // ============================================================================
  // Pitch
  // ============================================================================

  getPitch() {
    return this.model.getPitch();
  }

  setPitch(value) {
    this.model.setPitch(value);

    this.controllerWaveform.loading(true);
    this.blob
      .stretchBuffer(this.resizeHandles.getStretchFactor(), value)
      .then(() => {
        this.controllerWaveform.loading(false);
        this.controllerWaveform.resize(this.getWidth());
      })
      .catch(error => {
        console.error('[Track] Pitch stretch error:', error);
        this.controllerWaveform.loading(false);
      });
  }

  // ============================================================================
  // Cut Zone
  // ============================================================================

  cut(start, end) {
    this.model.set('isCutting', true);
    this.cutZone.setStart(start);
    this.cutZone.setDuration(end);
    this.model.setIsCut(true);

    return true;
  }

  showCutZone(startTime, duration) {
    this.cutZone.show(startTime, duration);

    return true;
  }

  hideCutZone() {
    this.cutZone.hide();

    return true;
  }

  updateCutZone(startTime, duration) {
    this.cutZone.update(startTime, duration);

    return true;
  }

  // ============================================================================
  // Clone
  // ============================================================================

  clone(newId) {
    const isCutting = this.get('isCutting');
    const stretchFactor = this.resizeHandles.getStretchFactor();

    // Get cut zone info
    const cutStart = isCutting ? this.cutZone.getStart() : -1;
    const cutEnd = isCutting ? this.cutZone.getEnd() : -1;
    const cutDuration = this.cutZone.getDuration();
    const duration = isCutting ? cutDuration : this.getDuration();

    // Delegate buffer calculations to Audio
    const cutInfo = isCutting ? { start: cutStart, duration: cutDuration } : null;
    const bufferInfo = this.blob.getCloneBufferInfo(cutInfo, stretchFactor);

    this.set('isCutting', false);

    return {
      id: newId,
      idTrack: this.model.getIdTrack(),
      startTime: this.getStart() + this.cutZone.getStart(),
      label: this.model.getLabel(),
      durationTime: duration,
      start: cutStart,
      end: cutEnd,
      startTimeCut: this.model.getStartTimeCut() + cutStart || cutStart,
      durationTimeCut: cutDuration || duration,
      isCut: this.model.getIsCut(),
      ...bufferInfo,
      buffer: this.blob.getBuffer(),
      path: this.controllerWaveform.getCopy(
        getPosXFromTime(this.cutZone.getStart()),
        stretchFactor
      ),
      viewBox: getPosXFromTime(this.cutZone.getStart()),
      stretchFactor,
      pitch: this.getPitch()
    };
  }

  // ============================================================================
  // Export
  // ============================================================================

  export() {
    return {
      id: this.getId(),
      groupId: this.getGroupId(),
      idTrack: this.blob.getIdTrack(),
      label: this.model.getLabel(),
      startTime: this.getStart(),
      durationTime: this.getDuration(),
      panValue: this.blob.getPanValue(),
      volumeValues: this.blob.getVolumeData(),
      volumePaths: this.controllerVolume.getPaths(),
      stretchFactor: this.resizeHandles.getStretchFactor(),
      pitch: this.getPitch(),
      isCut: this.model.getIsCut(),
      startTimeCut: this.model.getStartTimeCut(),
      durationTimeCut: this.model.getDurationTimeCut(),
      start: this.model.getStartTimeCut(),
      end: this.model.getStartTimeCut() + this.model.getDurationTimeCut(),
      startTimeBuffer: this.blob.getStartTime(),
      durationTimeBuffer: this.blob.getEndTime() - this.blob.getStartTime()
    };
  }

  // ============================================================================
  // Track Properties
  // ============================================================================

  getLabel() {
    return this.model.getLabel();
  }

  getCommands() {
    return this.model.getCommands();
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  clean() {
    if (!this.blob) {
      return Promise.resolve(true);
    }

    return this.blob.releaseResources().then(() => {
      this.blob = null;
      this.resizeHandles = null;
      this.moveHandle = null;
      this.cutZone = null;
      this.controllerVolume = null;
      this.controllerPan = null;
      this.controllerWaveform = null;

      return true;
    });
  }
}
