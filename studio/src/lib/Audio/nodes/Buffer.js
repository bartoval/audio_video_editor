import Config from 'Config';
import Loader from 'loader/Loader';
import FFmpegWasm from '../FFmpegWasm';

export default class Buffer {
  constructor(config) {
    this.start = config.startTimeBuffer;
    this.end = config.endTimeBuffer;
    this.isCutBuffer = config.isCutBuffer || false;
    this.duration = 0;
    this.originalDuration = 0;
    this.loaded = false;
    this.stretchFactor = 1;
    this.pitchValue = 0;
    this.originalBuffer = null; // Store original buffer for re-processing
    this.buffer = this.setBuffer(config.idTrack, config.start, config.end, config.buffer);
  }

  /** Get buffer promise */
  get() {
    return new Promise(resolve => {
      resolve(this.buffer);
    });
  }

  /** Time-stretch audio buffer */
  stretch(idTrack, stretchFactor1, pitchValue = 0) {
    const stretchFactor = parseFloat(stretchFactor1.toFixed(2));
    this.stretchFactor = stretchFactor;
    this.pitchValue = pitchValue;

    Loader.show();

    if (Config.isWasmEnabled()) {
      return this._stretchWASM(idTrack, stretchFactor, pitchValue);
    }

    return this._stretchServer(idTrack, stretchFactor, pitchValue);
  }

  /** Stretch via WASM */
  async _stretchWASM(idTrack, stretchFactor, pitchValue) {
    try {
      // Use original buffer if available, otherwise use current
      const sourceBuffer = this.originalBuffer || await this.buffer;

      // Save original buffer on first stretch
      if (!this.originalBuffer) {
        this.originalBuffer = sourceBuffer;
      }

      // Check duration limit for WASM (5 minutes max)
      const MAX_DURATION_WASM = 300;

      if (sourceBuffer.duration > MAX_DURATION_WASM) {
        console.warn('[Stretch WASM] File too long, falling back to server');

        return this._stretchServer(idTrack, stretchFactor, pitchValue);
      }

      console.log(`[Stretch WASM] Processing from ORIGINAL: tempo=${stretchFactor}, pitch=${pitchValue}`);

      // RubberBandWasm.stretch now returns AudioBuffer directly
      const newBuffer = await FFmpegWasm.stretch(
        sourceBuffer, // Always use original
        stretchFactor,
        pitchValue,
        (percent) => {
          console.log(`[Stretch WASM] ${percent}%`);
        }
      );

      this.buffer = Promise.resolve(newBuffer);
      this.duration = newBuffer.duration;

      Loader.hide();

      return true;
    } catch (error) {
      console.error('[Stretch WASM] Failed, falling back to server:', error);

      return this._stretchServer(idTrack, stretchFactor, pitchValue);
    }
  }

  /** Stretch via server */
  _stretchServer(idTrack, stretchFactor, pitchValue) {
    const body = JSON.stringify({
      userId: Config.getUserId(),
      uuid: Config.getUuid(),
      idTrack: idTrack,
      pitchValue: pitchValue,
      stretchFactor: stretchFactor.toFixed(1),
      startTime: this.start,
      duration: this.end - this.start
    });

    console.log('[Stretch Server]', body);

    return window.fetch(Config.getUrl('stretch'), {
      method: 'POST',
      body: body
    })
      .then(response => response.json())
      .then(response => {
        this.buffer = this.setBuffer(response.idTrack);
        Loader.hide();

        return this.buffer.then(() => {
          window.fetch(Config.getUrl('stretchAck') + '/' + response.idTrack);

          return true;
        });
      })
      .catch(err => {
        Loader.hide();
        throw err;
      });
  }

  /** Decode ArrayBuffer to AudioBuffer */
  _decodeArrayBuffer(arrayBuffer) {
    return new Promise((resolve, reject) => {
      window.audioContextInstance.decodeAudioData(
        arrayBuffer,
        audioBuffer => resolve(audioBuffer),
        error => reject(error)
      );
    });
  }

  /** Set buffer from track or existing buffer */
  setBuffer(idTrack, start = -1, end = -1, buffer = null) {
    let resize = buff => {
        let crop = () => {
            let sampleRate = buff.sampleRate, channels = buff.numberOfChannels,
              startS = ~~(start * sampleRate), endS = ~~(end * sampleRate),
              newLength = endS - startS,
              newBuff = window.audioContextInstance.createBuffer(channels, newLength, sampleRate);
            for (let i = 0; i < channels; ++i) {
              endS = endS > buff.length ? buff.length : endS;
              newBuff.getChannelData(i).set(buff.getChannelData(i).subarray(startS, endS));
            }
            return newBuff;
          },
          newBuffer = start > -1 && end > -1 ? crop() : buff;
        this.duration = newBuffer.duration;
        this.originalDuration = this.duration;
        this.loaded = true;
        buff = null;
        return newBuffer;
      },
      decode = arrayBuffer => {
        return new Promise((resolve, reject) => {
          window.audioContextInstance.decodeAudioData(arrayBuffer, audioBuffer => {
            resolve(audioBuffer);
          }, e => {
            reject(e);
          });
        });
      };

    return new Promise((resolve, reject) => {
      if (buffer !== null) {
        buffer.then(buff => {
          resolve(resize(buff)); // resize buffer if needed
        });
      }
      else {
        let url = Config.getTrack(idTrack);
        Loader.show();
        window.fetch(url)
          .then(response => {
            return response.arrayBuffer();
          })
          .then(res => {
            decode(res)
              .then(buff => {
                resolve(resize(buff)); // resize buffer if needed
              })
              .catch(e => {
                reject(e);
              });
          });
      }
    })
      .then(buff => {
        Loader.hide();
        return buff;
      })
      .catch(e => {
        this.loaded = false;
        Loader.hide();
        throw new Error('Decoding audio error: Browser not support mp3 or wrong audio file: ' + e);
      });
  }

  /** Check if loaded */
  isLoaded() {
    return this.loaded;
  }

  /** Get start time */
  getStart() {
    return parseFloat(this.start);
  }

  /** Get end time */
  getEnd() {
    return parseFloat(this.end);
  }

  /** Set duration */
  setDuration(duration) {
    this.duration = duration;
  }

  /** Get duration */
  getDuration() {
    return parseFloat(this.duration).toFixed(2);
  }

  /** Get stretch factor */
  getStretchFactor() {
    return 1 / this.stretchFactor;
  }

  /** Get pitch value */
  getPitchValue() {
    return ~~this.pitchValue;
  }
}
