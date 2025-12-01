export default class Oscilloscope {
  constructor(options = {}) {
    const {
      fftSize = 256,
      smoothing = 0.8,
      color = '#64b5f6',
      lineWidth = 2,
      mode = 'frequency'
    } = options;

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
    this.mode = mode; // 'frequency' (bars), 'waveform' (line), 'vu' (VU meter)

    // VU meter state
    this.peakLevel = 0;
    this.peakHoldTime = 0;
    this.peakDecay = 0.95;

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
    if (this.isRunning || !this.analyser) {
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

    if (this.mode === 'waveform') {
      this.analyser.getByteTimeDomainData(this.dataArray);
      this._drawWaveform();
    } else if (this.mode === 'vu') {
      this.analyser.getByteTimeDomainData(this.dataArray);
      this._drawVU();
    } else {
      this.analyser.getByteFrequencyData(this.dataArray);
      this._drawFrequency();
    }
  }

  _drawWaveform() {
    const { canvas, ctx, dataArray, color, lineWidth } = this;
    const { width, height } = canvas;
    const bufferLength = dataArray.length;
    const sliceWidth = width / bufferLength;

    this._clear();

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.beginPath();

    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }

  _drawFrequency() {
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

  _drawVU() {
    const { canvas, ctx, dataArray, color } = this;
    const { width, height } = canvas;

    // Calculate RMS level from time domain data
    let sum = 0;

    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] - 128) / 128;
      sum += v * v;
    }

    const rms = Math.sqrt(sum / dataArray.length);
    const level = Math.min(1, rms * 3); // Amplify for visibility

    // Update peak with decay
    if (level > this.peakLevel) {
      this.peakLevel = level;
      this.peakHoldTime = 30; // Hold for ~30 frames
    } else if (this.peakHoldTime > 0) {
      this.peakHoldTime--;
    } else {
      this.peakLevel *= this.peakDecay;
    }

    this._clear();

    const barHeight = height * 0.6;
    const barY = (height - barHeight) / 2;
    const levelWidth = width * level;
    const peakX = width * this.peakLevel;

    // Background bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(0, barY, width, barHeight);

    // Level gradient (green -> yellow -> red)
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#22c55e');
    gradient.addColorStop(0.6, '#eab308');
    gradient.addColorStop(0.85, '#ef4444');
    gradient.addColorStop(1, '#dc2626');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, barY, levelWidth, barHeight);

    // Peak indicator
    if (this.peakLevel > 0.01) {
      ctx.fillStyle = this.peakLevel > 0.85 ? '#ef4444' : color;
      ctx.fillRect(peakX - 2, barY, 3, barHeight);
    }
  }

  _clear() {
    if (!this.ctx || !this.canvas) {
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
