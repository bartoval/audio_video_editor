import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import * as ToolMode from '../ToolMode';
import { initStoreConnectors, destroyStoreConnectors } from '../../store/storeConnectors';

vi.mock('../EventService', () => ({
  on: vi.fn(() => vi.fn())
}));

describe('ToolMode', () => {
  beforeAll(() => {
    initStoreConnectors();
  });

  afterAll(() => {
    destroyStoreConnectors();
  });

  beforeEach(() => {
    ToolMode.deactivate();
    document.body.className = '';
  });

  afterEach(() => {
    ToolMode.deactivate();
    document.body.className = '';
  });

  describe('activate', () => {
    it('activates a tool mode', () => {
      ToolMode.activate('volume');

      expect(ToolMode.getMode()).toBe('volume');
      expect(ToolMode.isActive()).toBe(true);
    });

    it('does nothing if already active', () => {
      const listener = vi.fn();
      ToolMode.onModeChange(listener);

      ToolMode.activate('volume');
      listener.mockClear();

      ToolMode.activate('volume');

      expect(listener).not.toHaveBeenCalled();
    });

    it('changes mode if different', () => {
      ToolMode.activate('volume');
      ToolMode.activate('pan');

      expect(ToolMode.getMode()).toBe('pan');
    });

    it('updates body class', () => {
      ToolMode.activate('volume');

      expect(document.body.classList.contains('tool-volume')).toBe(true);
    });

    it('replaces previous body class', () => {
      ToolMode.activate('volume');
      ToolMode.activate('pan');

      expect(document.body.classList.contains('tool-volume')).toBe(false);
      expect(document.body.classList.contains('tool-pan')).toBe(true);
    });
  });

  describe('deactivate', () => {
    it('deactivates current mode', () => {
      ToolMode.activate('volume');
      ToolMode.deactivate();

      expect(ToolMode.getMode()).toBe(null);
      expect(ToolMode.isActive()).toBe(false);
    });

    it('does nothing if already inactive', () => {
      const listener = vi.fn();
      ToolMode.onModeChange(listener);

      ToolMode.deactivate();

      expect(listener).not.toHaveBeenCalled();
    });

    it('removes body class', () => {
      ToolMode.activate('volume');
      ToolMode.deactivate();

      expect(document.body.classList.contains('tool-volume')).toBe(false);
    });
  });

  describe('toggle', () => {
    it('activates if inactive', () => {
      ToolMode.toggle('volume');

      expect(ToolMode.getMode()).toBe('volume');
      expect(ToolMode.isActive()).toBe(true);
    });

    it('deactivates if same mode active', () => {
      ToolMode.activate('volume');
      ToolMode.toggle('volume');

      expect(ToolMode.getMode()).toBe(null);
      expect(ToolMode.isActive()).toBe(false);
    });

    it('switches to different mode', () => {
      ToolMode.activate('volume');
      ToolMode.toggle('pan');

      expect(ToolMode.getMode()).toBe('pan');
    });
  });

  describe('getMode', () => {
    it('returns null when inactive', () => {
      expect(ToolMode.getMode()).toBe(null);
    });

    it('returns current mode', () => {
      ToolMode.activate('volume');
      expect(ToolMode.getMode()).toBe('volume');
    });
  });

  describe('isMode', () => {
    it('returns false when inactive', () => {
      expect(ToolMode.isMode('volume')).toBe(false);
    });

    it('returns true for current mode', () => {
      ToolMode.activate('volume');
      expect(ToolMode.isMode('volume')).toBe(true);
    });

    it('returns false for different mode', () => {
      ToolMode.activate('volume');
      expect(ToolMode.isMode('pan')).toBe(false);
    });
  });

  describe('isActive', () => {
    it('returns false when no mode active', () => {
      expect(ToolMode.isActive()).toBe(false);
    });

    it('returns true when mode active', () => {
      ToolMode.activate('volume');
      expect(ToolMode.isActive()).toBe(true);
    });
  });

  describe('onModeChange', () => {
    it('notifies listener on activation', () => {
      const listener = vi.fn();
      ToolMode.onModeChange(listener);

      ToolMode.activate('volume');

      expect(listener).toHaveBeenCalledWith('volume');
    });

    it('notifies listener on deactivation', () => {
      ToolMode.activate('volume');

      const listener = vi.fn();
      ToolMode.onModeChange(listener);

      ToolMode.deactivate();

      expect(listener).toHaveBeenCalledWith(null);
    });

    it('notifies listener on toggle', () => {
      const listener = vi.fn();
      ToolMode.onModeChange(listener);

      ToolMode.toggle('volume');
      expect(listener).toHaveBeenCalledWith('volume');

      ToolMode.toggle('volume');
      expect(listener).toHaveBeenCalledWith(null);
    });

    it('returns unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = ToolMode.onModeChange(listener);

      ToolMode.activate('volume');
      unsubscribe();
      listener.mockClear();

      ToolMode.activate('pan');

      expect(listener).not.toHaveBeenCalled();
    });

    it('supports multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      ToolMode.onModeChange(listener1);
      ToolMode.onModeChange(listener2);

      ToolMode.activate('volume');

      expect(listener1).toHaveBeenCalledWith('volume');
      expect(listener2).toHaveBeenCalledWith('volume');
    });

    it('handles listener errors gracefully', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const workingListener = vi.fn();

      ToolMode.onModeChange(errorListener);
      ToolMode.onModeChange(workingListener);

      expect(() => ToolMode.activate('volume')).not.toThrow();
      expect(workingListener).toHaveBeenCalled();
    });
  });

  describe('body class management', () => {
    it('adds correct class for each tool', () => {
      const tools = ['volume', 'pan'];

      tools.forEach(tool => {
        ToolMode.activate(tool);
        expect(document.body.classList.contains(`tool-${tool}`)).toBe(true);
        ToolMode.deactivate();
      });
    });

    it('removes all tool classes on deactivate', () => {
      ToolMode.activate('volume');
      ToolMode.activate('pan');
      ToolMode.deactivate();

      expect(document.body.className).toBe('');
    });
  });
});
