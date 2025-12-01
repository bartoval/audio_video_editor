// @ts-check

/**
 * @typedef {import('@types').VolumeConfig} VolumeConfig
 * @typedef {import('@types').VolumeEnvelope} VolumeEnvelope
 */

/**
 * Volume node - manages gain with envelope curves
 */
export default class Volume {
  /** @type {GainNode | null} */
  node = null;
  /** @type {number} Default gain value */
  defaultValue = 1.0;
  /** @type {VolumeEnvelope} Volume envelope curves */
  _volumeData = [];
  /** @type {number} Master gain multiplier (0-2) */
  _masterGain = 1;

  /**
   * @param {VolumeConfig} [config={}]
   */
  constructor(config = {}) {
    this._volumeData = config.volumeData || [];
    this._masterGain = config.gain ?? 1;
  }

  getNode() {
    return this.node;
  }

  setGain(currentTime, pausedAt) {
    let length = this._volumeData.length,
      lastVolumeValue = this.defaultValue,
      isPaddingZone = true;

    for (let i = 0; i < length; i++) {
      let curve = this._volumeData[i],
        curveData = curve.data,
        curveStartTime = currentTime + curve.startTime,
        curveDurationTime = curve.durationTime,
        curvePoints = curveData.values.filter((point, index) => {
          return curve.data.times[index] >= pausedAt;
        });
      curvePoints.length > 1 &&
        this.node.gain.setValueCurveAtTime(curvePoints, curveStartTime, curveDurationTime);
      if (
        isPaddingZone === true &&
        curve.startTime <= pausedAt &&
        curve.startTime + curveDurationTime >= pausedAt
      ) {
        isPaddingZone = false;
      }
      if (
        pausedAt > 0 &&
        isPaddingZone === true &&
        curve.startTime + curveDurationTime < pausedAt
      ) {
        lastVolumeValue = curveData.values[curveData.values.length - 1];
      }
    }

    if (isPaddingZone === true) {
      this.node.gain.value = lastVolumeValue;
    }
    return true;
  }

  /**
   * Set volume envelope data
   *
   * @param {VolumeEnvelope} sampleArrayInput - Volume curve samples
   * @param {number} [currentTime=0] - Current audio context time
   * @param {number} [pausedAt=0] - Time where playback was paused
   * @returns {boolean}
   */
  setVolumeData(sampleArrayInput, currentTime = 0, pausedAt = 0) {
    let length = sampleArrayInput.length,
      sampleArrayOutput = [];

    for (let i = 0; i < length; i++) {
      let sample = sampleArrayInput[i];
      sampleArrayOutput.push({
        startTime: sample.startTime,
        durationTime: sample.durationTime,
        data: sample.data
      });
    }

    this._volumeData = sampleArrayOutput;

    if (this.node !== null) {
      this.node.gain.cancelScheduledValues(0);
      this.setGain(currentTime, pausedAt);
    }

    return true;
  }

  getVolumeData() {
    return this._volumeData;
  }

  /** @param {number} value - 0-2, where 1 is unity */
  setMasterGain(value) {
    this._masterGain = value;

    if (this.node) {
      this.node.gain.value = this.defaultValue * this._masterGain;
    }
  }

  getMasterGain() {
    return this._masterGain;
  }

  createNode() {
    this.node = window.audioContextInstance.createGain();

    return true;
  }

  removeNode() {
    this.node = null;

    return true;
  }

  connectNode(destination) {
    this.node.connect(destination);

    return true;
  }

  disconnectNode(destination) {
    this.node.disconnect(destination);

    return true;
  }
}
