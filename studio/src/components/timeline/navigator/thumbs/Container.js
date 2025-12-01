/**
 * Created by valerio bartolini.
 */
import Component from 'Component';
import Config from 'Config';
import Thumb from './Thumb';
/** *************************************************************************************
 *
 *                                        Private methods
 *
 ***************************************************************************************/
let _redraw = (self, width) => {
    self.$node.style.width = width + 'px';
    /* self.$node.appendChild(canvas);*/
    self.$node.classList.remove('hide');
  },
  _moveTo = (self, posX) => {
    let $node = self.$node.style, t;
    t = 'translate3d(' + -posX + 'px,0,0)';
    // self.animation === true ? !self.$node.classList.contains('event-transition') && self.$node.classList.add('event-transition') : self.$node.classList.contains('event-transition') && self.$node.classList.remove('event-transition');
    $node.transform = t;
    $node.msTransform = t;
    self.posX = parseFloat(posX);

    return true;
  },
  _createThumbs = (self, duration) => {
    let num = ~~duration * 2, // 1 thumb every half second
      size = 50, // 0.5 / Component.getScale(),
      i = 50,
      offset = Component.getScale() * 100,
      list = [], // preloadNum = num < 50 ? num : 50, // half second/ scale => width
      createThumbs = () => {
        let starTime = i * 0.5,
          endTime = starTime + offset / 2,
          thumb = new Thumb(self.$node, size, i + 1, starTime, endTime);
        list.push(thumb);
        thumb.loadImg(i + 1)
          .then(() => {
            i++;
            i <= num && createThumbs();
            i > num && list.forEach(elem => {
              elem.$node.classList.remove('hideThumb');
            });
          });
        /*      thumb.load(i + 1, url)
         .then((c) => {
         context.drawImage(c, 50 * i, 0);
         i === num - 1 && _redraw(self, Component.getPosXFromTime(duration), canvas);
         });*/
      };
    self.$node.innerHTML = '';
    /*    let canvas = document.createElement('canvas'), context = canvas.getContext('2d'), base_image = new Image();
     canvas.width = Component.getPosXFromTime(duration);
     canvas.height = 32;*/

    /*
     for (let k = 0; k < preloadNum; k++) {
     let starTime = k * 0.5,
     endTime = starTime + offset / 2,
     thumb = new Thumb(self.$node, size, k + 1, starTime, endTime);
     list.push(thumb);
     thumb.loadImg(k + 1)
     .then(() => {
     list.forEach(elem => {
     k === preloadNum - 1 && elem.$node.classList.remove('hideThumb');
     });
     });
     /!*      thumb.load(i + 1, url)
     .then((c) => {
     context.drawImage(c, 50 * i, 0);
     i === num - 1 && _redraw(self, Component.getPosXFromTime(duration), canvas);
     });*!/
     }
     */

    //  preloadNum === 50 && createThumbs();
    self.thumbContainer = new Thumb(self.$node, Component.getScale());
    _redraw(self, Component.getPosXFromTime(duration));
    return true;
  };
/** *************************************************************************************
 *
 *                                        Class
 *
 ***************************************************************************************/
export default class ContainerThumbs {
  constructor($parent) {
    this.$node = null;
    this.thumbContainer = null;
    this.posX = 0;
    this.duration = 0;
    this.animation = false;
    this.render($parent);
  }

  /** *************************************************************************************
   *
   *                                        Public methods
   *
   ***************************************************************************************/
  /**
   *
   * @param duration
   * @returns {boolean}
   */
  init(duration) {
    this.duration = duration;
    _createThumbs(this, this.duration);
    return true;
  }

  /**
   *
   * @returns {boolean}
   */
  zoom(width, posX) {
    // let scaleDuration = Component.getScale() * 100;
    //  step = scaleDuration / 2; // 2 thumbs each scale duration . es: 1 sec , 2 sec , 5 sec
    /*      thumbs = this.$node.querySelectorAll('.thumb');
     thumbs.forEach(($node) => {
     let startThumbTime = $node.getAttribute('data-start'),
     endThumbTime = $node.getAttribute('data-end'),
     deltaThumbTime = startThumbTime % step;
     $node.style.width = endThumbTime - startThumbTime >= 1 && step > 1 && step - deltaThumbTime <= 0.5 || deltaThumbTime === 0 ? '50px' : 0;
     });*/
    this.thumbContainer.loadImg(Component.getScale());
    _moveTo(this, posX);
    _redraw(this, width);

    return true;
  }

  /**
   *
   * @param posX
   * @returns {boolean}
   */
  moveTo(posX) {
    this.animation = true;
    _moveTo(this, posX);
    this.animation = false;
    return true;
  }

  /**
   *
   * @param posX
   * @returns {boolean}
   */
  updateFrame(posX) {
    this.animation = false;
    _moveTo(this, posX);
    return true;
  }

  render($parent) {
    let props, $thumbs, $preview = null,
      debounceTimer = null,
      thumbCache = new Map(), // LRU-like cache for loaded thumbs
      maxCacheSize = 30,
      currentThumbUrl = null,
      createPreview = () => {
        $preview = document.createElement('div');
        $preview.className = 'thumb-preview';
        $preview.innerHTML = `
          <div class="preview-image"></div>
          <div class="preview-time"></div>
        `;
        document.body.appendChild($preview);
      },
      loadThumb = (time) => {
        const url = Config.getSingleThumbSrc(time);

        // Check cache first
        if (thumbCache.has(url)) {
          return Promise.resolve(thumbCache.get(url));
        }

        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            // Add to cache, remove oldest if full
            if (thumbCache.size >= maxCacheSize) {
              const firstKey = thumbCache.keys().next().value;
              thumbCache.delete(firstKey);
            }
            thumbCache.set(url, { url, width: img.naturalWidth, height: img.naturalHeight });
            resolve(thumbCache.get(url));
          };
          img.onerror = () => {
            resolve(null);
          };
          img.src = url;
        });
      },
      // Round time to nearest 0.5 second for consistent caching
      roundTimeForCache = (time) => Math.round(time * 2) / 2,
      preloadAdjacentThumbs = (time) => {
        // Preload ±0.5 second thumbs (using same rounding)
        const times = [time - 0.5, time + 0.5].filter(t => t >= 0 && t <= this.duration);
        times.forEach(t => {
          const roundedT = roundTimeForCache(t);
          const url = Config.getSingleThumbSrc(roundedT);

          if (!thumbCache.has(url)) {
            const img = new Image();
            img.src = url;
            img.onload = () => {
              if (thumbCache.size >= maxCacheSize) {
                const firstKey = thumbCache.keys().next().value;
                thumbCache.delete(firstKey);
              }
              thumbCache.set(url, { url, width: img.naturalWidth, height: img.naturalHeight });
            };
          }
        });
      },
      updatePreviewPosition = (e, rect) => {
        $preview.style.left = (e.clientX - 80) + 'px';
        $preview.style.top = (rect.top - 130) + 'px';
      },
      updatePreview = (e) => {
        if (!$preview) {
          createPreview();
        }

        const rect = $thumbs.getBoundingClientRect();
        const mouseX = e.clientX - rect.left + this.posX;
        const time = Math.max(0, Component.getTimeFromPosX(mouseX));
        const roundedTime = roundTimeForCache(time); // Round to nearest 0.5s for caching

        // Update time text and position immediately
        $preview.querySelector('.preview-time').textContent = Component.getTimeFormatted(time);
        updatePreviewPosition(e, rect);
        $preview.classList.add('visible');

        // Check if we already have this thumb loaded
        const thumbUrl = Config.getSingleThumbSrc(roundedTime);

        const $previewImage = $preview.querySelector('.preview-image');

        if (thumbCache.has(thumbUrl)) {
          const thumb = thumbCache.get(thumbUrl);
          $previewImage.classList.remove('loading');
          $previewImage.style.backgroundImage = `url(${thumb.url})`;
          $previewImage.style.width = thumb.width + 'px';
          $previewImage.style.height = thumb.height + 'px';
          $previewImage.style.backgroundSize = 'contain';
          $previewImage.style.backgroundPosition = 'center';
          currentThumbUrl = thumbUrl;
          preloadAdjacentThumbs(roundedTime);

          return;
        }

        // Show loader while fetching, hide previous image
        $previewImage.classList.add('loading');
        $previewImage.style.backgroundImage = 'none';

        // Debounce the API call for new thumbs
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(async () => {
          const thumb = await loadThumb(roundedTime);

          if (thumb && $preview.classList.contains('visible')) {
            $previewImage.classList.remove('loading');
            $previewImage.style.backgroundImage = `url(${thumb.url})`;
            $previewImage.style.width = thumb.width + 'px';
            $previewImage.style.height = thumb.height + 'px';
            $previewImage.style.backgroundSize = 'contain';
            $previewImage.style.backgroundPosition = 'center';
            currentThumbUrl = thumbUrl;
            preloadAdjacentThumbs(roundedTime);
          }
        }, 50); // 50ms debounce
      },
      hidePreview = () => {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        if ($preview) {
          $preview.classList.remove('visible');
        }
      },
      listeners = {
        mousemove: updatePreview,
        mouseleave: hidePreview
      };

    props = [{class: 'thumbs'}];
    $thumbs = Component.render($parent, 'div', props, listeners);
    props = [{class: 'list-unstyled'}];
    this.$node = Component.render($thumbs, 'ul', props);
  }
}
