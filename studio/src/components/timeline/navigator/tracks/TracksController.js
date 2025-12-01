import { TRACKS } from '../../../../constants';
import { Signals, getTimeFromPosX } from '../../../../lib';
import { ZoneListController } from '../../../core/zones';
import Track from './TrackPresenter';
import CutService from './CutService';
import TracksEventHandler from './TracksEventHandler';

export default class ContainerTracks {
  #controller = null;
  #$tracks = null;
  #$placeholder = null;
  #ruler = null;

  isCutMode = false;
  cutStartTime = null;

  constructor($parent) {
    this.#$tracks = this.#createTracksElement($parent);
    this.#$placeholder = this.#createPlaceholder();
    this.#controller = new ZoneListController(this.#$tracks);
    new TracksEventHandler(this, this.#controller, this.#$tracks);
    this.onMove = new Signals.Signal();
    this.onSetMenu = new Signals.Signal();
    this.cutService = new CutService();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  async init(config, ruler) {
    this.#ruler = ruler;
    await this.#controller.init(ruler);

    if (config) {
      config.forEach(elem => {
        elem.volumeValues.forEach(volumeValue => {
          const volumeValues = new Float32Array(volumeValue.data.times.length);
          volumeValue.data.times.forEach((_, index) => {
            volumeValues[index] = volumeValue.data.values[index];
          });
          volumeValue.data.values = volumeValues;
        });
        const $parent =
          this.#controller.getComposite(elem.groupId) ||
          this.#controller.addComposite(elem.groupId);
        this.#controller.add(new Track(elem, $parent), null);
      });
    }

    this.onSetMenu.dispatch(null);
    this.#updatePlaceholder();

    return true;
  }

  // ============================================================================
  // Selection
  // ============================================================================

  select(id) {
    const previousZone = this.#controller.getSelected();

    if (previousZone !== null) {
      previousZone.deselect();
    }

    const currentZone =
      this.#controller.setSelected(this.#controller.getChild(id)) && this.#controller.getSelected();

    if (currentZone !== null) {
      currentZone.select();
    }

    this.onSetMenu.dispatch(this);

    return currentZone;
  }

  getSelected() {
    return this.#controller.getSelected();
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  addTrack(config, $parent) {
    this.#controller.add(new Track(config, $parent), null);
    this.select(config.id);
    this.#updatePlaceholder();
  }

  remove(id = null) {
    const currentZone = id ? this.#controller.getChild(id) : this.#controller.getSelected();

    if (!currentZone) {
      return Promise.resolve(false);
    }

    return currentZone.clean().then(() => {
      this.#controller.remove(currentZone.getId());
      this.#updatePlaceholder();

      return true;
    });
  }

  clone() {
    const currentZone = this.#controller.getSelected();
    let $parent = currentZone.getGroupElement()?.nextSibling;

    if ($parent === null) {
      $parent = this.#controller.addComposite(null);
    }

    this.#controller.add(new Track(currentZone.clone(this.#controller.getNewId()), $parent), null);

    return true;
  }

  // ============================================================================
  // Cut Operations
  // ============================================================================

  startCutMode() {
    this.isCutMode = true;

    return this.cutService.start(this.#controller.getSelected());
  }

  cancelCutMode() {
    this.isCutMode = false;
    this.cutStartTime = null;

    return this.cutService.cancel();
  }

  handleCutClick(posX) {
    const result = this.cutService.handleClick(posX);

    if (!result) {
      return false;
    }

    if (result.action === 'execute') {
      this.#executeCut(result.zone, result.cutStart, result.cutEnd);
      this.cancelCutMode();
    } else {
      this.cutStartTime = result.cutStart;
    }

    return true;
  }

  updateCutPreview(posX) {
    return this.cutService.updatePreview(posX);
  }

  #executeCut(currentZone, cutStart, cutEnd) {
    const { MIN_CUT_DURATION } = TRACKS;
    const $parent = currentZone.getGroupElement();
    const cutDuration = cutEnd - cutStart;

    if (cutDuration < MIN_CUT_DURATION) {
      return false;
    }

    const beforeDuration = cutStart;
    const middleDuration = cutDuration;
    const afterStart = cutEnd;
    const afterDuration = currentZone.getDuration() - cutEnd;

    let middleZone = null;

    if (beforeDuration > MIN_CUT_DURATION) {
      currentZone.cut(0, beforeDuration);
      this.#controller.add(
        new Track(currentZone.clone(this.#controller.getNewId()), $parent),
        null
      );
    }

    if (middleDuration > MIN_CUT_DURATION) {
      currentZone.cut(cutStart, middleDuration);
      middleZone = new Track(currentZone.clone(this.#controller.getNewId()), $parent);
      this.#controller.add(middleZone, null);
    }

    if (afterDuration > MIN_CUT_DURATION) {
      currentZone.cut(afterStart, afterDuration);
      this.#controller.add(
        new Track(currentZone.clone(this.#controller.getNewId()), $parent),
        null
      );
    }

    this.remove(currentZone.getId()).then(() => {
      if (middleZone) {
        this.select(middleZone.getId());
      }
    });

    return true;
  }

  cut() {
    const currentZone = this.#controller.getSelected();
    const time = getTimeFromPosX(this.#ruler.getAbsolutePosX());
    const startTime = currentZone.getStart();
    const endTime = currentZone.getEnd();
    const sliceFirst = time - startTime;
    const sliceEnd = endTime - time;
    const $parent = currentZone.getGroupElement();

    const newZone =
      sliceFirst > 0 &&
      sliceEnd > 0 &&
      currentZone.cut(0, sliceFirst) &&
      this.#controller.add(
        new Track(currentZone.clone(this.#controller.getNewId()), $parent),
        null
      ) &&
      currentZone.cut(sliceFirst, sliceEnd) &&
      this.#controller.add(
        new Track(currentZone.clone(this.#controller.getNewId()), $parent),
        null
      );

    if (newZone) {
      this.remove(currentZone.getId()).then(() => {
        this.select(newZone.getId());
      });
    }

    return true;
  }

  // ============================================================================
  // Navigation
  // ============================================================================

  back() {
    const currentZone = this.#controller.getSelected();
    const posX = this.#controller.getPosX();
    const range = this.#ruler.getRange();
    const nextPosX = posX - range.width / 2 - range.left;
    const startPosX = currentZone.getStartPosX();
    const finalPosX = nextPosX < startPosX ? startPosX : nextPosX;

    this.onMove.dispatch(finalPosX);

    return true;
  }

  forward() {
    const currentZone = this.#controller.getSelected();
    const posX = this.#controller.getPosX();
    const range = this.#ruler.getRange();
    const nextPosX = posX + range.width / 2 + range.left;
    const startPosX = currentZone.getStartPosX();
    const maxWidth = this.#ruler.getMaxWidth();
    const endPosX =
      maxWidth > startPosX + currentZone.getWidth() ? startPosX + currentZone.getWidth() : maxWidth;
    const finalPosX = nextPosX > endPosX ? endPosX : nextPosX;

    this.onMove.dispatch(finalPosX);

    return true;
  }

  // ============================================================================
  // View Updates
  // ============================================================================

  zoom() {
    return this.#controller.zoom();
  }

  moveTo(posX) {
    if (posX < 0) {
      return false;
    }

    return this.#controller.moveTo(posX);
  }

  updateFrame(posX) {
    if (posX <= 0) {
      return false;
    }

    return this.#controller.updateFrame(posX);
  }

  // ============================================================================
  // Export
  // ============================================================================

  export() {
    const tracks = [];

    for (let i = 0; i < this.#controller.getNumChildren(); i++) {
      const child = this.#controller.getChildByIndex(i);
      tracks.push(child.export());
    }

    return tracks;
  }

  // ============================================================================
  // Delegate Methods
  // ============================================================================

  getChild(id) {
    return this.#controller.getChild(id);
  }

  getNewId() {
    return this.#controller.getNewId();
  }

  addComposite(id = null) {
    return this.#controller.addComposite(id);
  }

  // ============================================================================
  // Private - DOM
  // ============================================================================

  #createTracksElement($parent) {
    const $tracks = document.createElement('div');
    $tracks.className = 'tracks';
    $parent.appendChild($tracks);

    return $tracks;
  }

  #createPlaceholder() {
    const $placeholder = document.createElement('div');
    $placeholder.className = 'tracks-placeholder';
    $placeholder.innerHTML = `
      <div class="tracks-placeholder-content">
        <i class="bi bi-music-note-list"></i>
        <p>Select or drag audio tracks from the library</p>
      </div>
    `;
    this.#$tracks.appendChild($placeholder);

    return $placeholder;
  }

  #updatePlaceholder() {
    const hasChildren = this.#controller.getNumChildren() > 0;
    this.#$placeholder.style.display = hasChildren ? 'none' : 'flex';
  }
}
