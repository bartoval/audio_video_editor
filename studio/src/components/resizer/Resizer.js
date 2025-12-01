/**
 * Created by valerio bartolini.
 */
import Mediator from 'Mediator';
import Component from 'Component';

/** *************************************************************************************
 *
 *                                        Private methods
 *
 ***************************************************************************************/

export default class Resizer {
  constructor($parent) {
    // Dom Root reference
    this.$node = null;
    // attributes
    this.render($parent);
  }

  /** *************************************************************************************
   *
   *                                        Public methods
   *
   ***************************************************************************************/
  init() {
  }

  render($parent) {
    let props, listeners, rafId = null,
      /**
       *
       * @param e
       */
      drag = (e) => {
        e.stopPropagation();
        e.preventDefault();
        let posY = e.clientY;

        // Use requestAnimationFrame to throttle resize calls for smoother performance
        if (rafId) {
          cancelAnimationFrame(rafId);
        }

        rafId = requestAnimationFrame(() => {
          Mediator.onResize(posY - 90);
          rafId = null;
        });
      },
      /**
       *
       */
      removeDrag = () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }

        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', drag, true);
        document.removeEventListener('mouseup', removeDrag, true);
      },
      dragStart = (e) => {
        e.preventDefault();
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'ns-resize';
        document.addEventListener('mouseup', removeDrag, true);
        document.addEventListener('mousemove', drag, true);
      };
    props = [{class: 'resizer resizableY'}];
    /**
     *
     * @param e
     */
    listeners = {
      mousedown: dragStart
    };
    this.$node = Component.render($parent, 'div', props, listeners);
  }
}
