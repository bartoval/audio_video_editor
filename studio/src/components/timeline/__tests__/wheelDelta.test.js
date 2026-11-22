import { describe, it, expect, vi } from 'vitest';

vi.mock('../Mediator', () => ({ default: {} }));

import { wheelDeltaInPixels } from '../Navigator';

const wheel = (deltaY, deltaMode) => new WheelEvent('wheel', { deltaY, deltaMode });

describe('wheelDeltaInPixels', () => {
  it('keeps pixel deltas (Chrome, Safari, trackpads) as they are', () => {
    expect(wheelDeltaInPixels(wheel(-100, WheelEvent.DOM_DELTA_PIXEL))).toBe(-100);
  });

  it('converts line deltas (Firefox mouse wheel) to pixels', () => {
    // One Firefox notch is 3 lines: it must zoom about like a Chrome notch (100px), not like 3px
    expect(wheelDeltaInPixels(wheel(-3, WheelEvent.DOM_DELTA_LINE))).toBe(-99);
  });

  it('converts page deltas to pixels', () => {
    expect(wheelDeltaInPixels(wheel(1, WheelEvent.DOM_DELTA_PAGE))).toBe(800);
  });
});
