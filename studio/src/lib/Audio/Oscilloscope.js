export default class Oscilloscope {
  constructor(options = {}) {
    const { fftSize = 256, smoothing = 0.8, color = '#64b5f6', lineWidth = 2 } = options;

    this.analyser = null;
    this.dataArray = null;
    this.canvas = null;
    this.ctx = null;
    this.animationId = null;
    this.isRunning = false;

    this.fftSize = fftSize;
    this.smoothing = smoothing;
    this.color = color;
    this.lineWidth = lineWidth;

    this._draw = this._draw.bind(this);
  }

  connect(sourceNode, audioContext = null) {
    const ctx = audioContext || window.audioContextInstance;

    if (!sourceNode || !ctx) {
      return this;
    }

    this._createAnalyser(ctx);
    sourceNode.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    return this;
  }

  connectInline(sourceNode, audioContext) {
    if (!sourceNode || !audioContext) {
      return this;
    }

    this._createAnalyser(audioContext);
    sourceNode.connect(this.analyser);

    return this;
  }

  disconnect() {
    this.stop();

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    this.dataArray = null;

    return this;
  }

  attach(canvas) {
    if (!canvas) {
      return this;
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    return this;
  }

  attachAnalyser(analyser) {
    if (!analyser) {
      return this;
    }

    this.analyser = analyser;
    this.dataArray = new Uint8Array(analyser.frequencyBinCount);

    return this;
  }

  detach() {
    this.stop();
    this.canvas = null;
    this.ctx = null;

    return this;
  }

  start() {
    if (this.isRunning || !this.analyser || !this.ctx) {
      return this;
    }

    this.isRunning = true;
    this._draw();

    return this;
  }

  stop() {
    this.isRunning = false;

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.ctx && this.canvas) {
      this._clear();
    }

    return this;
  }

  setColor(color) {
    this.color = color;

    return this;
  }

  isActive() {
    return this.isRunning;
  }

  destroy() {
    this.disconnect();
    this.detach();
  }

  _createAnalyser(audioContext) {
    if (!audioContext) {
      return;
    }

    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = this.smoothing;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
  }

  _draw() {
    if (!this.isRunning) {
      return;
    }

    this.animationId = requestAnimationFrame(this._draw);

    if (!this.analyser || !this.ctx || !this.canvas) {
      return;
    }

    this.analyser.getByteFrequencyData(this.dataArray);
    this._drawWaveform();
  }

  _drawWaveform() {
    const { canvas, ctx, dataArray, color } = this;
    const { width, height } = canvas;
    const barCount = 16;
    const barWidth = width / barCount - 2;
    const barGap = 2;
    const usableBins = Math.floor(dataArray.length * 0.6);

    this._clear();

    ctx.fillStyle = color;

    for (let i = 0; i < barCount; i++) {
      const logIndex = Math.pow(i / barCount, 1.5) * usableBins;
      const dataIndex = Math.floor(logIndex);
      const value = dataArray[dataIndex] / 255;
      const barHeight = Math.max(2, value * height);
      const x = i * (barWidth + barGap);
      const y = height - barHeight;

      ctx.fillRect(x, y, barWidth, barHeight);
    }
  }

  _clear() {
    if (!this.ctx || !this.canvas) {
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
