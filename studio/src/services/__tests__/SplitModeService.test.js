import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TRACKS } from '../../config/constants';

// Mock scale utils
vi.mock('../../lib/utils/scale', () => ({
  getTimeFromPosX: vi.fn(posX => posX / 100)
}));

import * as SplitModeService from '../SplitModeService';

describe('SplitModeService', () => {
  const createMockZone = (start = 0, duration = 10) => ({
    getStart: () => start,
    getEnd: () => start + duration,
    getDuration: () => duration,
    getRoot: () => ({
      classList: {
        add: vi.fn(),
        remove: vi.fn()
      }
    })
  });

  beforeEach(() => {
    SplitModeService.__resetForTesting();
    vi.clearAllMocks();
  });

  describe('enter', () => {
    it('returns false if no zone provided', () => {
      expect(SplitModeService.enter(null)).toBe(false);
      expect(SplitModeService.isEnabled()).toBe(false);
    });

    it('activates split mode for a zone', () => {
      const zone = createMockZone();

      expect(SplitModeService.enter(zone)).toBe(true);
      expect(SplitModeService.isEnabled()).toBe(true);
      expect(SplitModeService.getZone()).toBe(zone);
    });

    it('adds split-mode class to zone root', () => {
      const classList = { add: vi.fn(), remove: vi.fn() };
      const zone = {
        ...createMockZone(),
        getRoot: () => ({ classList })
      };

      SplitModeService.enter(zone);

      expect(classList.add).toHaveBeenCalledWith('split-mode');
    });

    it('adds tool-split class to body', () => {
      const zone = createMockZone();

      SplitModeService.enter(zone);

      expect(document.body.classList.contains('tool-split')).toBe(true);
    });
  });

  describe('exit', () => {
    it('deactivates split mode', () => {
      const zone = createMockZone();
      SplitModeService.enter(zone);

      SplitModeService.exit();

      expect(SplitModeService.isEnabled()).toBe(false);
      expect(SplitModeService.getZone()).toBe(null);
    });

    it('removes split-mode class from zone root', () => {
      const classList = { add: vi.fn(), remove: vi.fn() };
      const zone = {
        ...createMockZone(),
        getRoot: () => ({ classList })
      };
      SplitModeService.enter(zone);

      SplitModeService.exit();

      expect(classList.remove).toHaveBeenCalledWith('split-mode');
    });

    it('removes tool-split class from body', () => {
      const zone = createMockZone();
      SplitModeService.enter(zone);

      SplitModeService.exit();

      expect(document.body.classList.contains('tool-split')).toBe(false);
    });

    it('handles exit when no zone is active', () => {
      expect(() => SplitModeService.exit()).not.toThrow();
    });
  });

  describe('getSplitInfo', () => {
    it('returns null if not active', () => {
      const zone = createMockZone();

      expect(SplitModeService.getSplitInfo(zone, 500)).toBe(null);
    });

    it('returns null if clicked zone does not match target zone', () => {
      const targetZone = createMockZone();
      const otherZone = createMockZone();
      SplitModeService.enter(targetZone);

      expect(SplitModeService.getSplitInfo(otherZone, 500)).toBe(null);
    });

    it('returns null if click is before track start', () => {
      const zone = createMockZone(5, 10); // starts at 5s
      SplitModeService.enter(zone);

      // posX 100 = 1s, track starts at 5s
      expect(SplitModeService.getSplitInfo(zone, 100)).toBe(null);
    });

    it('returns null if click is after track end', () => {
      const zone = createMockZone(0, 10); // ends at 10s
      SplitModeService.enter(zone);

      // posX 1500 = 15s, track ends at 10s
      expect(SplitModeService.getSplitInfo(zone, 1500)).toBe(null);
    });

    it('returns null if before segment is too short', () => {
      const zone = createMockZone(0, 10);
      SplitModeService.enter(zone);

      // Split at 0.05s (posX 5), MIN_CUT_DURATION is 0.1s
      expect(SplitModeService.getSplitInfo(zone, 5)).toBe(null);
    });

    it('returns null if after segment is too short', () => {
      const zone = createMockZone(0, 10);
      SplitModeService.enter(zone);

      // Split at 9.95s (posX 995), leaving only 0.05s after
      expect(SplitModeService.getSplitInfo(zone, 995)).toBe(null);
    });

    it('returns valid split info for valid click position', () => {
      const zone = createMockZone(0, 10);
      SplitModeService.enter(zone);

      // Click at posX 500 = 5s (middle of track)
      const result = SplitModeService.getSplitInfo(zone, 500);

      expect(result).not.toBe(null);
      expect(result.zone).toBe(zone);
      expect(result.splitTime).toBe(5); // 5s relative to track start
    });

    it('calculates correct split time relative to track start', () => {
      const zone = createMockZone(2, 10); // starts at 2s, ends at 12s
      SplitModeService.enter(zone);

      // Click at posX 700 = 7s absolute, 5s relative to track start
      const result = SplitModeService.getSplitInfo(zone, 700);

      expect(result.splitTime).toBe(5); // 7s - 2s = 5s
    });
  });

  describe('onChange', () => {
    it('notifies listeners on enter', () => {
      const listener = vi.fn();
      SplitModeService.onChange(listener);

      const zone = createMockZone();
      SplitModeService.enter(zone);

      expect(listener).toHaveBeenCalledWith({ active: true, zone });
    });

    it('notifies listeners on exit', () => {
      const listener = vi.fn();
      const zone = createMockZone();
      SplitModeService.enter(zone);

      SplitModeService.onChange(listener);
      SplitModeService.exit();

      expect(listener).toHaveBeenCalledWith({ active: false, zone: null });
    });

    it('returns unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = SplitModeService.onChange(listener);

      unsubscribe();

      const zone = createMockZone();
      SplitModeService.enter(zone);

      expect(listener).not.toHaveBeenCalled();
    });

    it('handles listener errors gracefully', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = vi.fn();

      SplitModeService.onChange(errorListener);
      SplitModeService.onChange(normalListener);

      const zone = createMockZone();
      expect(() => SplitModeService.enter(zone)).not.toThrow();
      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe('isEnabled', () => {
    it('returns false by default', () => {
      expect(SplitModeService.isEnabled()).toBe(false);
    });

    it('returns true after enter', () => {
      SplitModeService.enter(createMockZone());

      expect(SplitModeService.isEnabled()).toBe(true);
    });

    it('returns false after exit', () => {
      SplitModeService.enter(createMockZone());
      SplitModeService.exit();

      expect(SplitModeService.isEnabled()).toBe(false);
    });
  });

  describe('getZone', () => {
    it('returns null by default', () => {
      expect(SplitModeService.getZone()).toBe(null);
    });

    it('returns target zone after enter', () => {
      const zone = createMockZone();
      SplitModeService.enter(zone);

      expect(SplitModeService.getZone()).toBe(zone);
    });

    it('returns null after exit', () => {
      SplitModeService.enter(createMockZone());
      SplitModeService.exit();

      expect(SplitModeService.getZone()).toBe(null);
    });
  });
});
