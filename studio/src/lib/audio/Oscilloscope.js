export default class Oscilloscope {
  #analyser = null;
  #dataArray = null;
  #canvas = null;
  #ctx = null;
  #animationId = null;
  #isRunning = false;

  constructor(options = {}) {
    const {
      fftSize = 256,
      smoothing = 0.8,
      color = 'var(--accent-light)',
      lineWidth = 2
    } = options;

    this.fftSize = fftSize;
    this.smoothing = smoothing;
    this.color = this.#resolveColor(color);
    this.lineWidth = lineWidth;
    this.mode = 'frequency';
  }

  connect(sourceNode, audioContext = null) {
    const ctx = audioContext || window.audioContextInstance;

    if (!sourceNode || !ctx) {
      return this;
    }

    this.#createAnalyser(ctx);
    sourceNode.connect(this.#analyser);
    this.#analyser.connect(ctx.destination);

    return this;
  }

  connectInline(sourceNode, audioContext) {
    if (!sourceNode || !audioContext) {
      return this;
    }

    this.#createAnalyser(audioContext);
    sourceNode.connect(this.#analyser);

    return this;
  }

  disconnect() {
    this.stop();

    if (this.#analyser) {
      this.#analyser.disconnect();
      this.#analyser = null;
    }

    this.#dataArray = null;

    return this;
  }

  attach(canvas) {
    if (!canvas) {
      return this;
    }

    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d');

    return this;
  }

  attachAnalyser(analyser) {
    if (!analyser) {
      return this;
    }

    this.#analyser = analyser;
    this.#dataArray = new Uint8Array(analyser.frequencyBinCount);

    return this;
  }

  detach() {
    this.stop();
    this.#canvas = null;
    this.#ctx = null;

    return this;
  }

  start() {
    if (this.#isRunning || !this.#analyser) {
      return this;
    }

    this.#isRunning = true;
    this.#draw();

    return this;
  }

  stop() {
    this.#isRunning = false;

    if (this.#animationId) {
      cancelAnimationFrame(this.#animationId);
      this.#animationId = null;
    }

    if (this.#ctx && this.#canvas) {
      this.#clear();
    }

    return this;
  }

  setColor(color) {
    this.color = this.#resolveColor(color);

    return this;
  }

  isActive() {
    return this.#isRunning;
  }

  destroy() {
    this.disconnect();
    this.detach();
  }

  #createAnalyser(audioContext) {
    if (!audioContext) {
      return;
    }

    this.#analyser = audioContext.createAnalyser();
    this.#analyser.fftSize = this.fftSize;
    this.#analyser.smoothingTimeConstant = this.smoothing;
    this.#dataArray = new Uint8Array(this.#analyser.frequencyBinCount);
  }

  #resolveColor(value) {
    if (typeof value !== 'string') {
      return value;
    }

    const varMatch = value.match(/var\((--[^)]+)\)/);

    if (varMatch) {
      const resolved = getComputedStyle(document.documentElement)
        .getPropertyValue(varMatch[1])
        .trim();

      return resolved || value;
    }

    return value;
  }

  #draw() {
    if (!this.#isRunning) {
      return;
    }

    this.#animationId = requestAnimationFrame(() => this.#draw());

    if (!this.#analyser || !this.#ctx || !this.#canvas) {
      return;
    }

    this.#analyser.getByteFrequencyData(this.#dataArray);
    this.#drawFrequency();
  }

  #drawFrequency() {
    const barCount = 16;
    const barWidth = this.#canvas.width / barCount - 2;
    const barGap = 2;
    const usableBins = Math.floor(this.#dataArray.length * 0.6);

    this.#clear();

    this.#ctx.fillStyle = this.color;

    for (let i = 0; i < barCount; i++) {
      const logIndex = Math.pow(i / barCount, 1.5) * usableBins;
      const dataIndex = Math.floor(logIndex);
      const value = this.#dataArray[dataIndex] / 255;
      const barHeight = Math.max(2, value * this.#canvas.height);
      const x = i * (barWidth + barGap);
      const y = this.#canvas.height - barHeight;

      this.#ctx.fillRect(x, y, barWidth, barHeight);
    }
  }

  #clear() {
    if (!this.#ctx || !this.#canvas) {
      return;
    }

    this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
  }
}
