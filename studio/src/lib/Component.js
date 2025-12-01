export default (() => {
  let scaleFactorX = -1, scale = -1, preciseFrame,

    /** Bind event listener to element */
    _on = (elem, type, callback) => {
      elem.addEventListener(type, callback, false);
    },

    /** Append multiple event listeners to element */
    _appendEvents = (elem, listeners) => {
      if (elem && typeof listeners === 'object' && listeners !== null) {
        for (const func in listeners) {
          if (listeners.hasOwnProperty(func)) {
            _on(elem, func, listeners[func]);
          }
        }
      }
    },

    /** Create and render DOM element */
    _render = ($parent, tag, props = [], listeners = {}, text = '') => {
      const $node = tag === 'svg' || tag === 'path' || tag === 'line'
        ? document.createElementNS('http://www.w3.org/2000/svg', tag)
        : document.createElement(tag);

      if (tag === 'svg') {
        $node.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }

      props.forEach(obj => {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            $node.setAttributeNS(null, key, obj[key]);
          }
        }
      });

      _appendEvents($node, listeners);
      $node.innerHTML = text !== undefined && text !== null ? text : '';
      $parent.appendChild($node);

      return $node;
    },

    /** Set timeline scale */
    _setScale = newScale => {
      scale = newScale;
    },

    /** Get timeline scale */
    _getScale = () => {
      return scale;
    },

    /** Set scale factor for time/position conversion */
    _setScaleFactor = newScaleFactor => {
      scaleFactorX = newScaleFactor;
    },

    /** Get scale factor */
    _getScaleFactor = () => {
      return scaleFactorX;
    },

    /** Convert time (seconds) to pixel position */
    _getPosXFromTime = sec => {
      if (isNaN(sec) || sec < 0) {
        throw new Error('wrong input: time is ' + sec);
      }

      return scaleFactorX * sec;
    },

    /** Convert pixel position to time (seconds) */
    _getTimeFromPosX = posX => {
      if (isNaN(posX) || posX < 0) {
        throw new Error('wrong input: posX is ' + posX);
      }

      return posX / scaleFactorX;
    },

    /** Format time as mm:ss.ms */
    _getTimeFormatted = time => {
      let sec = ~~time % 60;
      let min = ~~(time / 60) % 60;
      let ms = ~~(time * 100) % 100;

      sec = sec < 10 ? '0' + sec.toFixed(0) : sec.toFixed(0);
      min = min < 10 ? '0' + min.toFixed(0) : min.toFixed(0);
      ms = ms < 10 ? '0' + ms.toFixed(0) : ms.toFixed(0);

      return min + ':' + sec + '.' + ms;
    },

    /** Calculate frame rate from delta time */
    _setFrames = deltaTime => {
      const fps = 1 / deltaTime;
      preciseFrame = 1 / (scale * fps);
    },

    /** Get frame info */
    _getFrames = () => {
      return { frame: Math.ceil(preciseFrame), preciseFrame: parseFloat(preciseFrame) };
    };

  return {
    render: _render,
    appendEvents: _appendEvents,
    setScale: _setScale,
    getScale: _getScale,
    setScaleFactor: _setScaleFactor,
    getScaleFactor: _getScaleFactor,
    getPosXFromTime: _getPosXFromTime,
    getTimeFromPosX: _getTimeFromPosX,
    getTimeFormatted: _getTimeFormatted,
    setFrames: _setFrames,
    getFrames: _getFrames
  };
})();
