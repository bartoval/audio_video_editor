import { getTimeFromPosX, getPosXFromTime, generateUuid } from '../../../../lib';
import SnappingService from '../../../../services/SnappingService';
import { MarkerList } from './index';
import { createMarkerLayer } from './view';

/**
 * MarkerController - manages timeline markers (points in time)
 */
export default class MarkerController {
  #markerCounter = 0;

  #onMove = null;
  #onScrubberMove = null;
  #onAdd = null;
  #onEdit = null;
  #onRemove = null;
  #onSelect = null;

  constructor($parent, callbacks = {}) {
    this.#onMove = callbacks.onMove || (() => {});
    this.#onScrubberMove = callbacks.onScrubberMove || (() => {});
    this.#onAdd = callbacks.onAdd || (() => {});
    this.#onEdit = callbacks.onEdit || (() => {});
    this.#onRemove = callbacks.onRemove || (() => {});
    this.#onSelect = callbacks.onSelect || (() => {});

    this.items = new MarkerList();
    this.view = createMarkerLayer($parent);
    this.ruler = null;

    this.#bindEvents();
  }

  #bindEvents() {
    this.view.bind({
      onMarkerClick: id => this.#handleMarkerClick(id),
      onMarkerRightClick: id => this.remove(id),
      onMarkerDrag: (id, posX) => this.#handleMarkerDrag(id, posX),
      onLayerClick: posX => this.#handleLayerClick(posX)
    });
  }

  #handleMarkerClick(id) {
    this.select(id);
  }

  #handleLayerClick(clientX) {
    const posX = this.#getPosX(clientX);

    this.addAt(posX);
  }

  #handleMarkerDrag(id, posX) {
    const snappedPosX = SnappingService.snap(posX);
    const time = getTimeFromPosX(snappedPosX);

    this.edit(id, { time });
  }

  #getPosX(clientX) {
    const rect = this.view.el.getBoundingClientRect();

    return clientX - rect.left + this.ruler.getPosX();
  }

  init(config, ruler) {
    this.ruler = ruler;
    this.#markerCounter = 0;

    this.items.clear();
    this.view.setState({ markers: [] });

    if (Array.isArray(config) && config.length > 0) {
      for (const item of config) {
        this.#markerCounter++;
        this.items.add(item);
      }
    }

    this.#render();
    this.updateSnapPoints();

    return true;
  }

  add(config) {
    const marker = this.items.add(config);

    this.#onAdd(marker.toJSON());
    this.#render();
    this.updateSnapPoints();

    return marker;
  }

  addAt(posX) {
    const snappedPosX = SnappingService.snap(posX);
    const time = getTimeFromPosX(snappedPosX);

    if (this.items.getAtTime(time, 0.1)) {
      return null;
    }

    this.#markerCounter++;

    const marker = this.add({
      id: generateUuid(),
      time,
      label: `Marker ${this.#markerCounter}`,
      type: 'user'
    });

    return marker;
  }

  addAtPlayhead() {
    return this.addAt(this.ruler.getAbsolutePosX());
  }

  remove(id) {
    const marker = this.items.remove(id);

    if (!marker) {
      return false;
    }

    this.#onRemove({ id });
    this.#render();
    this.updateSnapPoints();

    return true;
  }

  edit(id, config) {
    const marker = this.items.get(id);

    if (!marker) {
      return false;
    }

    if (config.time !== undefined) {
      marker.setTime(config.time);
      this.items.resort();
    }

    if (config.label !== undefined) {
      marker.setLabel(config.label);
    }

    this.#onEdit(marker.toJSON());
    this.#render();
    this.updateSnapPoints();

    return true;
  }

  select(id) {
    const marker = this.items.select(id);

    if (!marker) {
      return null;
    }

    this.view.setState({ selectedId: id });
    this.#onSelect(marker.toJSON());

    const markerPosX = getPosXFromTime(marker.getTime());
    const viewportStart = this.ruler.getPosX();
    const viewportEnd = viewportStart + this.ruler.getRange().width;
    const isOutsideViewport = markerPosX < viewportStart || markerPosX > viewportEnd;

    if (isOutsideViewport) {
      this.#onMove({ time: marker.getTime(), posX: markerPosX });
    } else {
      this.#onScrubberMove({ time: marker.getTime(), posX: markerPosX });
    }

    return marker;
  }

  getSelected() {
    return this.items.getSelected();
  }

  goToPrevious(currentTime = 0) {
    const selected = this.items.getSelected();
    const allMarkers = this.items.all();

    if (allMarkers.length === 0) {
      return null;
    }

    if (selected) {
      const currentIndex = allMarkers.findIndex(marker => marker.getId() === selected.getId());

      if (currentIndex > 0) {
        const marker = allMarkers[currentIndex - 1];
        this.select(marker.getId());

        return marker;
      }

      return null;
    }

    for (let idx = allMarkers.length - 1; idx >= 0; idx--) {
      const marker = allMarkers[idx];

      if (marker.getTime() < currentTime) {
        this.select(marker.getId());

        return marker;
      }
    }

    const marker = allMarkers[allMarkers.length - 1];
    this.select(marker.getId());

    return marker;
  }

  goToNext(currentTime = 0) {
    const selected = this.items.getSelected();
    const allMarkers = this.items.all();

    if (allMarkers.length === 0) {
      return null;
    }

    if (selected) {
      const currentIndex = allMarkers.findIndex(marker => marker.getId() === selected.getId());

      if (currentIndex < allMarkers.length - 1) {
        const marker = allMarkers[currentIndex + 1];
        this.select(marker.getId());

        return marker;
      }

      return null;
    }

    for (const marker of allMarkers) {
      if (marker.getTime() > currentTime) {
        this.select(marker.getId());

        return marker;
      }
    }

    const marker = allMarkers[0];
    this.select(marker.getId());

    return marker;
  }

  zoom() {
    this.#render();
    this.updateSnapPoints();

    return this.moveTo(this.ruler.getPosX());
  }

  moveTo(posX) {
    this.view.setState({ translateX: -posX });

    return true;
  }

  updateFrame(posX) {
    if (posX <= 0) {
      return false;
    }

    this.view.setState({ translateX: -posX });

    return true;
  }

  export() {
    return this.items.toJSON();
  }

  getMarkers() {
    return this.items.all();
  }

  count() {
    return this.items.count();
  }

  getLoopBounds() {
    const markers = this.items.all();

    if (markers.length < 2) {
      return null;
    }

    return {
      start: markers[0].getTime(),
      end: markers[1].getTime()
    };
  }

  clampToDuration(duration) {
    const markers = this.items.all();
    let changed = false;

    for (const marker of markers) {
      if (marker.getTime() > duration) {
        marker.setTime(duration);
        changed = true;
      }
    }

    if (changed) {
      this.items.resort();
      this.#render();
      this.updateSnapPoints();
    }
  }

  updateSnapPoints() {
    const snapPoints = this.items.map(marker => ({
      time: marker.getTime(),
      type: 'marker',
      markerId: marker.getId(),
      label: marker.getLabel()
    }));

    SnappingService.registerSnapPoints('markers', snapPoints);
  }

  destroy() {
    SnappingService.clearSnapPoints('markers');
    this.items.clear();
    this.view.destroy();

    this.#onMove = null;
    this.#onScrubberMove = null;
    this.#onAdd = null;
    this.#onEdit = null;
    this.#onRemove = null;
    this.#onSelect = null;
  }

  #render() {
    const markers = this.items.map(marker => ({
      id: marker.getId(),
      time: marker.getTime(),
      label: marker.getLabel(),
      posX: getPosXFromTime(marker.getTime())
    }));

    this.view.setState({
      markers,
      selectedId: this.items.getSelected()?.getId() || null
    });
  }
}
