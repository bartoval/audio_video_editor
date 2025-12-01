import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DragHandler from '../DragHandler';

describe('DragHandler', () => {
  let element;
  let callbacks;
  let handler;

  beforeEach(() => {
    element = document.createElement('div');
    document.body.appendChild(element);

    callbacks = {
      onStart: vi.fn(),
      onMove: vi.fn(),
      onEnd: vi.fn()
    };
  });

  afterEach(() => {
    handler?.destroy();
    element?.remove();
  });

  // ============================================================================
  // Constructor
  // ============================================================================

  describe('constructor', () => {
    it('attaches mousedown listener to element', () => {
      const addEventSpy = vi.spyOn(element, 'addEventListener');

      handler = new DragHandler(element, callbacks);

      expect(addEventSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
    });

    it('accepts optional options', () => {
      handler = new DragHandler(element, callbacks, {
        threshold: 10,
        cursor: 'move',
        usePointerCapture: true
      });

      expect(handler).toBeDefined();
    });
  });

  // ============================================================================
  // Drag Lifecycle
  // ============================================================================

  describe('drag lifecycle', () => {
    beforeEach(() => {
      handler = new DragHandler(element, callbacks);
    });

    it('starts drag on mousedown with left button', () => {
      const event = new MouseEvent('mousedown', {
        button: 0,
        clientX: 100,
        clientY: 50
      });

      element.dispatchEvent(event);

      expect(callbacks.onStart).toHaveBeenCalledWith(event, 100, 50);
      expect(handler.isDragging()).toBe(true);
    });

    it('ignores mousedown with non-left button', () => {
      const event = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 50
      });

      element.dispatchEvent(event);

      expect(callbacks.onStart).not.toHaveBeenCalled();
      expect(handler.isDragging()).toBe(false);
    });

    it('calls onMove during drag', () => {
      element.dispatchEvent(
        new MouseEvent('mousedown', {
          button: 0,
          clientX: 100,
          clientY: 50
        })
      );

      const moveEvent = new MouseEvent('mousemove', {
        clientX: 120,
        clientY: 60
      });
      document.dispatchEvent(moveEvent);

      expect(callbacks.onMove).toHaveBeenCalledWith(moveEvent, 20, 10, 100, 50);
    });

    it('calls onEnd on mouseup', () => {
      element.dispatchEvent(
        new MouseEvent('mousedown', {
          button: 0,
          clientX: 100,
          clientY: 50
        })
      );

      // Move past threshold
      document.dispatchEvent(
        new MouseEvent('mousemove', {
          clientX: 120,
          clientY: 50
        })
      );

      const upEvent = new MouseEvent('mouseup', {
        clientX: 120,
        clientY: 50
      });
      document.dispatchEvent(upEvent);

      expect(callbacks.onEnd).toHaveBeenCalledWith(upEvent, 20, 0, true);
      expect(handler.isDragging()).toBe(false);
    });

    it('sets wasDragged=false when not moved past threshold', () => {
      element.dispatchEvent(
        new MouseEvent('mousedown', {
          button: 0,
          clientX: 100,
          clientY: 50
        })
      );

      // Move less than threshold (default 3)
      document.dispatchEvent(
        new MouseEvent('mousemove', {
          clientX: 101,
          clientY: 50
        })
      );

      const upEvent = new MouseEvent('mouseup', {
        clientX: 101,
        clientY: 50
      });
      document.dispatchEvent(upEvent);

      expect(callbacks.onEnd).toHaveBeenCalledWith(upEvent, 1, 0, false);
    });
  });

  // ============================================================================
  // Threshold
  // ============================================================================

  describe('threshold', () => {
    it('uses default threshold of 3', () => {
      handler = new DragHandler(element, callbacks);

      element.dispatchEvent(
        new MouseEvent('mousedown', {
          button: 0,
          clientX: 100,
          clientY: 50
        })
      );

      // Move exactly 3 pixels - should not trigger hasMoved
      document.dispatchEvent(
        new MouseEvent('mousemove', {
          clientX: 103,
          clientY: 50
        })
      );

      expect(handler.hasMoved()).toBe(false);

      // Move 4 pixels - should trigger hasMoved
      document.dispatchEvent(
        new MouseEvent('mousemove', {
          clientX: 104,
          clientY: 50
        })
      );

      expect(handler.hasMoved()).toBe(true);
    });

    it('respects custom threshold', () => {
      handler = new DragHandler(element, callbacks, { threshold: 10 });

      element.dispatchEvent(
        new MouseEvent('mousedown', {
          button: 0,
          clientX: 100,
          clientY: 50
        })
      );

      document.dispatchEvent(
        new MouseEvent('mousemove', {
          clientX: 108,
          clientY: 50
        })
      );

      expect(handler.hasMoved()).toBe(false);

      document.dispatchEvent(
        new MouseEvent('mousemove', {
          clientX: 115,
          clientY: 50
        })
      );

      expect(handler.hasMoved()).toBe(true);
    });
  });

  // ============================================================================
  // Cursor
  // ============================================================================

  describe('cursor', () => {
    it('sets cursor during drag when specified', () => {
      handler = new DragHandler(element, callbacks, { cursor: 'grabbing' });

      element.dispatchEvent(
        new MouseEvent('mousedown', {
          button: 0,
          clientX: 100,
          clientY: 50
        })
      );

      expect(document.body.style.cursor).toBe('grabbing');
    });

    it('resets cursor on drag end', () => {
      handler = new DragHandler(element, callbacks, { cursor: 'grabbing' });

      element.dispatchEvent(
        new MouseEvent('mousedown', {
          button: 0,
          clientX: 100,
          clientY: 50
        })
      );

      document.dispatchEvent(
        new MouseEvent('mouseup', {
          clientX: 100,
          clientY: 50
        })
      );

      expect(document.body.style.cursor).toBe('');
    });

    it('sets userSelect to none during drag', () => {
      handler = new DragHandler(element, callbacks);

      element.dispatchEvent(
        new MouseEvent('mousedown', {
          button: 0,
          clientX: 100,
          clientY: 50
        })
      );

      expect(document.body.style.userSelect).toBe('none');
    });
  });

  // ============================================================================
  // Window Blur
  // ============================================================================

  describe('window blur', () => {
    it('ends drag on window blur', () => {
      handler = new DragHandler(element, callbacks);

      element.dispatchEvent(
        new MouseEvent('mousedown', {
          button: 0,
          clientX: 100,
          clientY: 50
        })
      );

      window.dispatchEvent(new Event('blur'));

      expect(callbacks.onEnd).toHaveBeenCalled();
      expect(handler.isDragging()).toBe(false);
    });

    it('calls onEnd with synthetic event on blur', () => {
      handler = new DragHandler(element, callbacks);

      element.dispatchEvent(
        new MouseEvent('mousedown', {
          button: 0,
          clientX: 100,
          clientY: 50
        })
      );

      // Move past threshold
      document.dispatchEvent(
        new MouseEvent('mousemove', {
          clientX: 120,
          clientY: 50
        })
      );

      window.dispatchEvent(new Event('blur'));

      // On blur, deltaX/Y are 0 (reset to start position)
      expect(callbacks.onEnd).toHaveBeenCalledWith(expect.any(MouseEvent), 0, 0, true);
    });
  });

  // ============================================================================
  // Public Methods
  // ============================================================================

  describe('public methods', () => {
    beforeEach(() => {
      handler = new DragHandler(element, callbacks);
    });

    it('isDragging returns current drag state', () => {
      expect(handler.isDragging()).toBe(false);

      element.dispatchEvent(
        new MouseEvent('mousedown', {
          button: 0,
          clientX: 100,
          clientY: 50
        })
      );

      expect(handler.isDragging()).toBe(true);

      document.dispatchEvent(
        new MouseEvent('mouseup', {
          clientX: 100,
          clientY: 50
        })
      );

      expect(handler.isDragging()).toBe(false);
    });

    it('hasMoved returns movement state', () => {
      expect(handler.hasMoved()).toBe(false);

      element.dispatchEvent(
        new MouseEvent('mousedown', {
          button: 0,
          clientX: 100,
          clientY: 50
        })
      );

      expect(handler.hasMoved()).toBe(false);

      document.dispatchEvent(
        new MouseEvent('mousemove', {
          clientX: 120,
          clientY: 50
        })
      );

      expect(handler.hasMoved()).toBe(true);
    });

    it('stopDrag stops active drag', () => {
      element.dispatchEvent(
        new MouseEvent('mousedown', {
          button: 0,
          clientX: 100,
          clientY: 50
        })
      );

      expect(handler.isDragging()).toBe(true);

      handler.stopDrag();

      expect(handler.isDragging()).toBe(false);
    });

    it('stopDrag does nothing when not dragging', () => {
      expect(handler.isDragging()).toBe(false);
      handler.stopDrag();
      expect(handler.isDragging()).toBe(false);
    });

    it('setCallbacks updates callbacks', () => {
      const newOnMove = vi.fn();

      handler.setCallbacks({ onMove: newOnMove });

      element.dispatchEvent(
        new MouseEvent('mousedown', {
          button: 0,
          clientX: 100,
          clientY: 50
        })
      );

      document.dispatchEvent(
        new MouseEvent('mousemove', {
          clientX: 120,
          clientY: 50
        })
      );

      expect(newOnMove).toHaveBeenCalled();
    });

    it('startDrag can be called externally', () => {
      const event = new MouseEvent('mousedown', {
        button: 0,
        clientX: 100,
        clientY: 50
      });

      handler.startDrag(event);

      expect(callbacks.onStart).toHaveBeenCalled();
      expect(handler.isDragging()).toBe(true);
    });
  });

  // ============================================================================
  // Destroy
  // ============================================================================

  describe('destroy', () => {
    it('removes mousedown listener from element', () => {
      handler = new DragHandler(element, callbacks);
      const removeEventSpy = vi.spyOn(element, 'removeEventListener');

      handler.destroy();

      expect(removeEventSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
    });

    it('cleans up document listeners if dragging', () => {
      handler = new DragHandler(element, callbacks);

      element.dispatchEvent(
        new MouseEvent('mousedown', {
          button: 0,
          clientX: 100,
          clientY: 50
        })
      );

      const removeDocSpy = vi.spyOn(document, 'removeEventListener');
      const removeWinSpy = vi.spyOn(window, 'removeEventListener');

      handler.destroy();

      expect(removeDocSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(removeDocSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(removeWinSpy).toHaveBeenCalledWith('blur', expect.any(Function));
    });

    it('can be called multiple times safely', () => {
      handler = new DragHandler(element, callbacks);

      expect(() => {
        handler.destroy();
        handler.destroy();
      }).not.toThrow();
    });

    it('resets body styles on destroy during drag', () => {
      handler = new DragHandler(element, callbacks, { cursor: 'grabbing' });

      element.dispatchEvent(
        new MouseEvent('mousedown', {
          button: 0,
          clientX: 100,
          clientY: 50
        })
      );

      expect(document.body.style.cursor).toBe('grabbing');

      handler.destroy();

      expect(document.body.style.cursor).toBe('');
      expect(document.body.style.userSelect).toBe('');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('handles missing callbacks gracefully', () => {
      handler = new DragHandler(element, {});

      expect(() => {
        element.dispatchEvent(
          new MouseEvent('mousedown', {
            button: 0,
            clientX: 100,
            clientY: 50
          })
        );

        document.dispatchEvent(
          new MouseEvent('mousemove', {
            clientX: 120,
            clientY: 50
          })
        );

        document.dispatchEvent(
          new MouseEvent('mouseup', {
            clientX: 120,
            clientY: 50
          })
        );
      }).not.toThrow();
    });

    it('ignores mousemove when not dragging', () => {
      handler = new DragHandler(element, callbacks);

      document.dispatchEvent(
        new MouseEvent('mousemove', {
          clientX: 120,
          clientY: 50
        })
      );

      expect(callbacks.onMove).not.toHaveBeenCalled();
    });

    it('ignores mouseup when not dragging', () => {
      handler = new DragHandler(element, callbacks);

      document.dispatchEvent(
        new MouseEvent('mouseup', {
          clientX: 120,
          clientY: 50
        })
      );

      expect(callbacks.onEnd).not.toHaveBeenCalled();
    });
  });
});
