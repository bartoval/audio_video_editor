import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CUT_STATE, TRACK_ACTION } from '../../config/constants';

// Mock ToolMode with hoisted state
const { mockToolModeListeners, mockActiveMode } = vi.hoisted(() => ({
  mockToolModeListeners: new Set(),
  mockActiveMode: { current: null }
}));

vi.mock('../ToolMode', () => ({
  activate: vi.fn(mode => {
    if (mockActiveMode.current === mode) return;
    mockActiveMode.current = mode;
    mockToolModeListeners.forEach(cb => cb(mode));
  }),
  deactivate: vi.fn(() => {
    if (mockActiveMode.current === null) return;
    mockActiveMode.current = null;
    mockToolModeListeners.forEach(cb => cb(null));
  }),
  toggle: vi.fn(mode => {
    if (mockActiveMode.current === mode) {
      mockActiveMode.current = null;
      mockToolModeListeners.forEach(cb => cb(null));
    } else {
      mockActiveMode.current = mode;
      mockToolModeListeners.forEach(cb => cb(mode));
    }
  }),
  isMode: vi.fn(mode => mockActiveMode.current === mode),
  onModeChange: vi.fn(callback => {
    mockToolModeListeners.add(callback);

    return () => mockToolModeListeners.delete(callback);
  })
}));

// Mock scale utils
vi.mock('../../lib/utils/scale', () => ({
  getTimeFromPosX: vi.fn(posX => posX / 100)
}));

// Import after mocks - this triggers the onModeChange subscription
import * as CutService from '../CutService';
import * as ToolMode from '../ToolMode';

describe('CutService', () => {
  beforeEach(() => {
    // Reset mock state
    mockActiveMode.current = null;
    // Reset CutService internal state
    CutService.__resetForTesting();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Activation / Deactivation (via ToolMode)
  // ============================================================================

  describe('activation', () => {
    it('starts in INACTIVE state', () => {
      expect(CutService.getState()).toBe(CUT_STATE.INACTIVE);
      expect(CutService.isActive()).toBe(false);
    });

    it('activates via ToolMode', () => {
      CutService.activate();

      expect(ToolMode.activate).toHaveBeenCalledWith(TRACK_ACTION.CUT);
      expect(CutService.getState()).toBe(CUT_STATE.ACTIVE);
      expect(CutService.isActive()).toBe(true);
    });

    it('deactivates via ToolMode', () => {
      CutService.activate();
      CutService.deactivate();

      expect(ToolMode.deactivate).toHaveBeenCalled();
      expect(CutService.getState()).toBe(CUT_STATE.INACTIVE);
      expect(CutService.isActive()).toBe(false);
    });

    it('toggles via ToolMode', () => {
      CutService.toggle();
      expect(ToolMode.toggle).toHaveBeenCalledWith(TRACK_ACTION.CUT);
      expect(CutService.isActive()).toBe(true);

      CutService.toggle();
      expect(CutService.isActive()).toBe(false);
    });
  });

  // ============================================================================
  // setStart
  // ============================================================================

  describe('setStart', () => {
    it('returns false if not in ACTIVE state', () => {
      const zone = { id: 'zone-1' };
      const result = CutService.setStart(100, zone);

      expect(result).toBe(false);
    });

    it('transitions to PENDING state on first click', () => {
      CutService.activate();
      const zone = { id: 'zone-1' };

      const result = CutService.setStart(100, zone);

      expect(result).toBe(true);
      expect(CutService.getState()).toBe(CUT_STATE.PENDING);
      expect(CutService.isPending()).toBe(true);
    });

    it('stores start position and zone', () => {
      CutService.activate();
      const zone = { id: 'zone-1' };

      CutService.setStart(100, zone);

      const cutZone = CutService.getCutZone();
      expect(cutZone).not.toBeNull();
      expect(cutZone.startPosX).toBe(100);
      expect(cutZone.zone).toStrictEqual(zone);
    });
  });

  // ============================================================================
  // updateEnd
  // ============================================================================

  describe('updateEnd', () => {
    it('returns false if not in PENDING or DRAGGING state', () => {
      CutService.activate();
      const result = CutService.updateEnd(200);

      expect(result).toBe(false);
    });

    it('transitions from PENDING to DRAGGING on mouse move', () => {
      CutService.activate();
      CutService.setStart(100, { id: 'zone-1' });

      CutService.updateEnd(150);

      expect(CutService.getState()).toBe(CUT_STATE.DRAGGING);
    });

    it('updates end position', () => {
      CutService.activate();
      CutService.setStart(100, { id: 'zone-1' });
      CutService.updateEnd(200);

      const cutZone = CutService.getCutZone();
      expect(cutZone.endPosX).toBe(200);
    });
  });

  // ============================================================================
  // setEnd
  // ============================================================================

  describe('setEnd', () => {
    it('returns false if not in PENDING or DRAGGING state', () => {
      CutService.activate();
      const result = CutService.setEnd(200);

      expect(result).toBe(false);
    });

    it('transitions to READY state', () => {
      CutService.activate();
      CutService.setStart(100, { id: 'zone-1' });
      CutService.updateEnd(200);

      const result = CutService.setEnd(200);

      expect(result).toBe(true);
      expect(CutService.getState()).toBe(CUT_STATE.READY);
      expect(CutService.isReady()).toBe(true);
    });

    it('normalizes start/end so start < end', () => {
      CutService.activate();
      CutService.setStart(200, { id: 'zone-1' });
      CutService.updateEnd(100);
      CutService.setEnd(100);

      const cutZone = CutService.getCutZone();
      expect(cutZone.startPosX).toBe(100);
      expect(cutZone.endPosX).toBe(200);
    });

    it('cancels if cut zone is too small', () => {
      CutService.activate();
      CutService.setStart(100, { id: 'zone-1' });
      CutService.updateEnd(101);

      const result = CutService.setEnd(101);

      expect(result).toBe(false);
      expect(CutService.getState()).toBe(CUT_STATE.ACTIVE);
    });
  });

  // ============================================================================
  // confirm
  // ============================================================================

  describe('confirm', () => {
    it('returns null if not in READY state', () => {
      CutService.activate();
      const result = CutService.confirm();

      expect(result).toBeNull();
    });

    it('returns cut info when in READY state', () => {
      CutService.activate();
      const zone = { id: 'zone-1' };
      CutService.setStart(100, zone);
      CutService.updateEnd(300);
      CutService.setEnd(300);

      const cutInfo = CutService.confirm();

      expect(cutInfo).not.toBeNull();
      expect(cutInfo.zone).toBe(zone);
      expect(cutInfo.startPosX).toBe(100);
      expect(cutInfo.endPosX).toBe(300);
      expect(cutInfo.startTime).toBe(1); // 100 / 100
      expect(cutInfo.endTime).toBe(3); // 300 / 100
    });

    it('resets to ACTIVE state after confirm', () => {
      CutService.activate();
      CutService.setStart(100, { id: 'zone-1' });
      CutService.updateEnd(300);
      CutService.setEnd(300);
      CutService.confirm();

      expect(CutService.getState()).toBe(CUT_STATE.ACTIVE);
      expect(CutService.getCutZone()).toBeNull();
    });
  });

  // ============================================================================
  // cancel
  // ============================================================================

  describe('cancel', () => {
    it('does nothing if INACTIVE', () => {
      CutService.cancel();

      expect(CutService.getState()).toBe(CUT_STATE.INACTIVE);
    });

    it('deactivates completely if in ACTIVE state', () => {
      CutService.activate();
      CutService.cancel();

      expect(CutService.getState()).toBe(CUT_STATE.INACTIVE);
      expect(ToolMode.deactivate).toHaveBeenCalled();
    });

    it('goes back to ACTIVE from PENDING', () => {
      CutService.activate();
      CutService.setStart(100, { id: 'zone-1' });
      CutService.cancel();

      expect(CutService.getState()).toBe(CUT_STATE.ACTIVE);
      expect(CutService.getCutZone()).toBeNull();
    });

    it('goes back to ACTIVE from DRAGGING', () => {
      CutService.activate();
      CutService.setStart(100, { id: 'zone-1' });
      CutService.updateEnd(200);
      CutService.cancel();

      expect(CutService.getState()).toBe(CUT_STATE.ACTIVE);
    });

    it('goes back to ACTIVE from READY', () => {
      CutService.activate();
      CutService.setStart(100, { id: 'zone-1' });
      CutService.updateEnd(300);
      CutService.setEnd(300);
      CutService.cancel();

      expect(CutService.getState()).toBe(CUT_STATE.ACTIVE);
    });
  });

  // ============================================================================
  // getCutZone
  // ============================================================================

  describe('getCutZone', () => {
    it('returns null when INACTIVE', () => {
      expect(CutService.getCutZone()).toBeNull();
    });

    it('returns null when ACTIVE', () => {
      CutService.activate();

      expect(CutService.getCutZone()).toBeNull();
    });

    it('returns zone info when PENDING', () => {
      CutService.activate();
      CutService.setStart(100, { id: 'zone-1' });

      const cutZone = CutService.getCutZone();

      expect(cutZone).not.toBeNull();
      expect(cutZone.state).toBe(CUT_STATE.PENDING);
    });

    it('includes duration calculation', () => {
      CutService.activate();
      CutService.setStart(100, { id: 'zone-1' });
      CutService.updateEnd(300);

      const cutZone = CutService.getCutZone();

      expect(cutZone.duration).toBe(2); // (300 - 100) / 100
    });
  });

  // ============================================================================
  // onChange
  // ============================================================================

  describe('onChange', () => {
    it('notifies listeners on workflow state changes', () => {
      const listener = vi.fn();
      CutService.onChange(listener);

      CutService.activate();
      CutService.setStart(100, { id: 'zone-1' });

      // Should be called for PENDING state
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          state: CUT_STATE.PENDING
        })
      );
    });

    it('returns unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = CutService.onChange(listener);

      unsubscribe();
      CutService.activate();
      CutService.setStart(100, { id: 'zone-1' });

      // Should not be called after unsubscribe
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // validateCutRegion
  // ============================================================================

  describe('validateCutRegion', () => {
    const createMockZone = (start = 0, duration = 10) => ({
      getStart: () => start,
      getEnd: () => start + duration
    });

    it('returns invalid if no zone provided', () => {
      const result = CutService.validateCutRegion(null, 2, 5);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('No zone provided');
    });

    it('returns valid for a valid cut region', () => {
      const zone = createMockZone(0, 10);

      const result = CutService.validateCutRegion(zone, 2, 5);

      expect(result.valid).toBe(true);
      expect(result.beforeDuration).toBe(2);
      expect(result.afterDuration).toBe(5);
      expect(result.relativeStart).toBe(2);
      expect(result.relativeEnd).toBe(5);
    });

    it('returns valid when only before segment remains', () => {
      const zone = createMockZone(0, 10);

      const result = CutService.validateCutRegion(zone, 5, 10);

      expect(result.valid).toBe(true);
      expect(result.beforeDuration).toBe(5);
      expect(result.afterDuration).toBe(0);
    });

    it('returns valid when only after segment remains', () => {
      const zone = createMockZone(0, 10);

      const result = CutService.validateCutRegion(zone, 0, 5);

      expect(result.valid).toBe(true);
      expect(result.beforeDuration).toBe(0);
      expect(result.afterDuration).toBe(5);
    });

    it('returns invalid when cut would remove entire track', () => {
      const zone = createMockZone(0, 10);

      const result = CutService.validateCutRegion(zone, 0.05, 9.95);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Cut would remove entire track');
    });

    it('handles zones with non-zero start time', () => {
      const zone = createMockZone(5, 10);

      const result = CutService.validateCutRegion(zone, 8, 12);

      expect(result.valid).toBe(true);
      expect(result.beforeDuration).toBe(3);
      expect(result.afterDuration).toBe(3);
      expect(result.relativeStart).toBe(3);
      expect(result.relativeEnd).toBe(7);
    });
  });
});
