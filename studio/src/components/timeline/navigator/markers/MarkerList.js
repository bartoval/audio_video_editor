import Marker from './Marker';

/**
 * MarkerList - ordered collection of markers sorted by time
 * Provides navigation (prev/next) and selection management
 */
export default class MarkerList {
  constructor() {
    this.items = [];
    this.selected = null;
  }

  add(markerOrConfig) {
    const marker = markerOrConfig instanceof Marker ? markerOrConfig : new Marker(markerOrConfig);

    this.items.push(marker);
    this.#sortByTime();

    return marker;
  }

  remove(id) {
    const index = this.items.findIndex(marker => marker.getId() === id);

    if (index === -1) {
      return null;
    }

    const [removed] = this.items.splice(index, 1);

    if (this.selected?.getId() === id) {
      this.selected = null;
    }

    return removed;
  }

  get(id) {
    return this.items.find(marker => marker.getId() === id) || null;
  }

  getByIndex(index) {
    return this.items[index] || null;
  }

  getAtTime(time, threshold = 0.1) {
    return this.items.find(marker => Math.abs(marker.getTime() - time) <= threshold) || null;
  }

  getNearest(time) {
    if (this.items.length === 0) {
      return null;
    }

    let nearest = this.items[0];
    let minDiff = Math.abs(nearest.getTime() - time);

    for (const marker of this.items) {
      const diff = Math.abs(marker.getTime() - time);

      if (diff < minDiff) {
        minDiff = diff;
        nearest = marker;
      }
    }

    return nearest;
  }

  getPrevious(time) {
    for (let idx = this.items.length - 1; idx >= 0; idx--) {
      const marker = this.items[idx];

      if (marker.getTime() < time) {
        return marker;
      }
    }

    return null;
  }

  getNext(time) {
    for (const marker of this.items) {
      if (marker.getTime() > time) {
        return marker;
      }
    }

    return null;
  }

  first() {
    return this.items[0] || null;
  }

  last() {
    return this.items[this.items.length - 1] || null;
  }

  all() {
    return this.items;
  }

  count() {
    return this.items.length;
  }

  clear() {
    this.items = [];
    this.selected = null;
  }

  resort() {
    this.#sortByTime();
  }

  select(markerOrId) {
    if (markerOrId instanceof Marker) {
      this.selected = markerOrId;
    } else {
      this.selected = this.get(markerOrId);
    }

    return this.selected;
  }

  getSelected() {
    return this.selected;
  }

  selectPrevious(currentTime) {
    const prev = this.getPrevious(currentTime);

    if (prev) {
      this.selected = prev;
    }

    return prev;
  }

  selectNext(currentTime) {
    const next = this.getNext(currentTime);

    if (next) {
      this.selected = next;
    }

    return next;
  }

  forEach(callback) {
    this.items.forEach(callback);
  }

  map(callback) {
    return this.items.map(callback);
  }

  find(predicate) {
    return this.items.find(predicate) || null;
  }

  toJSON() {
    return this.items.map(marker => marker.toJSON());
  }

  fromJSON(data) {
    this.clear();

    if (Array.isArray(data)) {
      for (const item of data) {
        this.add(Marker.fromJSON(item));
      }
    }

    return this;
  }

  static fromScenes(scenes) {
    const list = new MarkerList();

    if (Array.isArray(scenes)) {
      for (const scene of scenes) {
        list.add(Marker.fromScene(scene));
      }
    }

    return list;
  }

  #sortByTime() {
    this.items.sort((markerA, markerB) => markerA.getTime() - markerB.getTime());
  }
}
