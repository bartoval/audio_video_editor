import MasterClock from '../MasterClock';

export default (function ContextAudio() {
  let buffers = new Map(),
    pausedAt = 0,
    _addBuffer = (key, buffer) => {
      buffers.set(key, buffer);
    },
    _removeBuffer = key => {
      buffers.delete(key);
    },
    /** Create AudioContext */
    _createContext = () => {
      if (!window.audioContextInstance) {
        window.AudioContext =
          window.AudioContext ||
          window.webkitAudioContext ||
          window.mozAudioContext ||
          window.oAudioContext ||
          window.msAudioContext;

        if (window.AudioContext) {
          window.audioContextInstance = new AudioContext();
          // Register with MasterClock for sync monitoring
          MasterClock.registerAudioContext(window.audioContextInstance);
        } else {
          console.log('Web Audio API is not supported in this browser');
        }
      }

      return window.audioContextInstance;
    },
    /** Get or create context */
    _getContext = () => {
      return new Promise(resolve => {
        if (window.audioContextInstance && window.audioContextInstance.state !== 'closed') {
          resolve(window.audioContextInstance);
        } else {
          window.audioContextInstance = null;
          resolve(_createContext());
        }
      });
    },
    _getState = () => {
      return window.audioContextInstance.state;
    },
    /** Resume suspended context */
    _resumeContext = () => {
      return (
        window.audioContextInstance.state === 'suspended' &&
        window.audioContextInstance
          .resume()
          .then(() => {
            return true;
          })
          .catch(e => {
            console.log(e);
            return false;
          })
      );
    },
    /** Suspend running context */
    _stopContext = () => {
      return (
        window.audioContextInstance.state === 'running' &&
        window.audioContextInstance
          .suspend()
          .then(() => {
            return true;
          })
          .catch(e => {
            console.log(e);
            return false;
          })
      );
    },
    /** Close context */
    _closeContext = () => {
      return new Promise(resolve => {
        /* window.audioContextInstance !== null && window.audioContextInstance.state !== 'closed' && window.audioContextInstance.close()
         .then(() => {
         window.audioContextInstance = null;
         _createContext();
         resolve(true);
         })
         .catch(e => {
         console.log(e);
         reject(false);
         });
         });*/
        resolve(true);
      });
    },
    /** Play all buffers */
    _play = () => {
      buffers.forEach(elem => {
        let endTime = parseFloat(elem.startedAt) + parseFloat(elem.buffer.getDuration());
        pausedAt < endTime && elem.play();
      });
      _resumeContext();
      return true;
    },
    /** Get current time */
    _getTime = () => {
      return window.audioContextInstance.currentTime - pausedAt;
    },
    /** Get paused position */
    _getPausedAt = () => {
      return pausedAt;
    },
    /** Stop all buffers */
    _stop = () => {
      buffers.forEach(elem => {
        elem.stop();
      });
      pausedAt = 0;
      _stopContext();
    },
    /** Pause at time */
    _pause = time => {
      _stop();
      pausedAt = time;
    };
  _createContext();
  return {
    addBuffer: _addBuffer,
    removeBuffer: _removeBuffer,
    createContext: _createContext,
    getContext: _getContext,
    getState: _getState,
    resume: _resumeContext,
    stop: _stop,
    close: _closeContext,
    play: _play,
    pause: _pause,
    getTime: _getTime,
    getPausedAt: _getPausedAt
  };
})();
