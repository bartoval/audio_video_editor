import Component from 'Component';
import Config from 'Config';
import Signals from 'signals';
import Container from 'Zones/Container';
import Track from './Track';

export default class ContainerTracks extends Container {
  constructor($parent) {
    super();
    this.render($parent);
    super.render($parent.querySelector('.tracks'));
    this.onMove = new Signals.Signal();
    this.onSetMenu = new Signals.Signal();
  }

  /** Initialize tracks container */
  async init(config, ruler) {
    await super.init(ruler);

    if (config) {
      config.forEach(elem => {
        elem.volumeValues.forEach((volumeValue) => {
          const volumeValues = new Float32Array(volumeValue.data.times.length);
          volumeValue.data.times.forEach((obj, index) => {
            volumeValues[index] = volumeValue.data.values[index];
          });
          volumeValue.data.values = volumeValues;
        });
        const $parent = this.getComposite(elem.groupId) || this.addComposite(elem.groupId);
        super.add(new Track(elem, $parent), null);
      });
    }

    this.onSetMenu.dispatch(null);

    return true;
  }

  /** Select track by id */
  select(id) {
    const previousZone = this.getSelected();

    if (previousZone !== null) {
      previousZone.deselect();
    }

    const currentZone = this.setSelected(this.getChild(id)) && this.getSelected();

    if (currentZone !== null) {
      currentZone.select();
    }

    this.onSetMenu.dispatch(this); // show menu track

    return currentZone;
  }

  /** Remove selected track */
  remove() {
    let currentZone = this.getSelected();
    return currentZone.clean().then(() => {
      super.remove();
      return true;
    });
  }

  /** Cut track at scrubber position */
  cut() {
    let currentZone = this.getSelected(),
      time = Component.getTimeFromPosX(this.ruler.getAbsolutePosX()),
      startTime = currentZone.getStart(),
      endTime = currentZone.getEnd(),
      sliceFirst = time - startTime,
      sliceEnd = endTime - time,
      $parent = currentZone.$node.parentNode,
      newZone = sliceFirst > 0 && sliceEnd > 0 &&
        currentZone.cut(0, sliceFirst) && super.add(new Track(currentZone.clone(this.getNewId()), $parent), null) &&
        currentZone.cut(sliceFirst, sliceEnd) && super.add(new Track(currentZone.clone(this.getNewId()), $parent), null); // new zone to be selected

    newZone && this.remove(currentZone).then(() => {
      this.select(newZone.getId());
    });
    return true;
  }

  /** Clone selected track */
  clone() {
    let currentZone = this.getSelected(),
      $parent = currentZone.$node.parentNode.nextSibling;
    if ($parent === null) {
      $parent = this.addComposite(null);
    }
    super.add(new Track(currentZone.clone(this.getNewId()), $parent), null);
    return true;
  }

  /** Move view backward */
  back() {
    let currentZone = this.getSelected(),
      nextPosX = this.posX - this.ruler.getRange().width / 2 - this.ruler.getRange().left,
      startPosX = currentZone.getStartPosX(),
      posX = nextPosX < startPosX ? startPosX : nextPosX;
    this.onMove.dispatch(posX);
    return true;
  }

  /** Move view forward */
  forward() {
    let currentZone = this.getSelected(),
      nextPosX = this.posX + this.ruler.getRange().width / 2 + this.ruler.getRange().left,
      startPosX = currentZone.getStartPosX(),
      endPosX = this.ruler.getMaxWidth() > startPosX + currentZone.getWidth() ? startPosX + currentZone.getWidth() : this.ruler.getMaxWidth(),
      posX = nextPosX > endPosX ? endPosX : nextPosX;
    this.onMove.dispatch(posX);
    return true;
  }

  /** Move to position */
  moveTo(posX) {
    return posX >= 0 && super.moveTo(posX);
  }

  /** Update during playback */
  updateFrame(posX) {
    return posX > 0 && super.updateFrame(posX);
  }

  /** Export tracks data */
  export() {
    let tracks = [];
    for (let i = 0; i < this.getNumChildren(); i++) {
      let child = this.getChildByIndex(i);
      tracks.push(child.export());
    }
    return tracks;
  }

  /** Render tracks DOM */
  render($parent) {
    let offsetLeft = $parent.offsetLeft + Config.getMargin(),
      activeEnvelopeZone = null,
      activeEnvelopeRect = null, // Cached rect to avoid reflow during drag
      $tooltip = null,
      tooltipTrack = null,
      lastDragTime = 0,
      lastTooltipTime = 0,
      DRAG_THROTTLE_MS = 16, // ~60fps
      TOOLTIP_THROTTLE_MS = 33, // ~30fps for tooltip
      createTooltip = () => {
        $tooltip = document.createElement('div');
        $tooltip.className = 'track-tooltip';
        $tooltip.innerHTML = `
          <div class="tooltip-title"></div>
          <div class="tooltip-row"><span>Start:</span><span class="tooltip-start"></span></div>
          <div class="tooltip-row"><span>End:</span><span class="tooltip-end"></span></div>
          <div class="tooltip-row"><span>Duration:</span><span class="tooltip-duration"></span></div>
        `;
        document.body.appendChild($tooltip);
      },
      updateTooltip = (track, e) => {
        if (!$tooltip) {
          createTooltip();
        }

        $tooltip.querySelector('.tooltip-title').textContent = track.label || 'Track';
        $tooltip.querySelector('.tooltip-start').textContent = Component.getTimeFormatted(track.getStart());
        $tooltip.querySelector('.tooltip-end').textContent = Component.getTimeFormatted(track.getEnd());
        $tooltip.querySelector('.tooltip-duration').textContent = Component.getTimeFormatted(track.getDuration());

        $tooltip.style.left = (e.clientX + 15) + 'px';
        $tooltip.style.top = (e.clientY + 15) + 'px';
        $tooltip.classList.add('visible');
        tooltipTrack = track;
      },
      hideTooltip = () => {
        if ($tooltip) {
          $tooltip.classList.remove('visible');
        }

        tooltipTrack = null;
      },
      drag = (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Throttle to ~60fps
        const now = performance.now();

        if (now - lastDragTime < DRAG_THROTTLE_MS) {
          return;
        }

        lastDragTime = now;

        let currentZone = this.getSelected(),
          posX = e.clientX - offsetLeft + this.posX,
          posY = 0;

        // Use cached rect instead of getBoundingClientRect() every frame
        if (activeEnvelopeZone && activeEnvelopeRect) {
          posY = e.clientY - activeEnvelopeRect.top;
        }

        currentZone.drag(posX, posY);

        if (currentZone.isMoving || currentZone.isTransforming) {
          updateTooltip(currentZone, e);
        }
      },
      removeDrag = e => {
        e.preventDefault();
        e.stopPropagation();
        let currentZone = this.getSelected();
        currentZone && currentZone.dragStop();
        activeEnvelopeZone = null;
        activeEnvelopeRect = null; // Clear cached rect
        document.removeEventListener('mousemove', drag, false);
        document.removeEventListener('mouseup', removeDrag, false);
      },
      dragStart = e => {
        e.preventDefault();
        e.stopPropagation();

        let $node = e.target,
          $zoneNode = $node.closest('[data-zone-id]'),
          id = $zoneNode ? $zoneNode.getAttribute('data-zone-id') : null,
          previousZone = this.getSelected();

        if (previousZone !== null && previousZone.getId() === id) { // zone is selected
          let currentZone = previousZone,
            posX = e.clientX - offsetLeft + this.posX,
            isEditingEnvelope = currentZone.$node.classList.contains('editing-envelope'),
            $panZone = $node.closest('.pan-zone'),
            $volumeZone = $node.closest('.volume-zone'),
            posY = 0;

          // Cache rect once at drag start to avoid reflow during drag
          if ($panZone) {
            activeEnvelopeRect = $panZone.getBoundingClientRect();
            posY = e.clientY - activeEnvelopeRect.top;
          } else if ($volumeZone) {
            activeEnvelopeRect = $volumeZone.getBoundingClientRect();
            posY = e.clientY - activeEnvelopeRect.top;
          }

          if ($node.classList.contains('hook-resize')) {
            currentZone.dragStart('resize');
          } else if ($panZone && isEditingEnvelope) {
            activeEnvelopeZone = $panZone;
            currentZone.setPanStart(posX, posY);
          } else if ($volumeZone && isEditingEnvelope) {
            activeEnvelopeZone = $volumeZone;
            currentZone.setVolumeStart(posX, posY);
          } else if (!isEditingEnvelope) {
            currentZone.dragStart('move', posX);
          }

          document.addEventListener('mousemove', drag, false);
          document.addEventListener('mouseup', removeDrag, false);
        }
        else { // zone is not selected => select (new zone [or container => id = null])
          this.select(id);
        }
      },
      // TRACKS CONTAINER
      props = [{class: 'tracks'}],
      listeners = {
        dragover: e => {
          e.preventDefault();
        },
        drop: e => {
          e.preventDefault();
          e.stopPropagation();
          let $node = e.target, // $parent = tracks row or tracks container
            data = JSON.parse(e.dataTransfer.getData('text')),
            time = Component.getTimeFromPosX(e.clientX - offsetLeft + this.posX),
            config = {
              id: this.getNewId(),
              idTrack: data.id,
              label: data.label,
              startTimeBuffer: 0, endTimeBuffer: data.duration,
              startTime: time, durationTime: data.duration
            };
          if ($node.classList.contains('zone-container') || $node.classList.contains('tracks')) {  // drop on tracks container and not over tracks row
            $node = this.addComposite();
          }
          else if (!$node.classList.contains('zones')) { // drop over an existing track => skip drop
            $node = null;
          }
          $node !== null && super.add(new Track(config, $node), null) && this.select(config.id);
        },
        mousedown: dragStart,
        mousemove: e => {
          // Throttle tooltip updates to ~30fps
          const now = performance.now();

          if (now - lastTooltipTime < TOOLTIP_THROTTLE_MS) {
            return;
          }

          lastTooltipTime = now;

          let $node = e.target,
            $zoneNode = $node.closest('[data-zone-id]'),
            id = $zoneNode ? $zoneNode.getAttribute('data-zone-id') : null,
            track = id ? this.getChild(id) : null;

          if (track && !activeEnvelopeZone) {
            updateTooltip(track, e);
          } else {
            hideTooltip();
          }
        },
        mouseleave: () => {
          hideTooltip();
        }
      };
    Component.render($parent, 'div', props, listeners);
  }
}
