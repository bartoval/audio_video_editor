import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/utils/scale.js', () => ({
  setScale: vi.fn(),
  setScaleFactor: vi.fn()
}));

import scaleManager from '../ScaleManager.js';
import { setScale, setScaleFactor } from '../../lib/utils/scale.js';

describe('ScaleManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scaleManager.reset();
  });

  // ============================================================================
  // Initialization
  // ============================================================================

  describe('init', () => {
    it('initializes with valid duration', () => {
      scaleManager.init({
        duration: 60,
        availableScales: [0.01, 0.02, 0.05, 0.1],
        viewportWidth: 1000
      });

      expect(scaleManager.isInitialized()).toBe(true);
    });

    it('throws error for missing duration', () => {
      expect(() => scaleManager.init({ duration: 0 })).toThrow('Invalid duration');
    });

    it('throws error for negative duration', () => {
      expect(() => scaleManager.init({ duration: -10 })).toThrow('Invalid duration');
    });

    it('throws error when no valid scales available', () => {
      expect(() =>
        scaleManager.init({
          duration: 60,
          availableScales: [0.0001],
          viewportWidth: 1000
        })
      ).toThrow('No valid scales available');
    });

    it('filters scales based on SVG max width', () => {
      scaleManager.init({
        duration: 60,
        availableScales: [0.0001, 0.001, 0.01, 0.1],
        maxWidth: 10000,
        viewportWidth: 1000
      });

      const scales = scaleManager.getScaleList();

      expect(scales).not.toContain(0.0001);
    });

    it('filters scales based on viewport width', () => {
      scaleManager.init({
        duration: 60,
        availableScales: [0.01, 0.1, 1, 10],
        viewportWidth: 100
      });

      const scales = scaleManager.getScaleList();

      expect(scales).not.toContain(10);
    });

    it('returns this for chaining', () => {
      const result = scaleManager.init({
        duration: 60,
        availableScales: [0.01, 0.1],
        viewportWidth: 1000
      });

      expect(result).toBe(scaleManager);
    });
  });

  // ============================================================================
  // Scale Operations
  // ============================================================================

  describe('setScale', () => {
    beforeEach(() => {
      scaleManager.init({
        duration: 100,
        availableScales: [0.01, 0.1, 1],
        viewportWidth: 1000
      });
    });

    it('sets scale and calls lib functions', () => {
      scaleManager.setScale(0.1);

      expect(setScale).toHaveBeenCalledWith(0.1);
      expect(setScaleFactor).toHaveBeenCalled();
    });

    it('clamps scale to min', () => {
      const limits = scaleManager.getLimits();
      scaleManager.setScale(0.0001);

      expect(scaleManager.getScale()).toBe(limits.min);
    });

    it('clamps scale to max', () => {
      const limits = scaleManager.getLimits();
      scaleManager.setScale(1000);

      expect(scaleManager.getScale()).toBe(limits.max);
    });

    it('returns current scale when unchanged', () => {
      scaleManager.setScale(0.1);
      vi.clearAllMocks();

      const result = scaleManager.setScale(0.1);

      expect(result).toBe(0.1);
      expect(setScale).not.toHaveBeenCalled();
    });

    it('notifies listeners on change', () => {
      const listener = vi.fn();
      scaleManager.onChange(listener);

      scaleManager.setScale(0.1);

      expect(listener).toHaveBeenCalledWith({
        scale: 0.1,
        width: expect.any(Number),
        duration: expect.any(Number)
      });
    });
  });

  describe('setInitialScale', () => {
    beforeEach(() => {
      scaleManager.init({
        duration: 100,
        availableScales: [0.01, 0.1, 1],
        viewportWidth: 1000
      });
    });

    it('sets initial scale using setScale', () => {
      scaleManager.setInitialScale(0.1);

      expect(scaleManager.getScale()).toBe(0.1);
    });
  });

  describe('getScale', () => {
    it('returns -1 before initialization', () => {
      expect(scaleManager.getScale()).toBe(-1);
    });

    it('returns current scale after set', () => {
      scaleManager.init({
        duration: 100,
        availableScales: [0.01, 0.1],
        viewportWidth: 1000
      });
      scaleManager.setScale(0.1);

      expect(scaleManager.getScale()).toBe(0.1);
    });
  });

  describe('getWidth', () => {
    beforeEach(() => {
      scaleManager.init({
        duration: 100,
        availableScales: [0.01, 0.1],
        viewportWidth: 1000
      });
    });

    it('calculates width from duration and scale', () => {
      scaleManager.setScale(0.1);

      expect(scaleManager.getWidth()).toBe(1000);
    });

    it('returns larger width for smaller scale', () => {
      scaleManager.setScale(0.01);

      expect(scaleManager.getWidth()).toBe(10000);
    });
  });

  describe('getScaleList', () => {
    it('returns copy of filtered scales', () => {
      scaleManager.init({
        duration: 100,
        availableScales: [0.01, 0.1],
        viewportWidth: 1000
      });

      const list = scaleManager.getScaleList();
      list.push(0.5);

      expect(scaleManager.getScaleList()).not.toContain(0.5);
    });
  });

  describe('getLimits', () => {
    it('returns min and max scale limits', () => {
      scaleManager.init({
        duration: 100,
        availableScales: [0.01, 0.1],
        viewportWidth: 1000
      });

      const limits = scaleManager.getLimits();

      expect(limits).toHaveProperty('min');
      expect(limits).toHaveProperty('max');
      expect(limits.min).toBeLessThan(limits.max);
    });
  });

  // ============================================================================
  // Zoom Operations
  // ============================================================================

  describe('zoomIn', () => {
    beforeEach(() => {
      scaleManager.init({
        duration: 1000,
        availableScales: [0.01, 0.1, 1],
        viewportWidth: 500
      });
      scaleManager.setScale(0.5);
    });

    it('reduces scale by default factor', () => {
      scaleManager.zoomIn();

      expect(scaleManager.getScale()).toBeCloseTo(0.45, 5);
    });

    it('uses custom factor', () => {
      scaleManager.zoomIn(0.5);

      expect(scaleManager.getScale()).toBe(0.25);
    });
  });

  describe('zoomOut', () => {
    beforeEach(() => {
      scaleManager.init({
        duration: 1000,
        availableScales: [0.01, 0.1, 1],
        viewportWidth: 500
      });
      scaleManager.setScale(0.5);
    });

    it('increases scale by default factor', () => {
      scaleManager.zoomOut();

      expect(scaleManager.getScale()).toBeCloseTo(0.55, 5);
    });

    it('uses custom factor', () => {
      scaleManager.zoomOut(2);

      expect(scaleManager.getScale()).toBe(1);
    });
  });

  describe('zoomByDelta', () => {
    beforeEach(() => {
      scaleManager.init({
        duration: 1000,
        availableScales: [0.01, 0.1, 1],
        viewportWidth: 500
      });
      scaleManager.setScale(0.5);
    });

    it('zooms by delta with default sensitivity', () => {
      scaleManager.zoomByDelta(100);

      expect(scaleManager.getScale()).toBeCloseTo(0.55, 5);
    });

    it('zooms out with negative delta', () => {
      scaleManager.zoomByDelta(-100);

      expect(scaleManager.getScale()).toBeCloseTo(0.45, 5);
    });

    it('uses custom sensitivity', () => {
      scaleManager.zoomByDelta(100, 0.01);

      expect(scaleManager.getScale()).toBe(1);
    });
  });

  describe('setDuration', () => {
    beforeEach(() => {
      scaleManager.init({
        duration: 100,
        availableScales: [0.01, 0.1, 1],
        viewportWidth: 1000
      });
      scaleManager.setScale(0.1);
    });

    it('updates duration and recalculates limits', () => {
      scaleManager.setDuration(200);

      expect(scaleManager.getWidth()).toBe(2000);
    });

    it('clamps scale if now below min', () => {
      scaleManager.setScale(0.01);
      scaleManager.setDuration(10000);

      const limits = scaleManager.getLimits();

      expect(scaleManager.getScale()).toBeGreaterThanOrEqual(limits.min);
    });

    it('clamps scale if now above max', () => {
      scaleManager.setScale(0.5);
      scaleManager.setDuration(50);

      const limits = scaleManager.getLimits();

      expect(scaleManager.getScale()).toBeLessThanOrEqual(limits.max);
    });
  });

  // ============================================================================
  // Event Listeners
  // ============================================================================

  describe('onChange', () => {
    beforeEach(() => {
      scaleManager.init({
        duration: 100,
        availableScales: [0.01, 0.1],
        viewportWidth: 1000
      });
    });

    it('adds listener and calls on scale change', () => {
      const listener = vi.fn();
      scaleManager.onChange(listener);

      scaleManager.setScale(0.1);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('returns unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = scaleManager.onChange(listener);

      unsubscribe();
      scaleManager.setScale(0.1);

      expect(listener).not.toHaveBeenCalled();
    });

    it('handles listener errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorListener = vi.fn(() => {
        throw new Error('Test error');
      });
      const normalListener = vi.fn();

      scaleManager.onChange(errorListener);
      scaleManager.onChange(normalListener);

      scaleManager.setScale(0.1);

      expect(consoleSpy).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('supports multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      scaleManager.onChange(listener1);
      scaleManager.onChange(listener2);

      scaleManager.setScale(0.1);

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Reset
  // ============================================================================

  describe('reset', () => {
    it('resets all state', () => {
      scaleManager.init({
        duration: 100,
        availableScales: [0.01, 0.1],
        viewportWidth: 1000
      });
      scaleManager.setScale(0.1);

      scaleManager.reset();

      expect(scaleManager.isInitialized()).toBe(false);
      expect(scaleManager.getScale()).toBe(-1);
      expect(scaleManager.getScaleList()).toEqual([]);
    });

    it('clears listeners', () => {
      scaleManager.init({
        duration: 100,
        availableScales: [0.01, 0.1],
        viewportWidth: 1000
      });

      const listener = vi.fn();
      scaleManager.onChange(listener);

      scaleManager.reset();

      scaleManager.init({
        duration: 100,
        availableScales: [0.01, 0.1],
        viewportWidth: 1000
      });
      scaleManager.setScale(0.1);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('handles initialization without viewportWidth', () => {
      scaleManager.init({
        duration: 100,
        availableScales: [0.01, 0.1, 1]
      });

      expect(scaleManager.isInitialized()).toBe(true);
    });

    it('handles initialization without availableScales', () => {
      expect(() =>
        scaleManager.init({
          duration: 100,
          viewportWidth: 1000
        })
      ).toThrow('No valid scales available');
    });

    it('calculates max scale from duration when no viewport', () => {
      scaleManager.init({
        duration: 100,
        availableScales: [0.01, 0.1, 1]
      });

      const limits = scaleManager.getLimits();

      expect(limits.max).toBeGreaterThan(0);
    });
  });
});
