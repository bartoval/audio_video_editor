import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock dependencies before import
const { mockScaleListeners } = vi.hoisted(() => ({
  mockScaleListeners: new Set()
}));

vi.mock('../ScaleManager.js', () => ({
  default: {
    getScale: vi.fn(() => 0.1),
    onChange: vi.fn(callback => {
      mockScaleListeners.add(callback);

      return () => mockScaleListeners.delete(callback);
    })
  }
}));

vi.mock('../../store/playbackStore.js', () => ({
  default: {
    getState: vi.fn(() => ({ time: 5.0 }))
  }
}));

vi.mock('../../store/workspaceStore.js', () => ({
  default: {
    getState: vi.fn(() => ({ config: { bpm: 120 } }))
  }
}));

vi.mock('../../lib/utils/scale.js', () => ({
  getPosXFromTime: vi.fn(time => time * 100) // 100px per second
}));

// Import after mocks
import snappingService from '../SnappingService.js';
import scaleManager from '../ScaleManager.js';
import playbackStore from '../../store/playbackStore.js';
import workspaceStore from '../../store/workspaceStore.js';
import { getPosXFromTime } from '../../lib/utils/scale.js';

describe('SnappingService', () => {
  beforeEach(() => {
    // Reset service state
    snappingService.endDrag();
    snappingService.clearSnapPoints('tracks');
    snappingService.clearSnapPoints('markers');

    // Reset mocks
    vi.clearAllMocks();
    getPosXFromTime.mockImplementation(time => time * 100);
    scaleManager.getScale.mockReturnValue(0.1);
    playbackStore.getState.mockReturnValue({ time: 5.0 });
    workspaceStore.getState.mockReturnValue({ config: { bpm: 120 } });

    // Reset config to defaults
    snappingService.setMode('grid', true);
    snappingService.setMode('tracks', true);
    snappingService.setMode('playhead', true);
    snappingService.setMode('markers', true);
    snappingService.setGridInterval(1.0);
    snappingService.setTolerance(14);
    snappingService.setBeatSnap(false);
  });

  afterEach(() => {
    snappingService.endDrag();
  });

  // ============================================================================
  // Basic Snap
  // ============================================================================

  describe('snap', () => {
    it('returns original position when no snap target is close', () => {
      const result = snappingService.snap(155, { visibleRange: { start: 0, end: 10 } });

      // 155 is not close to any grid point (0, 100, 200, ...)
      expect(result).toBe(155);
    });

    it('snaps to grid when close to grid point', () => {
      // Grid at 100px intervals (1s * 100px/s)
      const result = snappingService.snap(102, { visibleRange: { start: 0, end: 10 } });

      // Should snap to 100 (1 second mark)
      expect(result).toBe(100);
    });

    it('snaps to playhead when close', () => {
      playbackStore.getState.mockReturnValue({ time: 3.0 });

      // Playhead at 300px (3s * 100px/s)
      const result = snappingService.snap(305, { visibleRange: { start: 0, end: 10 } });

      expect(result).toBe(300);
    });

    it('snaps to track boundaries when registered', () => {
      snappingService.registerSnapPoints('tracks', [
        { posX: 250, time: 2.5, type: 'track-start', trackId: 'track1' }
      ]);

      const result = snappingService.snap(255, { visibleRange: { start: 0, end: 10 } });

      expect(result).toBe(250);
    });

    it('excludes specified track from snap', () => {
      snappingService.registerSnapPoints('tracks', [
        { posX: 250, time: 2.5, type: 'track-start', trackId: 'track1' }
      ]);

      const result = snappingService.snap(255, {
        visibleRange: { start: 0, end: 10 },
        excludeTrackId: 'track1'
      });

      // Should not snap to excluded track, but might snap to grid at 300
      expect(result).not.toBe(250);
    });

    it('snaps to markers when registered', () => {
      snappingService.registerSnapPoints('markers', [
        { posX: 450, time: 4.5, type: 'marker', label: 'Test Marker' }
      ]);

      const result = snappingService.snap(455, { visibleRange: { start: 0, end: 10 } });

      expect(result).toBe(450);
    });
  });

  // ============================================================================
  // Hysteresis
  // ============================================================================

  describe('hysteresis', () => {
    it('maintains snap when moving slightly away within exit tolerance', () => {
      // First snap to grid point
      snappingService.beginDrag({ visibleRange: { start: 0, end: 10 } });
      const firstSnap = snappingService.snap(102, { visibleRange: { start: 0, end: 10 } });

      expect(firstSnap).toBe(100);

      // Move slightly away - hysteresis uses exitTolerance = tolerance * 1.2
      // Base tolerance ~14px, so exit tolerance ~17px
      // 105 is 5px away from 100, should maintain snap
      const secondSnap = snappingService.snap(105, { visibleRange: { start: 0, end: 10 } });

      expect(secondSnap).toBe(100); // Should maintain snap
    });

    it('releases snap when moving beyond exit tolerance', () => {
      snappingService.beginDrag({ visibleRange: { start: 0, end: 10 } });
      snappingService.snap(102, { visibleRange: { start: 0, end: 10 } });

      // Move far away from snap point (beyond hysteresis range)
      const result = snappingService.snap(160, { visibleRange: { start: 0, end: 10 } });

      // Should release snap and not be at 100 anymore
      expect(result).not.toBe(100);
    });
  });

  // ============================================================================
  // Drag Operations
  // ============================================================================

  describe('drag operations', () => {
    it('beginDrag caches snap points', () => {
      snappingService.beginDrag({ visibleRange: { start: 0, end: 10 } });

      // Should use cached points during drag
      const result = snappingService.snap(102, { visibleRange: { start: 0, end: 10 } });

      expect(result).toBe(100);
    });

    it('endDrag clears cache and hysteresis state', () => {
      snappingService.beginDrag({ visibleRange: { start: 0, end: 10 } });
      snappingService.snap(102, { visibleRange: { start: 0, end: 10 } });

      // After endDrag, hysteresis is cleared - next snap won't maintain previous target
      snappingService.endDrag();

      // Start a new drag - should behave fresh without hysteresis from previous drag
      snappingService.beginDrag({ visibleRange: { start: 0, end: 10 } });

      // Position far from any snap point - should not snap
      const result = snappingService.snap(155, { visibleRange: { start: 0, end: 10 } });

      expect(result).toBe(155);
    });
  });

  // ============================================================================
  // Configuration API
  // ============================================================================

  describe('configuration', () => {
    describe('modes', () => {
      it('disables grid snap when mode is off', () => {
        snappingService.setMode('grid', false);

        expect(snappingService.isModeEnabled('grid')).toBe(false);

        // Without grid, should only snap to playhead at 500px (5s)
        playbackStore.getState.mockReturnValue({ time: 10.0 }); // Far from test pos
        snappingService.setMode('playhead', false);

        const result = snappingService.snap(102, { visibleRange: { start: 0, end: 10 } });

        // No snap targets available
        expect(result).toBe(102);
      });

      it('disables playhead snap when mode is off', () => {
        snappingService.setMode('playhead', false);

        expect(snappingService.isModeEnabled('playhead')).toBe(false);
      });

      it('ignores invalid mode names', () => {
        snappingService.setMode('invalid', true);

        expect(snappingService.isModeEnabled('invalid')).toBe(false);
      });
    });

    describe('gridInterval', () => {
      it('sets grid interval within bounds', () => {
        snappingService.setGridInterval(2.0);

        expect(snappingService.getGridInterval()).toBe(2.0);
      });

      it('clamps grid interval to minimum 0.1', () => {
        snappingService.setGridInterval(0.01);

        expect(snappingService.getGridInterval()).toBe(0.1);
      });

      it('clamps grid interval to maximum 10', () => {
        snappingService.setGridInterval(20);

        expect(snappingService.getGridInterval()).toBe(10);
      });
    });

    describe('tolerance', () => {
      it('sets tolerance within bounds', () => {
        snappingService.setTolerance(20);

        expect(snappingService.getTolerance()).toBe(20);
      });

      it('clamps tolerance to minimum 5', () => {
        snappingService.setTolerance(2);

        expect(snappingService.getTolerance()).toBe(5);
      });

      it('clamps tolerance to maximum 50', () => {
        snappingService.setTolerance(100);

        expect(snappingService.getTolerance()).toBe(50);
      });
    });

    describe('beatSnap', () => {
      it('enables beat snap', () => {
        snappingService.setBeatSnap(true);

        expect(snappingService.isBeatSnapEnabled()).toBe(true);
      });

      it('disables beat snap', () => {
        snappingService.setBeatSnap(false);

        expect(snappingService.isBeatSnapEnabled()).toBe(false);
      });

      it('uses BPM from workspace when beat snap enabled', () => {
        snappingService.setBeatSnap(true);
        snappingService.setBeatsPerBar(4);

        // With 120 BPM, beat interval = 60/120 = 0.5s per beat
        // 4 beats per bar = 2s interval
        snappingService.beginDrag({ visibleRange: { start: 0, end: 10 } });

        // Verify workspaceStore was called
        expect(workspaceStore.getState).toHaveBeenCalled();
      });
    });

    describe('beatsPerBar', () => {
      it('sets beats per bar within bounds', () => {
        snappingService.setBeatsPerBar(8);

        const config = snappingService.getConfig();

        expect(config.beatsPerBar).toBe(8);
      });

      it('clamps to minimum 1', () => {
        snappingService.setBeatsPerBar(0);

        const config = snappingService.getConfig();

        expect(config.beatsPerBar).toBe(1);
      });

      it('clamps to maximum 16', () => {
        snappingService.setBeatsPerBar(32);

        const config = snappingService.getConfig();

        expect(config.beatsPerBar).toBe(16);
      });
    });

    describe('getConfig', () => {
      it('returns copy of current config', () => {
        const config = snappingService.getConfig();

        expect(config).toHaveProperty('modes');
        expect(config).toHaveProperty('gridInterval');
        expect(config).toHaveProperty('baseTolerance');
        expect(config).toHaveProperty('beatSnap');
        expect(config).toHaveProperty('beatsPerBar');
      });
    });
  });

  // ============================================================================
  // Snap Points Registration
  // ============================================================================

  describe('snap points registration', () => {
    it('registers track snap points', () => {
      const tracks = [
        { posX: 100, time: 1, type: 'track-start', trackId: 't1' },
        { posX: 500, time: 5, type: 'track-end', trackId: 't1' }
      ];

      snappingService.registerSnapPoints('tracks', tracks);

      const result = snappingService.snap(105, { visibleRange: { start: 0, end: 10 } });

      expect(result).toBe(100);
    });

    it('clears snap points for category', () => {
      snappingService.registerSnapPoints('tracks', [
        { posX: 250, time: 2.5, type: 'track-start', trackId: 't1' }
      ]);

      snappingService.clearSnapPoints('tracks');

      // Should not snap to cleared points
      snappingService.setMode('grid', false);
      snappingService.setMode('playhead', false);

      const result = snappingService.snap(255, { visibleRange: { start: 0, end: 10 } });

      expect(result).toBe(255);
    });
  });

  // ============================================================================
  // Last Snap Info
  // ============================================================================

  describe('getLastSnapInfo', () => {
    it('returns null when no snap occurred', () => {
      snappingService.endDrag();

      expect(snappingService.getLastSnapInfo()).toBe(null);
    });

    it('returns snap info after snap', () => {
      snappingService.snap(102, { visibleRange: { start: 0, end: 10 } });

      const info = snappingService.getLastSnapInfo();

      expect(info).not.toBe(null);
      expect(info).toHaveProperty('posX');
      expect(info).toHaveProperty('type');
    });
  });

  // ============================================================================
  // Dynamic Tolerance
  // ============================================================================

  describe('dynamic tolerance', () => {
    it('uses base tolerance when scale is 0 or negative', () => {
      scaleManager.getScale.mockReturnValue(0);

      // Should still work with base tolerance
      const result = snappingService.snap(102, { visibleRange: { start: 0, end: 10 } });

      expect(result).toBe(100);
    });

    it('calculates tolerance based on scale', () => {
      // Tolerance is calculated dynamically based on scale using logarithmic formula
      // tolerance = baseTolerance * (0.5 + log10(scale + 1) * 0.5)
      // At scale 0.1: log10(1.1) ≈ 0.041, so tolerance ≈ 14 * (0.5 + 0.02) ≈ 7.3px
      scaleManager.getScale.mockReturnValue(0.1);
      snappingService.beginDrag({ visibleRange: { start: 0, end: 10 } });

      // At scale 0.1, tolerance is reduced - need to be closer to snap
      const result = snappingService.snap(105, { visibleRange: { start: 0, end: 10 } });

      expect(result).toBe(100);
    });
  });

  // ============================================================================
  // Event Listeners
  // ============================================================================

  describe('onChange', () => {
    it('adds listener and returns cleanup function', () => {
      const listener = vi.fn();

      const cleanup = snappingService.onChange(listener);

      expect(typeof cleanup).toBe('function');

      // Trigger config change
      snappingService.setGridInterval(2.0);

      expect(listener).toHaveBeenCalled();
    });

    it('removes listener on cleanup', () => {
      const listener = vi.fn();
      const cleanup = snappingService.onChange(listener);

      cleanup();

      // Change config - listener should not be called
      listener.mockClear();
      snappingService.setGridInterval(3.0);

      expect(listener).not.toHaveBeenCalled();
    });

    it('receives config in callback', () => {
      const listener = vi.fn();

      const cleanup = snappingService.onChange(listener);
      snappingService.setTolerance(25);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          baseTolerance: 25
        })
      );
      cleanup();
    });

    it('handles listener errors gracefully', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Test error');
      });
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const unsubscribe = snappingService.onChange(errorListener);

      expect(() => {
        snappingService.setGridInterval(2.0);
      }).not.toThrow();

      expect(consoleError).toHaveBeenCalled();

      unsubscribe();
      consoleError.mockRestore();
    });
  });

  // ============================================================================
  // Grid Label Formatting
  // ============================================================================

  describe('grid label formatting', () => {
    it('formats time correctly in snap info', () => {
      snappingService.snap(102, { visibleRange: { start: 0, end: 10 } });

      const info = snappingService.getLastSnapInfo();

      expect(info.label).toBe('00:01');
    });
  });

  // ============================================================================
  // Scale Change Handling
  // ============================================================================

  describe('scale change handling', () => {
    it('invalidates cache when scale changes during drag', () => {
      snappingService.registerSnapPoints('tracks', [
        { time: 5.0, type: 'track-start', trackId: 'track-1' }
      ]);

      snappingService.beginDrag({ visibleRange: { start: 0, end: 20 } });
      snappingService.snap(495, { visibleRange: { start: 0, end: 20 } });

      mockScaleListeners.forEach(cb => cb({ scale: 0.05 }));

      getPosXFromTime.mockReturnValue(250);
      const result = snappingService.snap(245, { visibleRange: { start: 0, end: 20 } });

      expect(result).toBe(250);
      snappingService.endDrag();
    });

    it('does not invalidate cache when not dragging', () => {
      snappingService.registerSnapPoints('tracks', [
        { time: 5.0, type: 'track-start', trackId: 'track-1' }
      ]);

      mockScaleListeners.forEach(cb => cb({ scale: 0.05 }));

      const result = snappingService.snap(505, { visibleRange: { start: 0, end: 20 } });

      expect(result).toBe(500);
    });

    it('calculates posX at snap time using current scale', () => {
      snappingService.registerSnapPoints('tracks', [
        { time: 3.0, type: 'track-start', trackId: 'track-1' }
      ]);

      getPosXFromTime.mockReturnValue(300);
      const result = snappingService.snap(305, { visibleRange: { start: 0, end: 20 } });

      expect(result).toBe(300);
      expect(getPosXFromTime).toHaveBeenCalledWith(3.0);
    });
  });
});
