/** Base Model with observable state */
export default class Model {
  constructor(initialState = {}) {
    this._state = { ...initialState };
    this._listeners = new Set();
    this._batchDepth = 0;
    this._pendingChanges = {};
  }

  getState() {
    return { ...this._state };
  }

  get(key) {
    return this._state[key];
  }

  set(key, value) {
    if (this._state[key] === value) {
      return false;
    }

    const oldValue = this._state[key];
    this._state[key] = value;

    if (this._batchDepth > 0) {
      this._pendingChanges[key] = { oldValue, newValue: value };
    } else {
      this._notify({ [key]: { oldValue, newValue: value } });
    }

    return true;
  }

  update(updates) {
    const changes = {};
    let hasChanges = false;

    for (const [key, value] of Object.entries(updates)) {
      if (this._state[key] !== value) {
        changes[key] = { oldValue: this._state[key], newValue: value };
        this._state[key] = value;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      if (this._batchDepth > 0) {
        Object.assign(this._pendingChanges, changes);
      } else {
        this._notify(changes);
      }
    }

    return hasChanges;
  }

  beginBatch() {
    this._batchDepth++;
  }

  endBatch() {
    this._batchDepth--;

    if (this._batchDepth === 0 && Object.keys(this._pendingChanges).length > 0) {
      const changes = this._pendingChanges;
      this._pendingChanges = {};
      this._notify(changes);
    }
  }

  batch(fn) {
    this.beginBatch();

    try {
      fn();
    } finally {
      this.endBatch();
    }
  }

  subscribe(listener) {
    this._listeners.add(listener);

    return () => this._listeners.delete(listener);
  }

  _notify(changes) {
    for (const listener of this._listeners) {
      try {
        listener(changes, this);
      } catch (error) {
        console.error('[Model] Listener error:', error);
      }
    }
  }

  toJSON() {
    return this.getState();
  }

  fromJSON(data) {
    this.update(data);
  }

  dispose() {
    this._listeners.clear();
    this._state = {};
    this._pendingChanges = {};
  }
}
