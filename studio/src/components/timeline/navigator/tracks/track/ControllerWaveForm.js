/**
 * Created by valerio bartolini.
 */
import Component from 'Component';
import Config from 'Config';

const { waveformColor } = Config.getUI();
/** *************************************************************************************
 *
 *                                        Private methods
 *
 ***************************************************************************************/
const NUM_CANVAS = 6;

let _redraw = (self, width1, path, scale) => {
  const height = self.$node.offsetHeight;
  const width = width1 / NUM_CANVAS;
  const halfHeight = height / 2;

  self.blob.getWaveForm(scale)
    .then(data => {
      const { path: dataPath } = data;
      const canvass = self.canvasCache; // Use cached canvas references
      const supportCtx = self.supportCtx; // Cached support canvas context

      let start = 0;
      let end = ~~(width * 2);

      for (let i = 0; i < NUM_CANVAS; i++) {
        const canvas = canvass[i];
        const ctx = self.contextCache[i]; // Use cached context

        // Set dimensions
        canvas.width = width;
        canvas.height = height;
        canvas.style.left = (start / 2) + 'px';

        // Draw waveform
        ctx.clearRect(0, 0, width, height);
        ctx.beginPath();
        ctx.moveTo(0, halfHeight);

        // Iterate directly over data without slice()
        const startIdx = start + 1;
        const endIdx = Math.min(end, dataPath.length);
        const offsetX = start / 2;

        for (let j = startIdx; j < endIdx; j++) {
          const { x, y } = dataPath[j];
          ctx.lineTo(x - offsetX, y * halfHeight + halfHeight);
        }

        ctx.lineTo(width, halfHeight);
        ctx.strokeStyle = waveformColor;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Handle stereo channel view
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

        // Update indices for next canvas
        start = end;
        end = ~~(start + width * 2);
      }

      return true;
    })
    .catch(e => {
      console.error('Waveform error:', e);
    });
};
/** *************************************************************************************
 *
 *                                        Class
 *
 ***************************************************************************************/
export default class ControllerWaveform {
  constructor(config, blob, $parent) {
    this.$node = null;
    this.viewBox = config.viewBox || 0;
    this.blob = blob;
    this.channelsView = false;
    this.canvasCache = [];
    this.contextCache = [];
    this.supportCanvas = null;
    this.supportCtx = null;
    this.render($parent, config.path);
  }

  /** *************************************************************************************
   *
   *                                        Public methods
   *
   ***************************************************************************************/
  /**
   *
   * @param width
   * @returns {boolean}
   */
  resize(width) {
    _redraw(this, width, false, Component.getScale());
    return true;
  }

  /**
   *
   * @returns {boolean}
   */
  loading() {
    for (let i = 0; i < NUM_CANVAS; i++) {
      const canvas = this.canvasCache[i];
      const ctx = this.contextCache[i];

      if (!canvas || !ctx) {
        return false;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    return true;
  }

  mono() {
    this.channelsView = true;
    _redraw(this, this.$node.offsetWidth, false, Component.getScale());
  }

  stereo() {
    this.channelsView = false;
    _redraw(this, this.$node.offsetWidth, false, Component.getScale());
  }

  /**
   *
   * @param startPosX
   * @param stretchFactor
   * @returns {{data: ImageData, width, height, stretchFactor: *, scale: *}}
   */
  getCopy(startPosX, stretchFactor) {
    let $waveform = this.$node.querySelector('.waveform-svg');
    return {
      data: $waveform.getContext('2d').getImageData(startPosX / stretchFactor, 0, $waveform.width, $waveform.height),
      width: $waveform.width,
      height: $waveform.height,
      stretchFactor: stretchFactor,
      scale: Component.getScale()
    };
  }

  render($parent, path) {
    const width = $parent.offsetWidth;
    const canvasStretch = 100 / NUM_CANVAS;

    // Create waveform container
    this.$node = Component.render($parent, 'div', [{class: 'waveform'}]);
    const height = this.$node.offsetHeight;

    // Create spinner
    Component.render(this.$node, 'div', [{class: 'spinner hide', style: 'left:45%'}]);

    // Create and cache canvas elements and their contexts
    this.canvasCache = [];
    this.contextCache = [];

    for (let i = 0; i < NUM_CANVAS; i++) {
      const canvas = Component.render(this.$node, 'canvas', [
        {class: 'waveform-svg', height: height, style: 'width:' + canvasStretch + '%'}
      ]);
      this.canvasCache.push(canvas);
      this.contextCache.push(canvas.getContext('2d'));
    }

    // Create and cache support canvas for stereo view
    this.supportCanvas = document.createElement('canvas');
    this.supportCanvas.height = height * 2;
    this.supportCtx = this.supportCanvas.getContext('2d');

    _redraw(this, width, path, Component.getScale());
  }
}

