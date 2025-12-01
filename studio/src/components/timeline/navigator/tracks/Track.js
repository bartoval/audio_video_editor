/**
 * Created by valerio bartolini.
 */
import Component from 'Component';
import Zone from 'Zones/Zone';
import Audio from 'Audio/Audio';
import ControllerWaveform from './track/ControllerWaveForm';
import ControllerDrag from './track/ControllerMove';
import ControllerResize from './track/ControllerResize';
import ControllerVolume from './track/ControllerVolume';
import ControllerPan from './track/ControllerPan';
import CutZone from './track/CutZone';
/** *************************************************************************************
 *
 *                                        Private methods
 *
 ***************************************************************************************/
let _redraw = self => {
    let $times = self.$node.querySelectorAll('.time-track');
    $times[0].textContent = Component.getTimeFormatted(parseFloat(self.getStart()));
    $times[1].textContent = Component.getTimeFormatted(parseFloat(self.getEnd()));
  },
  /**
   * set pitch value or stretch audio and call a remote process, then draw the new waveform. It is a buffer audio operation.
   *
   * @param self
   * @private
   */
  _editAudioBuffer = self => {
    self.controllerWaveform.loading();
    self.blob.stretchBuffer(self.controllerResize.getStretchFactor(), self.pitch)
      .then(() => {
        self.controllerWaveform.resize(self.getWidth());
      })
      .catch(err => {
        console.log(err);
        throw err;
      });
  },
  _addSignals = self => {
    self.controllerVolume.onChangeVolume.add(volumeArray => {
      self.blob.setVolumeData(volumeArray);
    });
    self.controllerPan.onChangePan.add(value => {
      self.blob.setPanValue(value);
    });
  },
  /**
   *
   * @param self
   * @param posX
   * @returns {Number}
   * @private
   */
  _checkPosXBound = (self, posX) => {
    posX = posX <= 0 ? 0 : posX - self.getStartPosX();
    posX = posX >= self.getWidth() ? self.getWidth() : posX;
    return parseFloat(posX);
  };
/** *************************************************************************************
 *
 *                                        Class
 *
 ***************************************************************************************/
export default class Track extends Zone {
  constructor(config, $parent) {
    super(config, $parent);
    this.idTrack = config.idTrack || -1;
    this.pitch = config.pitch || 0;
    this.label = config.label || '';

    // used by export, clone and write new buffers during resize (it uses full tracks from server side and we need to keep info about real time positions)
    this.startTimeCut = config.startTimeCut || 0;
    this.durationTimeCut = config.durationTimeCut || config.durationTime;

    this.originalDuration = config.durationTime;// used by resize to calculate a duration ratio and keep memory of the previous stretch (limit stretch 0.5 to 2)

    this.isCut = config.isCut || false; // tell us if this is a basic track or cut track

    this.volumeVisible = false;
    this.panVisible = false;

    this.commands = {
      back: false, forward: false, cut: false, copy: false, volume: false, pan: false, remove: false, pitch: false
    };
    this.render();

    this.blob = new Audio({
      id: config.id,
      idTrack: this.idTrack,
      startTimeBuffer: config.startTimeBuffer || 0,
      endTimeBuffer: config.endTimeBuffer || config.durationTime,
      isCutBuffer: config.isCutBuffer,
      start: config.start,
      end: config.end,
      buffer: config.buffer,
      startTime: config.startTime,
      panValue: config.panValue || 0,
      volumeData: config.volumeValues || []
    });

    config.startTime = 0;
    let $node = this.$node.querySelector('.zone-content');
    this.controllerWaveform = new ControllerWaveform(config, this.blob, this.$node);
    this.controllerResize = new ControllerResize(config, $node);
    this.controllerMove = new ControllerDrag(config, $node);
    this.cutZone = new CutZone(config, $node);
    this.controllerVolume = new ControllerVolume(config, $node);
    this.controllerPan = new ControllerPan(config, $node);
    _addSignals(this);
  }

  init() {
  }

  /**
   * Select a track showing commands
   * @returns {boolean}
   */
  select() {
    this.controllerMove.show();
    this.controllerResize.show();
    this.volumeVisible === true && this.controllerVolume.enable();
    this.panVisible === true && this.controllerPan.enable();

    this.$node.classList.add('selected');
    return true;
  }

  /**
   * Hide commands and sub-components  if enabled (pan, volume)
   * @returns {boolean}
   */
  deselect() {
    this.isDragging === false && this.controllerMove.hide() && this.controllerResize.hide();
    this.panVisible === true && this.controllerPan.disable();
    this.volumeVisible === true && this.controllerVolume.disable();

    this.$node.classList.remove('selected');
    return true;
  }

  /**
   * Resize sub-components when a zoom event is fired.
   */
  zoom() { // ZOOM + && ZOOM -
    super.zoom();
    let width = this.getWidth();
    this.controllerVolume && this.controllerVolume.resize(width); // svg needed manual resize
    this.controllerWaveform && this.controllerWaveform.resize(width); // canvas needed manual resize
  }

  /**
   * Initialize drag actions,position and time. Reset stretchFactor control (checked and enabled during stretch operation)
   * @param op
   * @param posX
   * @returns {boolean}
   */
  dragStart(op, posX = 0) {
    this.controllerResize.validThreshold = false;
    super.dragStart(op, posX);
    return true;
  }

  /**
   * Manage drag action for each action (move, resize) and sub-components (volume, pan..)
   * @param posX
   * @param posY
   */
  drag(posX, posY = 0) {
    posX = posX <= 0 ? 0 : posX;
    let move = () => {
        this.moveTo(posX) && this.blob.moveTo(this.getStart());
        _redraw(this);
        return true;
      },
      resize = () => {
        let time = Component.getTimeFromPosX(posX),
          startTime = this.getStart(), endTime = this.getEnd(),
          minStartTime = startTime + Component.getTimeFromPosX(50), // left limit stretch
          maxEndTime = endTime - Component.getTimeFromPosX(50), // right limit stretch
          hookOffset = Component.getTimeFromPosX(0), // TODO-valerio useless at the moment
          duration = time <= maxEndTime ? endTime - time + hookOffset : time >= minStartTime ? time - startTime : 1,
          durationRatio = duration / this.originalDuration,
          resizeZone = () => {
            return time <= maxEndTime && this.setStart(time - hookOffset) && this.setDuration(endTime - time + hookOffset) || time >= minStartTime && this.setDuration(time - startTime);
          };
        this.controllerResize.setStretchFactor(durationRatio) && resizeZone() && _redraw(this);
        return true;
      },
      setVolume = () => {
        posX = _checkPosXBound(this, posX);
        posX = posX / this.controllerResize.getStretchFactor();
        this.controllerVolume.draw(posX, posY, this.controllerResize.getStretchFactor());
        return true;
      },
      setPan = () => {
        posX = _checkPosXBound(this, posX);
        this.controllerPan.setValue(posX, posY);
        return true;
      };
    this.isMoving === true && move() ||
    this.isTransforming === true && resize() ||
    this.controllerVolume.isEnabled() && setVolume(posX, posY) ||
    this.controllerPan.isEnabled() === true && setPan(posX, posY);
  }

  dragStop() {
    let resizeEnd = () => {
        this.blob.resize(this.getStart(), this.getDuration()) && this.controllerWaveform.loading() &&
        _editAudioBuffer(this);
      },
      setVolumeEnd = () => {
        this.controllerVolume.drawEnd();
      },
      setPanEnd = () => {
        this.controllerPan.setValueEnd();
      };

    this.volumeVisible === true && setVolumeEnd();
    this.panVisible === true && setPanEnd();
    this.isTransforming === true && resizeEnd();
    super.dragStop();
  }

  /**
   * display pan panel and hide volume panel if it is showed
   * @returns {boolean}
   */
  panShow() {
    this.volumeVisible === true && this.volumeHide();

    this.panVisible = true;
    this.$node.classList.add('editing-envelope');
    this.controllerPan.$node.classList.remove('hide');
    this.controllerPan.isEnabled() === false && this.controllerPan.enable() && this.controllerWaveform.mono();
    return true;
  }

  /**
   * hide pan panel and disable it
   *
   * @returns {boolean}
   */
  panHide() {
    this.panVisible = false;
    this.$node.classList.remove('editing-envelope');
    this.controllerPan.$node.classList.add('hide');
    this.controllerPan.isEnabled() === true && this.controllerPan.disable() && this.controllerWaveform.stereo();
    return true;
  }

  /**
   *
   * @param posX
   * @param posY
   * @returns {boolean}
   */
  setPanStart(posX, posY) {
    posX = _checkPosXBound(this, posX);

    this.panVisible === true && this.controllerPan.setValueStart(posX, posY);
    return true;
  }

  /**
   * hide other panels if they are displayed show volume panel and enables it
   *
   * @returns {boolean}
   */
  volumeShow() {
    this.panVisible === true && this.panHide();

    this.volumeVisible = true;
    this.$node.classList.add('editing-envelope');
    this.controllerVolume.$node.classList.remove('hide');
    this.controllerVolume.isEnabled() === false && this.controllerVolume.enable();
    return true;
  }

  /**
   *  hide volume panel and disable it
   *
   * @returns {boolean}
   */
  volumeHide() {
    this.volumeVisible = false;
    this.$node.classList.remove('editing-envelope');
    this.controllerVolume.$node.classList.add('hide');
    this.controllerVolume.isEnabled() === true && this.controllerVolume.disable();
    return true;
  }

  /**
   *
   * @param posX
   * @param posY
   * @returns {boolean}
   */
  setVolumeStart(posX, posY) {
    posX = _checkPosXBound(this, posX);
    posX = posX / this.controllerResize.getStretchFactor();

    this.controllerVolume.drawStart(posX, posY, this.controllerResize.getStretchFactor());
    return true;
  }

  /**
   * set pitch value and call a remote process, then draw the new waveform. It is a buffer audio operation.
   * @param value
   */
  setPitch(value) {
    this.pitch = value;
    _editAudioBuffer(this);
  }

  /**
   *
   * @returns {*|number}
   */
  getPitch() {
    return this.pitch;
  }

  /**
   *
   * @param start
   * @param end
   * @returns {boolean}
   */
  cut(start, end) {
    this.isCutting = true;
    this.cutZone.setStart(start);
    this.cutZone.setDuration(end);
    this.isCut = true;
    return true;
  }

  clone(newId) {
    let startTime = this.isCutting === true ? this.cutZone.getStart() : -1,
      endTime = this.isCutting === true ? this.cutZone.getEnd() : -1,
      duration = this.isCutting === true ? this.cutZone.getDuration() : this.getDuration(),
      isCutBuffer = this.isCutting,
      startTimeBuffer = this.isCutting === true ? parseFloat(this.blob.getStartTime()) + parseFloat(this.cutZone.getStart()) : this.blob.getStartTime(),
      endTimeBuffer = this.isCutting === true ? this.blob.getStartTime() + (this.cutZone.getStart() + this.cutZone.getDuration()) / this.controllerResize.getStretchFactor() : this.blob.getEndTime();
    this.isCutting = false;
    return {
      id: newId,
      idTrack: this.idTrack,
      startTime: this.getStart() + this.cutZone.getStart(),
      label: this.label,
      durationTime: duration,
      start: startTime,
      end: endTime,
      startTimeCut: this.startTimeCut + startTime || startTime,
      durationTimeCut: this.cutZone.getDuration() || duration,
      isCut: this.isCut,
      isCutBuffer: isCutBuffer,
      startTimeBuffer: startTimeBuffer,
      endTimeBuffer: endTimeBuffer,
      buffer: this.blob.getBuffer(),
      //  volumeValues: this.blob.getVolumeData(),
      //  volumePaths: this.controllerVolume.getPaths(),
      path: this.controllerWaveform.getCopy(Component.getPosXFromTime(this.cutZone.getStart()), this.controllerResize.getStretchFactor()),
      viewBox: Component.getPosXFromTime(this.cutZone.getStart()),
      stretchFactor: this.controllerResize.getStretchFactor(),
      pitch: this.pitch
    };
  }

  export() {
    return {
      id: this.getId(),
      groupId: this.getGroupId(),
      idTrack: this.blob.getIdTrack(),
      label: this.label,
      startTime: this.getStart(),
      durationTime: this.getDuration(),
      panValue: this.blob.getPanValue(),
      volumeValues: this.blob.getVolumeData(),
      volumePaths: this.controllerVolume.getPaths(),
      stretchFactor: this.controllerResize.getStretchFactor(),
      pitch: this.pitch,
      isCut: this.isCut,
      startTimeCut: this.startTimeCut,
      durationTimeCut: this.durationTimeCut,
      start: this.startTimeCut,
      end: this.startTimeCut + this.durationTimeCut,
      startTimeBuffer: this.blob.getStartTime(),
      durationTimeBuffer: this.blob.getEndTime() - this.blob.getStartTime()
    };
  }

  /**
   *
   * @returns {{back: boolean, forward: boolean, cut: boolean, copy: boolean, volume: boolean, pan: boolean, remove: boolean}|*}
   */
  getCommands() {
    return this.commands;
  }

  /**
   * Release audio context to avoid GC and clean track.
   * @returns {Promise.<TResult>}
   */
  clean() {
    return this.blob.releaseResources()
      .then(() => {
        this.blob = null;
        this.controllerResize = null;
        this.controllerMove = null;
        this.cutZone = null;
        this.controllerVolume = null;
        this.controllerPan = null;
        this.controllerWaveform = null;
        return true;
      });
  }

  /** *************************************************************************************
   *
   *                                        Public methods
   *
   ***************************************************************************************/
  render() {
    let props, $header, $footer, id = this.getId();
    // TRACK
    this.$node.classList.add('track-content');
    props = [{class: 'zone-content', 'data-zone-id': id}];
    Component.render(this.$node, 'div', props);
    // Header
    props = [{class: 'header', 'data-zone-id': id}];
    $header = Component.render(this.$node, 'div', props);
    // Footer
    props = [{class: 'footer', 'data-zone-id': id}];
    $footer = Component.render(this.$node, 'div', props);
    // times
    props = [{class: 'time time-track', style: 'left:5px;'}];
    Component.render($header, 'div', props);
    props = [{class: 'time time-track', style: 'right:5px;'}];
    Component.render($header, 'div', props);
    // name track
    props = [{class: 'label'}];
    Component.render($footer, 'div', props, {}, this.label);

    _redraw(this);
    this.zoom();
  }
}

