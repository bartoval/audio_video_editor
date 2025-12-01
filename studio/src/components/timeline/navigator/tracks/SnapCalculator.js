// @ts-check

/**
 * @typedef {{ startPx: number, endPx: number }} TrackEdge
 * @typedef {{ newStartPx: number, type: 'end-to-start' | 'start-to-end' }} SnapResult
 */

/**
 * Find the closest track edge to snap to during drag.
 * Pure function — no DOM or service dependencies.
 *
 * @param {TrackEdge[]} trackEdges - Edges of all tracks except the dragged one
 * @param {number} draggedStartPx - Current start position of dragged track
 * @param {number} draggedDurationPx - Width of dragged track in pixels
 * @param {number} tolerancePx - Snap tolerance in pixels
 * @param {number|null} prevStartPx - Previous frame start position (for crossing detection)
 * @returns {SnapResult | null}
 */
export function findTrackEdgeSnap(
  trackEdges,
  draggedStartPx,
  draggedDurationPx,
  tolerancePx,
  prevStartPx
) {
  const draggedEndPx = draggedStartPx + draggedDurationPx;
  const prevEndPx = prevStartPx !== null ? prevStartPx + draggedDurationPx : null;

  let bestSnap = null;
  let minDistance = Infinity;

  for (const { startPx: otherStartPx, endPx: otherEndPx } of trackEdges) {
    const distEndToStart = Math.abs(draggedEndPx - otherStartPx);
    const crossedEndToStart =
      prevEndPx !== null &&
      ((prevEndPx < otherStartPx && draggedEndPx >= otherStartPx) ||
        (prevEndPx > otherStartPx && draggedEndPx <= otherStartPx));

    if (distEndToStart <= tolerancePx || crossedEndToStart) {
      const snapDistance = crossedEndToStart ? 0 : distEndToStart;

      if (snapDistance < minDistance) {
        minDistance = snapDistance;
        bestSnap = {
          newStartPx: otherStartPx - draggedDurationPx,
          type: 'end-to-start'
        };
      }
    }

    const distStartToEnd = Math.abs(draggedStartPx - otherEndPx);
    const crossedStartToEnd =
      prevStartPx !== null &&
      ((prevStartPx > otherEndPx && draggedStartPx <= otherEndPx) ||
        (prevStartPx < otherEndPx && draggedStartPx >= otherEndPx));

    if (distStartToEnd <= tolerancePx || crossedStartToEnd) {
      const snapDistance = crossedStartToEnd ? 0 : distStartToEnd;

      if (snapDistance < minDistance) {
        minDistance = snapDistance;
        bestSnap = {
          newStartPx: otherEndPx,
          type: 'start-to-end'
        };
      }
    }
  }

  return bestSnap;
}

/**
 * Build track edges array from a controller, excluding the active drag zone.
 *
 * @param {{ getChildByIndex: (i: number) => any, getNumTracks?: () => number }} controller
 * @param {number} trackCount
 * @param {string|undefined} excludeId - ID of the zone being dragged
 * @param {(time: number) => number} timeToPx - Conversion function
 * @returns {TrackEdge[]}
 */
export function buildTrackEdges(controller, trackCount, excludeId, timeToPx) {
  const edges = [];

  for (let i = 0; i < trackCount; i++) {
    const track = controller.getChildByIndex(i);
    const trackId = track?.getId?.();

    if (!track || trackId === excludeId) {
      continue;
    }

    const startTime = track.getStart?.();
    const duration = track.getDuration?.();

    if (!Number.isFinite(startTime) || !Number.isFinite(duration)) {
      continue;
    }

    edges.push({
      startPx: timeToPx(startTime),
      endPx: timeToPx(startTime + duration)
    });
  }

  return edges;
}
