export default class Pan {
  constructor(config = {}) {
    this.node = null;
    this.type = config.type || 'equalpower';
    this.maxValue = config.maxValue || 1;
    this.minValue = config.maxValue || -1;
    this.value = config.panValue || 0;
  }

  /** Get panner node */
  getNode() {
    return this.node;
  }

  /** Get pan value */
  getValue() {
    return this.value;
  }

  /** Set pan value */
  setValue(value) {
    this.value =
      value >= this.maxValue ? this.maxValue : value < this.minValue ? this.minValue : value;
    this.node !== null && this.setNodeValue();

    return this.value;
  }

  /** Update node position */
  setNodeValue() {
    let x = this.value,
      y = 0,
      z = 1 - Math.abs(x);
    this.node.setPosition(x, y, z);
  }

  /** Create panner node */
  createNode() {
    this.node = window.audioContextInstance.createPanner();
    this.node.panningModel = this.type;
  }

  /** Remove panner node */
  removeNode() {
    this.node = null;
    return true;
  }

  /** Connect to destination */
  connectNode(destination) {
    this.node.connect(destination);
  }

  /** Disconnect from destination */
  disconnectNode(destination = '') {
    this.node !== null && this.node.disconnect(destination);
  }
}
