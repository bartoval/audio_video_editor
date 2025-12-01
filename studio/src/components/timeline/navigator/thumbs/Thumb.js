/**
 * Created by valerio bartolini.
 */
import Component from 'Component';
import Config from 'Config';
/** *************************************************************************************
 *
 *                                        Private methods
 *
 ***************************************************************************************/

/** *************************************************************************************
 *
 *                                        Class
 *
 ***************************************************************************************/
export default class Thumb {
  constructor($parent, scale) {
    this.$node = null;
    this.$thumb = null;
    this.render($parent, scale);
  }

  /** *************************************************************************************
   *
   *                                        Public methods
   *
   ***************************************************************************************/

  init() {
    return true;
  }

  loadImg(scale) {
    this.$thumb.src = Config.getThumbsSrc(`${scale}.webp`);
    /* this.$thumb.src = this.src + 'thumb-' + index + '.png';
     return new Promise(resolve => {
     this.$thumb.onload = () => {
     resolve();
     };
     });*/
  }

  /*  /!**
   *
   * @param index
   * @param url
   * @returns {Promise}
   *!/
   load(index, url) {
   let canvas = document.createElement('canvas'), context = canvas.getContext('2d'), base_image = new Image();
   canvas.width = this.width;
   canvas.height = 32;
   base_image.src = url + 'x/thumb-' + index + '.png';
   return new Promise(resolve => {
   base_image.onload = () => {
   context.drawImage(base_image, 0, 0);
   this.$node.appendChild(canvas);
   resolve(canvas);
   };
   });
   }*/
  render($parent, scale) {
    this.$node = Component.render($parent, 'li', [{
      class: 'thumb'
    }]);

    this.$thumb = Component.render(this.$node, 'img', [{
      class: 'img',
      draggable: false,
      loading: 'lazy',
      decoding: 'async',
      src: Config.getThumbsSrc(`${scale}.webp`)
    }]);
  }
}
