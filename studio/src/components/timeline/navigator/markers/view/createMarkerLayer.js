import { createElement, applyTransform3d, DragHandler } from '../../../../../lib';

/**
 * MarkerLayer view factory - renders marker pins on timeline
 */
export function createMarkerLayer($parent) {
  let handlers = {};

  const state = {
    markers: [],
    selectedId: null,
    translateX: 0
  };

  const $el = createElement('div', {
    className: 'markers',
    parent: $parent
  });

  const $container = createElement('div', {
    className: 'marker-container',
    parent: $el
  });

  const $ghost = createElement('div', {
    className: 'marker-ghost',
    parent: $container,
    html: '<i class="bi bi-flag-fill"></i>'
  });
  $ghost.style.display = 'none';

  const markerElements = new Map();
  const dragHandlers = new Map();

  let dragState = null;
  let clickTimeout = null;

  const timeToLabel = seconds => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const createDragHandler = ($pin, markerId) => {
    return new DragHandler(
      $pin,
      {
        onStart: () => {
          const pinLeft = parseFloat($pin.style.left) || 0;

          dragState = {
            markerId,
            $pin,
            startPosX: pinLeft,
            currentPosX: pinLeft
          };

          $pin.classList.add('marker-dragging');
        },

        onMove: event => {
          if (!dragState) {
            return;
          }

          const currentRect = $el.getBoundingClientRect();
          const posX = event.clientX - currentRect.left - state.translateX;

          dragState.currentPosX = Math.max(0, posX);
          dragState.$pin.style.left = `${dragState.currentPosX}px`;
        },

        onEnd: (_event, _deltaX, _deltaY, wasDragged) => {
          if (!dragState) {
            return;
          }

          const { markerId: id, $pin: pin, currentPosX } = dragState;

          pin.classList.remove('marker-dragging');

          if (wasDragged) {
            handlers.onMarkerDrag?.(id, currentPosX);
          } else {
            clickTimeout = setTimeout(() => {
              clickTimeout = null;
              handlers.onMarkerClick?.(id);
            }, 350);
          }

          dragState = null;
        }
      },
      { cursor: 'grabbing' }
    );
  };

  const createMarkerPin = marker => {
    const label = marker.label || timeToLabel(marker.time);
    const $pin = createElement('button', {
      className: 'marker-pin',
      attributes: {
        'data-marker-id': marker.id,
        title: label,
        'aria-label': label,
        tabindex: '0'
      },
      html: '<i class="bi bi-flag-fill"></i>'
    });

    $pin.style.left = `${marker.posX}px`;

    const dragHandler = createDragHandler($pin, marker.id);
    dragHandlers.set(marker.id, dragHandler);

    $pin.addEventListener('dblclick', event => {
      event.preventDefault();
      event.stopPropagation();

      if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
      }

      handlers.onMarkerRightClick?.(marker.id);
    });

    $pin.addEventListener('contextmenu', event => {
      event.preventDefault();
    });

    return $pin;
  };

  const render = () => {
    const currentIds = new Set(state.markers.map(marker => marker.id));

    for (const [id, $pin] of markerElements) {
      if (!currentIds.has(id)) {
        const handler = dragHandlers.get(id);

        if (handler) {
          handler.destroy();
          dragHandlers.delete(id);
        }

        $pin.remove();
        markerElements.delete(id);
      }
    }

    for (const marker of state.markers) {
      let $pin = markerElements.get(marker.id);

      if (!$pin) {
        $pin = createMarkerPin(marker);
        markerElements.set(marker.id, $pin);
        $container.appendChild($pin);
      } else {
        const label = marker.label || timeToLabel(marker.time);
        $pin.style.left = `${marker.posX}px`;
        $pin.title = label;
        $pin.setAttribute('aria-label', label);
      }

      $pin.classList.toggle('marker-active', marker.id === state.selectedId);
    }

    for (const marker of state.markers) {
      const $pin = markerElements.get(marker.id);
      if ($pin) {
        $container.appendChild($pin);
      }
    }
  };

  const updateTransform = () => {
    applyTransform3d($container, state.translateX, 0, 0);
  };

  const handleMouseMove = event => {
    const rect = $el.getBoundingClientRect();
    const posX = event.clientX - rect.left - state.translateX;

    $ghost.style.display = 'block';
    $ghost.style.left = `${posX}px`;
  };

  const handleMouseLeave = () => {
    $ghost.style.display = 'none';
  };

  $el.addEventListener('mousedown', event => {
    if (event.button === 2) {
      return;
    }

    const isOnPin = event.target.closest('.marker-pin');

    if (isOnPin) {
      return;
    }

    handlers.onLayerClick?.(event.clientX);
  });

  $el.addEventListener('contextmenu', event => {
    event.preventDefault();
  });

  $el.addEventListener('mousemove', handleMouseMove);
  $el.addEventListener('mouseleave', handleMouseLeave);

  return {
    el: $el,

    bind(newHandlers) {
      handlers = newHandlers;
    },

    setState(newState) {
      let needsRender = false;
      let needsTransform = false;

      if (newState.markers !== undefined) {
        state.markers = newState.markers;
        needsRender = true;
      }

      if (newState.selectedId !== undefined) {
        state.selectedId = newState.selectedId;
        needsRender = true;
      }

      if (newState.translateX !== undefined) {
        state.translateX = newState.translateX;
        needsTransform = true;
      }

      if (needsRender) {
        render();
      }

      if (needsTransform) {
        updateTransform();
      }
    },

    destroy() {
      if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
      }

      for (const handler of dragHandlers.values()) {
        handler.destroy();
      }

      dragHandlers.clear();

      for (const $pin of markerElements.values()) {
        $pin.remove();
      }

      markerElements.clear();
      $el.removeEventListener('mousemove', handleMouseMove);
      $el.removeEventListener('mouseleave', handleMouseLeave);
      $el.remove();
    }
  };
}
