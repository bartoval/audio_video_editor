import { THEME } from '../../../../../config/ui';
import { TRACKS } from '../../../../../constants';
import { getScale, View } from '../../../../../lib';

const { waveformColor } = THEME;
const { WAVEFORM_LINE_WIDTH } = TRACKS;
const NUM_CANVAS = 6;

const redraw = (self, width1, path, scale, showLoadingOnStart = false) => {
  const height = self.$node.offsetHeight;
  const width = width1 / NUM_CANVAS;
  const halfHeight = height / 2;

  // Show skeleton loading before async fetch
  if (showLoadingOnStart) {
    self.$node.classList.add('skeleton');
  }

  self.blob
    .getWaveForm(scale)
    .then(data => {
      const { path: dataPath } = data;
      const canvass = self.canvasCache;
      const { supportCtx } = self;

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
          ctx.lineTo(x - offsetX, y * halfHeight + halfHeight);
        }

        ctx.lineTo(width, halfHeight);
        ctx.strokeStyle = waveformColor;
        ctx.lineWidth = WAVEFORM_LINE_WIDTH;
        ctx.stroke();

        if (self.channelsView) {
          const imageData = ctx.getImageData(0, 0, width, height);
          self.supportCanvas.width = width;
          supportCtx.putImageData(imageData, 0, 0);
          supportCtx.putImageData(imageData, 0, height);
          ctx.clearRect(0, 0, width, height);
          canvas.height = height * 2;
          ctx.drawImage(self.supportCanvas, 0, 0);
          supportCtx.clearRect(0, 0, width, self.supportCanvas.height);
        }

        canvas.style.height = '100%';

        start = end;
        end = ~~(start + width * 2);
      }

      // Hide skeleton when waveform is ready
      self.$node.classList.remove('skeleton');

      return true;
    })
    .catch(e => {
      console.error('Waveform error:', e);
      self.$node.classList.remove('skeleton');
    });
};

export default class WaveformController extends View {
  constructor(config, blob, $parent) {
    super($parent);
    this.viewBox = config.viewBox || 0;
    this.blob = blob;
    this.channelsView = false;
    this.canvasCache = [];
    this.contextCache = [];
    this.supportCanvas = null;
    this.supportCtx = null;
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
      this.contextCache.push(canvas.getContext('2d', { willReadFrequently: true }));
    }

    this.supportCanvas = document.createElement('canvas');
    this.supportCanvas.height = height * 2;
    this.supportCtx = this.supportCanvas.getContext('2d', { willReadFrequently: true });

    // Initial draw with loading skeleton enabled
    redraw(this, width, this.path, getScale(), true);
  }

  resize(width) {
    redraw(this, width, false, getScale());

    return true;
  }

  loading(isLoading = true) {
    if (isLoading) {
      this.$node.classList.add('skeleton');

      for (let i = 0; i < NUM_CANVAS; i++) {
        const canvas = this.canvasCache[i];
        const ctx = this.contextCache[i];

        if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    } else {
      this.$node.classList.remove('skeleton');
    }

    return true;
  }

  mono() {
    this.channelsView = true;
    redraw(this, this.$node.offsetWidth, false, getScale());
  }

  stereo() {
    this.channelsView = false;
    redraw(this, this.$node.offsetWidth, false, getScale());
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
