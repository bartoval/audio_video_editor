import { THEME } from '../../../../../config/ui';
import { TRACKS } from '../../../../../config/constants';
import { getScale, View } from '../../../../../lib';

const { waveformColor } = THEME;
const { WAVEFORM_LINE_WIDTH } = TRACKS;
const NUM_CANVAS = 6;
const Y_SCALE = 1.5; // amplify waveform vertically (clamped to [-1, 1])

const redraw = (self, width1, path, scale, showLoadingOnStart = false) => {
  const height = self.$node.offsetHeight;
  const width = width1 / NUM_CANVAS;
  const halfHeight = height / 2;

  // Show skeleton loading before async fetch
  if (showLoadingOnStart) {
    self.$node.classList.add('skeleton', 'skeleton-loading');
  }

  self.blob
    .getWaveForm(scale)
    .then(data => {
      const { path: dataPath } = data;
      const canvass = self.canvasCache;

      let start = 0;
      let end = ~~(width * 2);

      for (let i = 0; i < NUM_CANVAS; i++) {
        const canvas = canvass[i];
        const ctx = self.contextCache[i];

        canvas.width = width;
        canvas.height = height;
        canvas.style.left = start / 2 + 'px';

        ctx.clearRect(0, 0, width, height);
        ctx.beginPath();
        ctx.moveTo(0, halfHeight);

        const startIdx = start + 1;
        const endIdx = Math.min(end, dataPath.length);
        const offsetX = start / 2;

        for (let j = startIdx; j < endIdx; j++) {
          const { x, y } = dataPath[j];
          const yScaled = Math.max(-1, Math.min(1, y * Y_SCALE));
          ctx.lineTo(x - offsetX, yScaled * halfHeight + halfHeight);
        }

        ctx.lineTo(width, halfHeight);
        ctx.strokeStyle = waveformColor;
        ctx.lineWidth = WAVEFORM_LINE_WIDTH;
        ctx.stroke();

        canvas.style.height = '100%';

        start = end;
        end = ~~(start + width * 2);
      }

      // Hide skeleton when waveform is ready
      self.$node.classList.remove('skeleton', 'skeleton-loading');

      return true;
    })
    .catch(e => {
      console.error('Waveform error:', e);
      self.$node.classList.remove('skeleton', 'skeleton-loading');
    });
};

export default class WaveformController extends View {
  constructor(config, blob, $parent) {
    super($parent);
    this.viewBox = config.viewBox || 0;
    this.blob = blob;
    this.canvasCache = [];
    this.contextCache = [];
    this.path = config.path;
    this.mount();
  }

  /** Create DOM */
  render() {
    const width = this.$parent.offsetWidth;
    const canvasStretch = 100 / NUM_CANVAS;

    this.$node = document.createElement('div');
    this.$node.className = 'waveform';
    this.$parent.appendChild(this.$node);

    const height = this.$node.offsetHeight;

    this.canvasCache = [];
    this.contextCache = [];

    for (let i = 0; i < NUM_CANVAS; i++) {
      const canvas = document.createElement('canvas');
      canvas.className = 'waveform-svg';
      canvas.height = height;
      canvas.style.width = canvasStretch + '%';
      this.$node.appendChild(canvas);
      this.canvasCache.push(canvas);
      // No pixel read-back (getImageData) any more: let the browser keep these on the GPU
      this.contextCache.push(canvas.getContext('2d'));
    }

    // Initial draw with loading skeleton enabled
    redraw(this, width, this.path, getScale(), true);
  }

  resize(width) {
    redraw(this, width, false, getScale());

    return true;
  }

  loading(isLoading = true) {
    if (isLoading) {
      this.$node.classList.add('skeleton', 'skeleton-loading');

      for (let i = 0; i < NUM_CANVAS; i++) {
        const canvas = this.canvasCache[i];
        const ctx = this.contextCache[i];

        if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    } else {
      this.$node.classList.remove('skeleton', 'skeleton-loading');
    }

    return true;
  }

  getCopy(startPosX, stretchFactor) {
    const $waveform = this.$node.querySelector('.waveform-svg');

    return {
      data: $waveform
        .getContext('2d', { willReadFrequently: true })
        .getImageData(startPosX / stretchFactor, 0, $waveform.width, $waveform.height),
      width: $waveform.width,
      height: $waveform.height,
      stretchFactor: stretchFactor,
      scale: getScale()
    };
  }
}
