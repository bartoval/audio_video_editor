import { describe, it, expect, beforeEach } from 'vitest';
import thumbnailMapper from '../ThumbnailMapper.js';

describe('ThumbnailMapper', () => {
  beforeEach(() => {
    thumbnailMapper.reset();
  });

  // ============================================================================
  // Scale Configuration
  // ============================================================================

  describe('setAvailableScales', () => {
    it('stores scales in sorted order', () => {
      thumbnailMapper.setAvailableScales([0.1, 0.01, 0.05, 0.02]);

      expect(thumbnailMapper.getAvailableScales()).toEqual([0.01, 0.02, 0.05, 0.1]);
    });

    it('returns a copy of scales (not original array)', () => {
      const original = [0.01, 0.05, 0.1];
      thumbnailMapper.setAvailableScales(original);

      const returned = thumbnailMapper.getAvailableScales();
      returned.push(0.2);

      expect(thumbnailMapper.getAvailableScales()).toEqual([0.01, 0.05, 0.1]);
    });

    it('does not mutate original array', () => {
      const original = [0.1, 0.01, 0.05];
      thumbnailMapper.setAvailableScales(original);

      expect(original).toEqual([0.1, 0.01, 0.05]);
    });
  });

  describe('getAvailableScales', () => {
    it('returns empty array when no scales set', () => {
      expect(thumbnailMapper.getAvailableScales()).toEqual([]);
    });

    it('returns sorted scales', () => {
      thumbnailMapper.setAvailableScales([0.05, 0.01]);

      expect(thumbnailMapper.getAvailableScales()).toEqual([0.01, 0.05]);
    });
  });

  describe('isScaleAvailable', () => {
    beforeEach(() => {
      thumbnailMapper.setAvailableScales([0.01, 0.02, 0.05, 0.1]);
    });

    it('returns true for available scale', () => {
      expect(thumbnailMapper.isScaleAvailable(0.05)).toBe(true);
    });

    it('returns false for unavailable scale', () => {
      expect(thumbnailMapper.isScaleAvailable(0.03)).toBe(false);
    });

    it('handles string input', () => {
      expect(thumbnailMapper.isScaleAvailable('0.05')).toBe(true);
    });

    it('returns false when no scales set', () => {
      thumbnailMapper.reset();

      expect(thumbnailMapper.isScaleAvailable(0.05)).toBe(false);
    });
  });

  // ============================================================================
  // Scale Mapping
  // ============================================================================

  describe('getThumbScaleForRenderScale', () => {
    beforeEach(() => {
      thumbnailMapper.setAvailableScales([0.01, 0.02, 0.05, 0.1]);
    });

    it('returns smallest scale >= renderScale', () => {
      expect(thumbnailMapper.getThumbScaleForRenderScale(0.015)).toBe('0.02');
    });

    it('returns exact match when available', () => {
      expect(thumbnailMapper.getThumbScaleForRenderScale(0.05)).toBe('0.05');
    });

    it('returns first scale for very small renderScale', () => {
      expect(thumbnailMapper.getThumbScaleForRenderScale(0.005)).toBe('0.01');
    });

    it('returns last scale when renderScale exceeds all', () => {
      expect(thumbnailMapper.getThumbScaleForRenderScale(0.5)).toBe('0.1');
    });

    it('returns renderScale as string when no scales available', () => {
      thumbnailMapper.reset();

      expect(thumbnailMapper.getThumbScaleForRenderScale(0.03)).toBe('0.03');
    });

    it('handles edge case at exact boundary', () => {
      expect(thumbnailMapper.getThumbScaleForRenderScale(0.02)).toBe('0.02');
    });

    it('maps scales correctly in sequence', () => {
      // < 0.01 -> 0.01
      expect(thumbnailMapper.getThumbScaleForRenderScale(0.005)).toBe('0.01');
      // 0.01 - 0.02 -> 0.02
      expect(thumbnailMapper.getThumbScaleForRenderScale(0.015)).toBe('0.02');
      // 0.02 - 0.05 -> 0.05
      expect(thumbnailMapper.getThumbScaleForRenderScale(0.03)).toBe('0.05');
      // 0.05 - 0.1 -> 0.1
      expect(thumbnailMapper.getThumbScaleForRenderScale(0.07)).toBe('0.1');
      // > 0.1 -> 0.1
      expect(thumbnailMapper.getThumbScaleForRenderScale(0.2)).toBe('0.1');
    });
  });

  // ============================================================================
  // Reset
  // ============================================================================

  describe('reset', () => {
    it('clears available scales', () => {
      thumbnailMapper.setAvailableScales([0.01, 0.05, 0.1]);
      thumbnailMapper.reset();

      expect(thumbnailMapper.getAvailableScales()).toEqual([]);
    });

    it('can be reconfigured after reset', () => {
      thumbnailMapper.setAvailableScales([0.01, 0.05]);
      thumbnailMapper.reset();
      thumbnailMapper.setAvailableScales([0.1, 0.2]);

      expect(thumbnailMapper.getAvailableScales()).toEqual([0.1, 0.2]);
    });
  });
});
