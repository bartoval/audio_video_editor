import Component from 'Component';
import { applyTransform3d } from 'utils/animation';

export default (() => {
  let $node = null;
  let $scrubberTimeCanvas = null;

  const render = () => {
    const $parent = document.querySelector('.studio');
    $node = Component.render($parent, 'div', [{ class: 'time-popup' }], {}, '');
    $scrubberTimeCanvas = Component.render($node, 'canvas', [{ class: 'time-canvas', height: 16, width: 100 }], {});
    $scrubberTimeCanvas.getContext('2d').fillStyle = 'black';
    $scrubberTimeCanvas.getContext('2d').font = 'normal normal 12px system-ui';
  };

  render();

  return {
    update: time => {
      const ctx = $scrubberTimeCanvas.getContext('2d');
      ctx.clearRect(0, 0, $scrubberTimeCanvas.width, $scrubberTimeCanvas.height);
      ctx.fillText(Component.getTimeFormatted(time), 0, $scrubberTimeCanvas.height - 3);

      return true;
    },
    moveTo: (posX, posY) => {
      applyTransform3d($node, posX, posY, 0);

      return true;
    }
  };
})();
