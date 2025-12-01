export default class Volume {
  constructor(config = {}) {
    this.node = null;
    this.defaultValue = 0.5;
    this._volumeData = config.volumeData || [];
  }

  /** Get gain node */
  getNode() {
    return this.node;
  }

  /** Set gain curve at time */
  setGain(currentTime, pausedAt) {
    let length = this._volumeData.length, // chunks of volume points (curves)
      lastVolumeValue = this.defaultValue,
      isPaddingZone = true; // slice with the same volume values
    // for each volume chunk
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
    // set constant lines with the same volume value after the last volume point
    if (isPaddingZone === true) {
      this.node.gain.value = lastVolumeValue;
    }
    return true;
  }

  /** Set volume envelope data */
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

  /** Get volume envelope data */
  getVolumeData() {
    return this._volumeData;
  }

  /** Create gain node */
  createNode() {
    this.node = window.audioContextInstance.createGain();
    return true;
  }

  /** Remove gain node */
  removeNode() {
    this.node = null;
    return true;
  }

  /** Connect to destination */
  connectNode(destination) {
    this.node.connect(destination);
    return true;
  }

  /** Disconnect from destination */
  disconnectNode(destination = '') {
    this.node.disconnect(destination);
    return true;
  }
}
