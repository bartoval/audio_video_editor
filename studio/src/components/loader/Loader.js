import Component from 'Component';
import { show, hide } from 'utils/dom';

export default (() => {
  let $node = null;
  let numCalls = 0;

  const render = () => {
    const $parent = document.querySelector('.studio-loader');
    $node = Component.render($parent, 'div', [{ class: 'loader hide' }]);
    const $loader = Component.render($node, 'div', [{ class: 'cs-loader' }]);
    const $inner = Component.render($loader, 'div', [{ class: 'cs-loader-inner' }]);

    for (let i = 0; i < 6; i++) {
      Component.render($inner, 'label', [{ class: '' }], {}, '.');
    }
  };

  render();

  return {
    show: () => {
      numCalls++;
      show($node, 'hide');

      return true;
    },
    hide: () => {
      numCalls--;
      numCalls = numCalls < 0 ? 0 : numCalls;

      if (numCalls === 0) {
        hide($node, 'hide');
      }

      return true;
    }
  };
})();
