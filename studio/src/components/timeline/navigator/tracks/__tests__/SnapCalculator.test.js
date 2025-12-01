import { describe, it, expect } from 'vitest';
import { findTrackEdgeSnap, buildTrackEdges } from '../SnapCalculator';

describe('findTrackEdgeSnap', () => {
  const TOLERANCE = 15;

  it('returns null when no tracks', () => {
    const result = findTrackEdgeSnap([], 100, 50, TOLERANCE, null);

    expect(result).toBeNull();
  });

  it('snaps end-to-start when dragged end is within tolerance of other start', () => {
    const edges = [{ startPx: 200, endPx: 300 }];
    const result = findTrackEdgeSnap(edges, 140, 50, TOLERANCE, null);

    expect(result).toEqual({
      newStartPx: 150,
      type: 'end-to-start'
    });
  });

  it('snaps start-to-end when dragged start is within tolerance of other end', () => {
    const edges = [{ startPx: 100, endPx: 200 }];
    const result = findTrackEdgeSnap(edges, 210, 50, TOLERANCE, null);

    expect(result).toEqual({
      newStartPx: 200,
      type: 'start-to-end'
    });
  });

  it('returns null when outside tolerance', () => {
    const edges = [{ startPx: 200, endPx: 300 }];
    const result = findTrackEdgeSnap(edges, 100, 50, TOLERANCE, null);

    expect(result).toBeNull();
  });

  it('picks closest snap when multiple candidates exist', () => {
    const edges = [
      { startPx: 200, endPx: 250 },
      { startPx: 195, endPx: 250 }
    ];
    const result = findTrackEdgeSnap(edges, 140, 50, TOLERANCE, null);

    expect(result).toEqual({
      newStartPx: 145,
      type: 'end-to-start'
    });
  });

  it('detects crossing end-to-start even when outside tolerance', () => {
    const edges = [{ startPx: 200, endPx: 300 }];
    const prevStartPx = 120;
    const result = findTrackEdgeSnap(edges, 180, 50, TOLERANCE, prevStartPx);

    expect(result).toEqual({
      newStartPx: 150,
      type: 'end-to-start'
    });
  });

  it('detects crossing start-to-end even when outside tolerance', () => {
    const edges = [{ startPx: 100, endPx: 200 }];
    const prevStartPx = 230;
    const result = findTrackEdgeSnap(edges, 170, 50, TOLERANCE, prevStartPx);

    expect(result).toEqual({
      newStartPx: 200,
      type: 'start-to-end'
    });
  });

  it('prefers crossing snap over distance-based snap', () => {
    const edges = [
      { startPx: 200, endPx: 250 },
      { startPx: 300, endPx: 350 }
    ];
    const prevStartPx = 260;
    const result = findTrackEdgeSnap(edges, 240, 50, TOLERANCE, prevStartPx);

    expect(result).toEqual({
      newStartPx: 250,
      type: 'start-to-end'
    });
  });

  it('handles exact edge alignment', () => {
    const edges = [{ startPx: 200, endPx: 300 }];
    const result = findTrackEdgeSnap(edges, 150, 50, TOLERANCE, null);

    expect(result).toEqual({
      newStartPx: 150,
      type: 'end-to-start'
    });
  });

  it('handles zero duration track', () => {
    const edges = [{ startPx: 200, endPx: 200 }];
    const result = findTrackEdgeSnap(edges, 195, 50, TOLERANCE, null);

    expect(result).not.toBeNull();
  });
});

describe('buildTrackEdges', () => {
  const timeToPx = time => time * 10;

  it('builds edges from controller', () => {
    const controller = {
      getChildByIndex: index => {
        const tracks = [
          { getId: () => 'a', getStart: () => 0, getDuration: () => 5 },
          { getId: () => 'b', getStart: () => 10, getDuration: () => 3 }
        ];

        return tracks[index];
      }
    };

    const edges = buildTrackEdges(controller, 2, undefined, timeToPx);

    expect(edges).toEqual([
      { startPx: 0, endPx: 50 },
      { startPx: 100, endPx: 130 }
    ]);
  });

  it('excludes the dragged track by id', () => {
    const controller = {
      getChildByIndex: index => {
        const tracks = [
          { getId: () => 'a', getStart: () => 0, getDuration: () => 5 },
          { getId: () => 'b', getStart: () => 10, getDuration: () => 3 }
        ];

        return tracks[index];
      }
    };

    const edges = buildTrackEdges(controller, 2, 'a', timeToPx);

    expect(edges).toEqual([{ startPx: 100, endPx: 130 }]);
  });

  it('skips tracks with invalid time values', () => {
    const controller = {
      getChildByIndex: index => {
        const tracks = [
          { getId: () => 'a', getStart: () => NaN, getDuration: () => 5 },
          { getId: () => 'b', getStart: () => 10, getDuration: () => 3 }
        ];

        return tracks[index];
      }
    };

    const edges = buildTrackEdges(controller, 2, undefined, timeToPx);

    expect(edges).toEqual([{ startPx: 100, endPx: 130 }]);
  });

  it('skips null tracks', () => {
    const controller = {
      getChildByIndex: index =>
        index === 0 ? null : { getId: () => 'b', getStart: () => 5, getDuration: () => 2 }
    };

    const edges = buildTrackEdges(controller, 2, undefined, timeToPx);

    expect(edges).toEqual([{ startPx: 50, endPx: 70 }]);
  });

  it('returns empty array when no tracks', () => {
    const controller = { getChildByIndex: () => null };
    const edges = buildTrackEdges(controller, 0, undefined, timeToPx);

    expect(edges).toEqual([]);
  });
});
