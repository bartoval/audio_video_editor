/**
 * Lightweight Signal implementation (pub/sub pattern)
 * Replaces the 'signals' npm package
 */
class Signal {
  constructor() {
    this._listeners = [];
  }

  add(fn) {
    this._listeners.push({ fn, once: false });
  }

  addOnce(fn) {
    this._listeners.push({ fn, once: true });
  }

  remove(fn) {
    this._listeners = this._listeners.filter(l => l.fn !== fn);
  }

  dispatch(...args) {
    this._listeners = this._listeners.filter(l => {
      l.fn(...args);

      return !l.once;
    });
  }

  removeAll() {
    this._listeners = [];
  }
}

export default { Signal };
