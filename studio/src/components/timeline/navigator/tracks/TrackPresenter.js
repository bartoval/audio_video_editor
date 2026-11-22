// @ts-check

import { Audio, getPosXFromTime } from '../../../../lib';
import { ZonePresenter } from '../../../core/zones';
import TrackModel from './TrackModel';
import TrackView from './TrackView';
import { fromFlat } from './TrackConfig';
import WaveformController from './controllers/WaveformController';
import VolumeController from './controllers/VolumeController';
import CutZoneController from './controllers/CutZoneController';
import StretchInfoOverlay from './controllers/StretchInfoOverlay';
import SuperZoomController from './controllers/SuperZoomController';
import MoveHandle from './views/MoveHandle';
import ResizeHandles from './views/ResizeHandles';
import FloatingTrackToolbar from './views/FloatingTrackToolbar';
import DragCoordinator, { MoveDragStrategy, ResizeDragStrategy } from './DragStrategy';

/**
 * TrackPresenter - extends ZonePresenter with audio track functionality
 *
 * Coordinates:
 * - TrackModel (state)
 * - TrackView (DOM)
 * - Audio blob (Web Audio)
 * - Controllers (waveform, volume, resize, move, cut); pan is set from the Inspector
 */
export default class TrackPresenter extends ZonePresenter {
  #containerCallbacks = {};
  #isMuted = false;
  #gainBeforeMute = 1;
  #snapEnabled = true;

  constructor(flatConfig, $parent) {
    const config = fromFlat({
      ...flatConfig,
      groupId: $parent.getAttribute('data-zone-group')
    });

    const { id, track, audio, cut, transform, waveform } = config;
    const model = new TrackModel(config);
    const view = new TrackView($parent, { id, ...track });
    super({ id, ...track }, $parent, { model, view });

    const hasDerived = Boolean(track.derivedId);
    const audioIdToLoad = hasDerived ? track.derivedId : track.idTrack;
    this.blob = new Audio({
      id,
      idTrack: audioIdToLoad,
      isDerived: hasDerived,
      startTimeBuffer: hasDerived ? 0 : cut.startTimeBuffer,
      endTimeBuffer: hasDerived ? undefined : cut.endTimeBuffer,
      isCutBuffer: hasDerived ? false : cut.isCutBuffer,
      start: hasDerived ? -1 : cut.start,
      end: hasDerived ? -1 : cut.end,
      buffer: audio.buffer,
      startTime: track.startTime,
      panValue: audio.panValue,
      volumeData: audio.volumeValues
    });

    this.originalIdTrack = track.idTrack;
    if (hasDerived) {
      this.blob.setDerivedId(track.derivedId);
    }

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
    this.controllerVolume = new VolumeController(controllerConfig, $content, {
      onChangeVolume: volumeArray => {
        this.blob.setVolumeData(volumeArray);
      }
    });
    this.stretchOverlay = new StretchInfoOverlay(
      { originalDuration: this.model.getOriginalDuration() },
      $content
    );

    this.superZoomController = new SuperZoomController($content, this.blob, () => ({
      startTime: this.getStart(),
      duration: this.getDuration()
    }));

    this.floatingToolbar = new FloatingTrackToolbar(this.view.getRoot(), {
      onSplit: () => this.#handleSplitRequest(),
      onCopy: () => this.#handleCopyRequest(),
      onDelete: () => this.#handleDeleteRequest(),
      onVolumeToggle: active => this.#handleVolumeToggle(active),
      onMuteToggle: active => this.#handleMuteToggle(active),
      onSnapToggle: active => this.setSnapEnabled(active)
    });

    this.#setupDragCoordinator();
    this.zoom();
  }

  #setupDragCoordinator() {
    this.dragCoordinator = new DragCoordinator([
      new MoveDragStrategy(this),
      new ResizeDragStrategy(
        this,
        this.resizeHandles,
        this.controllerWaveform,
        this.controllerVolume,
        this.stretchOverlay
      )
    ]);
  }

  select() {
    this.moveHandle.show();
    this.resizeHandles.show();
    this.floatingToolbar.show();

    if (this.model.isVolumeVisible()) {
      this.controllerVolume.enable();
      this.floatingToolbar.setVolumeActive(true);
    }

    this.floatingToolbar.setMuteActive(this.#isMuted);
    this.view.select();

    return true;
  }

  deselect() {
    if (!this.getIsDragging()) {
      this.moveHandle.hide();
      this.resizeHandles.hide();
    }

    this.floatingToolbar.hide();

    if (this.model.isVolumeVisible()) {
      this.volumeHide();
    }

    this.view.deselect();

    return true;
  }

  zoom() {
    super.zoom();

    const width = this.getWidth();
    const duration = this.getDuration();
    this.controllerVolume?.resize(width, duration);
    this.controllerWaveform?.resize(width);
  }

  dragStart(operation, posX = 0) {
    this.resizeHandles.validThreshold = false;
    this.model.startDrag(operation, posX);
    this.dragCoordinator.start();

    return true;
  }

  drag(posX, posY = 0) {
    const boundedPosX = Math.max(0, posX);
    this.dragCoordinator.drag(boundedPosX, posY);
  }

  dragStop() {
    this.dragCoordinator.dragEnd();
    this.model.stopDrag();

    return true;
  }

  volumeShow() {
    this.model.setVolumeVisible(true);

    if (!this.controllerVolume.isEnabled()) {
      this.controllerVolume.enable();
    }

    return true;
  }

  volumeHide() {
    this.model.setVolumeVisible(false);

    if (this.controllerVolume.isEnabled()) {
      this.controllerVolume.disable();
    }

    return true;
  }

  getPitch() {
    return this.model.getPitch();
  }

  setPitch(value) {
    this.model.setPitch(value);
    this.#applyStretch();
  }

  getSpeed() {
    return this.model.getStretchFactor();
  }

  setSpeed(value) {
    this.model.setStretchFactor(value);
    this.resizeHandles.setStretchFactor(value);
    this.#applyStretch();
  }

  getGain() {
    return this.model.getGain();
  }

  setGain(value) {
    const gain = this.model.setGain(value);
    this.blob.setGain(gain);

    return gain;
  }

  getPan() {
    return this.blob.getPanValue();
  }

  setPan(value) {
    this.blob.setPanValue(value);
  }

  #applyStretch() {
    const stretchFactor = this.model.getStretchFactor();
    const pitch = this.model.getPitch();
    const originalDuration = this.model.getOriginalDuration();

    this.controllerWaveform.loading(true);
    this.blob
      .stretchBuffer(stretchFactor, pitch)
      .then(applied => {
        // A newer stretch is on its way: let that one update the clip
        if (applied === false) {
          return;
        }

        const newDuration = originalDuration * stretchFactor;
        this.setDuration(newDuration);
        this.blob.setDuration(newDuration);

        const newWidth = this.getWidth();
        this.controllerWaveform.loading(false);
        this.controllerWaveform.resize(newWidth);
        this.controllerVolume?.resize(newWidth, newDuration);
        this.zoom();
      })
      .catch(error => {
        console.error('[Track] Stretch error:', error);
        this.controllerWaveform.loading(false);
      });
  }

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

  clone(newId) {
    const isCutting = this.get('isCutting');
    const stretchFactor = this.resizeHandles.getStretchFactor();
    const cutStart = isCutting ? this.cutZone.getStart() : -1;
    const cutEnd = isCutting ? this.cutZone.getEnd() : -1;
    const cutDuration = this.cutZone.getDuration();
    const duration = isCutting ? cutDuration : this.getDuration();
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
      pitch: this.getPitch(),
      gain: this.getGain(),
      panValue: this.blob.getPanValue(),
      volumeValues: this.blob.getVolumeData(),
      volumePaths: this.controllerVolume.getPaths()
    };
  }

  export() {
    return {
      id: this.getId(),
      groupId: this.getGroupId(),
      idTrack: this.originalIdTrack || this.blob.getIdTrack(),
      derivedId: this.blob.getDerivedId(),
      label: this.model.getLabel(),
      startTime: this.getStart(),
      durationTime: this.getDuration(),
      panValue: this.blob.getPanValue(),
      volumeValues: this.blob.getVolumeData(),
      volumePaths: this.controllerVolume.getPaths(),
      stretchFactor: this.resizeHandles.getStretchFactor(),
      pitch: this.getPitch(),
      gain: this.getGain(),
      isCut: this.model.getIsCut(),
      startTimeCut: this.model.getStartTimeCut(),
      durationTimeCut: this.model.getDurationTimeCut(),
      start: this.model.getStartTimeCut(),
      end: this.model.getStartTimeCut() + this.model.getDurationTimeCut(),
      startTimeBuffer: this.blob.getStartTime(),
      durationTimeBuffer: this.blob.getEndTime() - this.blob.getStartTime()
    };
  }

  getLabel() {
    return this.model.getLabel();
  }

  getCommands() {
    return this.model.getCommands();
  }

  setContainerCallbacks(callbacks) {
    this.#containerCallbacks = callbacks;

    if (callbacks.getTimeFromClientX && this.superZoomController) {
      this.superZoomController.setTimeCalculator(callbacks.getTimeFromClientX);
    }
  }

  #handleSplitRequest() {
    this.#containerCallbacks.onSplitRequest?.(this);
  }

  #handleCopyRequest() {
    this.#containerCallbacks.onCopyRequest?.(this);
  }

  #handleDeleteRequest() {
    this.#containerCallbacks.onDeleteRequest?.(this);
  }

  #handleVolumeToggle(active) {
    if (active) {
      this.volumeShow();
    } else {
      this.volumeHide();
    }
  }

  #handleMuteToggle(active) {
    if (active) {
      this.mute();
    } else {
      this.unmute();
    }
  }

  mute() {
    if (this.#isMuted) {
      return;
    }

    this.#gainBeforeMute = this.getGain();
    this.#isMuted = true;
    this.blob.setGain(0);
  }

  unmute() {
    if (!this.#isMuted) {
      return;
    }

    this.#isMuted = false;
    this.blob.setGain(this.#gainBeforeMute);
  }

  isMuted() {
    return this.#isMuted;
  }

  setSnapEnabled(enabled) {
    this.#snapEnabled = enabled;
    this.floatingToolbar?.setSnapActive(enabled);
  }

  isSnapEnabled() {
    return this.#snapEnabled;
  }

  toggleSnap() {
    this.setSnapEnabled(!this.#snapEnabled);
  }

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
      this.controllerWaveform = null;
      this.superZoomController?.destroy();
      this.superZoomController = null;
      this.floatingToolbar?.destroy();
      this.floatingToolbar = null;

      return true;
    });
  }
}
