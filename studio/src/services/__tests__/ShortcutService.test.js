import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as ShortcutService from '../ShortcutService';
import * as ToolMode from '../ToolMode';
import * as CutService from '../CutService';
import SnappingService from '../SnappingService';
import PlaybackCommands from '../playback/PlaybackCommands';
import { playbackStore } from '../../store';

vi.mock('../playback/PlaybackCommands', () => ({
  default: {
    play: vi.fn(),
    pause: vi.fn()
  }
}));

describe('ShortcutService', () => {
  beforeEach(() => {
    ShortcutService.destroy();
    ToolMode.deactivate();
    CutService.deactivate();
  });

  afterEach(() => {
    ShortcutService.destroy();
    ToolMode.deactivate();
    CutService.deactivate();
  });

  describe('init and destroy', () => {
    it('initializes service', () => {
      ShortcutService.init();
      expect(ShortcutService.has('Escape')).toBe(true);
    });

    it('only initializes once', () => {
      ShortcutService.init();
      ShortcutService.init();

      expect(ShortcutService.has('Escape')).toBe(true);
    });

    it('destroys service', () => {
      ShortcutService.init();
      ShortcutService.destroy();

      expect(ShortcutService.has('Escape')).toBe(false);
    });

    it('allows re-initialization after destroy', () => {
      ShortcutService.init();
      ShortcutService.destroy();
      ShortcutService.init();

      expect(ShortcutService.has('Escape')).toBe(true);
    });
  });

  describe('register and unregister', () => {
    beforeEach(() => {
      ShortcutService.init();
    });

    it('registers custom shortcut', () => {
      const handler = vi.fn(() => true);
      ShortcutService.register('a', handler);

      expect(ShortcutService.has('a')).toBe(true);
    });

    it('unregisters shortcut', () => {
      const handler = vi.fn(() => true);
      ShortcutService.register('a', handler);
      ShortcutService.unregister('a');

      expect(ShortcutService.has('a')).toBe(false);
    });

    it('normalizes modifier keys', () => {
      const handler = vi.fn(() => true);
      ShortcutService.register('ctrl+s', handler);

      expect(ShortcutService.has('Ctrl+s')).toBe(true);
    });

    it('handles multiple modifiers', () => {
      const handler = vi.fn(() => true);
      ShortcutService.register('Ctrl+Shift+A', handler);

      expect(ShortcutService.has('Ctrl+Shift+A')).toBe(true);
    });
  });

  describe('keyboard events', () => {
    beforeEach(() => {
      ShortcutService.init();
    });

    it('triggers handler on keydown', () => {
      const handler = vi.fn(() => true);
      ShortcutService.register('a', handler);

      const event = new KeyboardEvent('keydown', { key: 'a' });
      document.dispatchEvent(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('prevents default when handler returns true', () => {
      const handler = vi.fn(() => true);
      ShortcutService.register('a', handler);

      const event = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
      document.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });

    it('does not prevent default when handler returns false', () => {
      const handler = vi.fn(() => false);
      ShortcutService.register('a', handler);

      const event = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
      document.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
    });

    it('stops propagation when configured', () => {
      const handler = vi.fn(() => true);
      ShortcutService.register('a', handler, { stopPropagation: true });

      const event = new KeyboardEvent('keydown', { key: 'a', cancelable: true, bubbles: true });
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

      document.dispatchEvent(event);

      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it('handles modifier keys', () => {
      const handler = vi.fn(() => true);
      ShortcutService.register('Ctrl+s', handler);

      const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
      document.dispatchEvent(event);

      expect(handler).toHaveBeenCalled();
    });

    it('ignores shortcuts when input focused', () => {
      const handler = vi.fn(() => true);
      ShortcutService.register('a', handler);

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const event = new KeyboardEvent('keydown', { key: 'a' });
      document.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();

      input.remove();
    });

    it('allows Escape when input focused', () => {
      const handler = vi.fn(() => true);
      ShortcutService.register('Escape', handler);

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);

      expect(handler).toHaveBeenCalled();

      input.remove();
    });
  });

  describe('default shortcuts', () => {
    beforeEach(() => {
      ShortcutService.init();
    });

    describe('zoom', () => {
      const press = init => {
        const event = new KeyboardEvent('keydown', { cancelable: true, ...init });
        document.dispatchEvent(event);

        return event;
      };

      it.each([
        ['Ctrl and "+" (Italian, Spanish layouts)', { key: '+', ctrlKey: true }],
        ['Cmd and "+"', { key: '+', metaKey: true }],
        ['Ctrl, Shift and "+" (US layout)', { key: '+', ctrlKey: true, shiftKey: true }],
        ['Ctrl and "="', { key: '=', ctrlKey: true }]
      ])('zooms in with %s', (_label, init) => {
        const handler = vi.fn();
        ShortcutService.setActionHandler('zoomIn', handler);

        const event = press(init);

        expect(handler).toHaveBeenCalledTimes(1);
        // The browser's own page zoom must not run as well
        expect(event.defaultPrevented).toBe(true);
      });

      it('zooms out with Ctrl and "-"', () => {
        const handler = vi.fn();
        ShortcutService.setActionHandler('zoomOut', handler);

        press({ key: '-', ctrlKey: true });

        expect(handler).toHaveBeenCalledTimes(1);
      });

      it('fits the timeline with Ctrl and "0"', () => {
        const handler = vi.fn();
        ShortcutService.setActionHandler('zoomToFit', handler);

        press({ key: '0', ctrlKey: true });

        expect(handler).toHaveBeenCalledTimes(1);
      });

      it('leaves browser zoom alone when the timeline has no zoom handler', () => {
        const event = press({ key: '+', ctrlKey: true });

        expect(event.defaultPrevented).toBe(false);
      });
    });

    it('ESC deactivates tool mode', () => {
      ToolMode.activate('volume');

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);

      expect(ToolMode.isActive()).toBe(false);
    });

    it('c calls toggleCutMode handler', () => {
      const handler = vi.fn();
      ShortcutService.setActionHandler('toggleCutMode', handler);

      const event = new KeyboardEvent('keydown', { key: 'c' });
      document.dispatchEvent(event);

      expect(handler).toHaveBeenCalled();
      ShortcutService.clearActionHandler('toggleCutMode');
    });

    it('d calls duplicateSelectedTrack handler', () => {
      const handler = vi.fn();
      ShortcutService.setActionHandler('duplicateSelectedTrack', handler);

      const event = new KeyboardEvent('keydown', { key: 'd' });
      document.dispatchEvent(event);

      expect(handler).toHaveBeenCalled();
      ShortcutService.clearActionHandler('duplicateSelectedTrack');
    });

    it('v calls toggleVolumeSelectedTrack handler', () => {
      const handler = vi.fn();
      ShortcutService.setActionHandler('toggleVolumeSelectedTrack', handler);

      const event = new KeyboardEvent('keydown', { key: 'v' });
      document.dispatchEvent(event);

      expect(handler).toHaveBeenCalled();
      ShortcutService.clearActionHandler('toggleVolumeSelectedTrack');
    });

    it('p calls togglePanSelectedTrack handler', () => {
      const handler = vi.fn();
      ShortcutService.setActionHandler('togglePanSelectedTrack', handler);

      const event = new KeyboardEvent('keydown', { key: 'p' });
      document.dispatchEvent(event);

      expect(handler).toHaveBeenCalled();
      ShortcutService.clearActionHandler('togglePanSelectedTrack');
    });

    it('m calls addMarker action handler', () => {
      const handler = vi.fn();
      ShortcutService.setActionHandler('addMarker', handler);

      const event = new KeyboardEvent('keydown', { key: 'm' });
      document.dispatchEvent(event);

      expect(handler).toHaveBeenCalled();
    });

    it('Delete calls deleteSelectedMarker if handler returns true', () => {
      const handler = vi.fn(() => true);
      ShortcutService.setActionHandler('deleteSelectedMarker', handler);

      const event = new KeyboardEvent('keydown', { key: 'Delete' });
      document.dispatchEvent(event);

      expect(handler).toHaveBeenCalled();
      expect(ToolMode.getMode()).toBe(null);

      ShortcutService.clearActionHandler('deleteSelectedMarker');
    });

    it('Delete calls deleteSelectedTrack if no marker selected', () => {
      const markerHandler = vi.fn(() => false);
      const trackHandler = vi.fn();
      ShortcutService.setActionHandler('deleteSelectedMarker', markerHandler);
      ShortcutService.setActionHandler('deleteSelectedTrack', trackHandler);

      const event = new KeyboardEvent('keydown', { key: 'Delete' });
      document.dispatchEvent(event);

      expect(markerHandler).toHaveBeenCalled();
      expect(trackHandler).toHaveBeenCalled();

      ShortcutService.clearActionHandler('deleteSelectedMarker');
      ShortcutService.clearActionHandler('deleteSelectedTrack');
    });

    it('Backspace calls deleteSelectedMarker if handler returns true', () => {
      const handler = vi.fn(() => true);
      ShortcutService.setActionHandler('deleteSelectedMarker', handler);

      const event = new KeyboardEvent('keydown', { key: 'Backspace' });
      document.dispatchEvent(event);

      expect(handler).toHaveBeenCalled();
      expect(ToolMode.getMode()).toBe(null);

      ShortcutService.clearActionHandler('deleteSelectedMarker');
    });

    it('Backspace calls deleteSelectedTrack if no marker selected', () => {
      const markerHandler = vi.fn(() => false);
      const trackHandler = vi.fn();
      ShortcutService.setActionHandler('deleteSelectedMarker', markerHandler);
      ShortcutService.setActionHandler('deleteSelectedTrack', trackHandler);

      const event = new KeyboardEvent('keydown', { key: 'Backspace' });
      document.dispatchEvent(event);

      expect(markerHandler).toHaveBeenCalled();
      expect(trackHandler).toHaveBeenCalled();

      ShortcutService.clearActionHandler('deleteSelectedMarker');
      ShortcutService.clearActionHandler('deleteSelectedTrack');
    });

    it('Space calls play when not playing', () => {
      vi.spyOn(playbackStore, 'getState').mockReturnValue({ isPlaying: false });

      const event = new KeyboardEvent('keydown', { key: ' ' });
      document.dispatchEvent(event);

      expect(PlaybackCommands.play).toHaveBeenCalled();
      expect(PlaybackCommands.pause).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('Space calls pause when playing', () => {
      vi.spyOn(playbackStore, 'getState').mockReturnValue({ isPlaying: true });

      const event = new KeyboardEvent('keydown', { key: ' ' });
      document.dispatchEvent(event);

      expect(PlaybackCommands.pause).toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });

  describe('action handlers', () => {
    beforeEach(() => {
      ShortcutService.init();
    });

    it('sets action handler', () => {
      const handler = vi.fn();
      ShortcutService.setActionHandler('test', handler);

      expect(ShortcutService.has('i')).toBe(true);
    });

    it('i calls inspector toggle handler', () => {
      const handler = vi.fn();
      ShortcutService.setActionHandler('toggleInspector', handler);

      const event = new KeyboardEvent('keydown', { key: 'i' });
      document.dispatchEvent(event);

      expect(handler).toHaveBeenCalled();
    });

    it('clears action handler', () => {
      const handler = vi.fn();
      ShortcutService.setActionHandler('toggleInspector', handler);
      ShortcutService.clearActionHandler('toggleInspector');

      const event = new KeyboardEvent('keydown', { key: 'i' });
      document.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('key normalization', () => {
    beforeEach(() => {
      ShortcutService.init();
    });

    it('normalizes cmd to Ctrl', () => {
      const handler = vi.fn(() => true);
      ShortcutService.register('cmd+s', handler);

      expect(ShortcutService.has('Ctrl+s')).toBe(true);
    });

    it('normalizes meta to Ctrl', () => {
      const handler = vi.fn(() => true);
      ShortcutService.register('meta+s', handler);

      expect(ShortcutService.has('Ctrl+s')).toBe(true);
    });

    it('sorts modifiers consistently', () => {
      const handler = vi.fn(() => true);
      ShortcutService.register('shift+ctrl+a', handler);

      expect(ShortcutService.has('Ctrl+Shift+a')).toBe(true);
    });

    it('handles case-insensitive modifiers', () => {
      const handler = vi.fn(() => true);
      ShortcutService.register('CTRL+SHIFT+a', handler);

      expect(ShortcutService.has('Ctrl+Shift+a')).toBe(true);
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      ShortcutService.init();
    });

    it('handles unregistered keys gracefully', () => {
      const event = new KeyboardEvent('keydown', { key: 'z' });

      expect(() => document.dispatchEvent(event)).not.toThrow();
    });

    it('handles events without shortcuts', () => {
      const event = new KeyboardEvent('keydown', { key: 'F1' });

      expect(() => document.dispatchEvent(event)).not.toThrow();
    });

    it('allows multiple registrations for same key', () => {
      const handler1 = vi.fn(() => true);
      const handler2 = vi.fn(() => true);

      ShortcutService.register('a', handler1);
      ShortcutService.register('a', handler2);

      const event = new KeyboardEvent('keydown', { key: 'a' });
      document.dispatchEvent(event);

      expect(handler2).toHaveBeenCalled();
      expect(handler1).not.toHaveBeenCalled();
    });
  });
});
