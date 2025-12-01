import { describe, it, expect, vi, beforeEach } from 'vitest';
import DragCoordinator from '../DragStrategy.js';

describe('DragCoordinator', () => {
  let coordinator;
  let mockStrategy1;
  let mockStrategy2;

  beforeEach(() => {
    mockStrategy1 = {
      canHandle: vi.fn(() => false),
      onDrag: vi.fn(),
      onDragEnd: vi.fn()
    };
    mockStrategy2 = {
      canHandle: vi.fn(() => false),
      onDrag: vi.fn(),
      onDragEnd: vi.fn()
    };
    coordinator = new DragCoordinator([mockStrategy1, mockStrategy2]);
  });

  describe('start', () => {
    it('selects the first strategy that canHandle', () => {
      mockStrategy2.canHandle.mockReturnValue(true);

      coordinator.start();

      expect(mockStrategy1.canHandle).toHaveBeenCalled();
      expect(mockStrategy2.canHandle).toHaveBeenCalled();
      expect(coordinator.activeStrategy).toBe(mockStrategy2);
    });

    it('sets activeStrategy to null when no strategy canHandle', () => {
      coordinator.start();

      expect(coordinator.activeStrategy).toBeNull();
    });

    it('selects first matching strategy when multiple canHandle', () => {
      mockStrategy1.canHandle.mockReturnValue(true);
      mockStrategy2.canHandle.mockReturnValue(true);

      coordinator.start();

      expect(coordinator.activeStrategy).toBe(mockStrategy1);
    });
  });

  describe('drag', () => {
    it('calls onDrag on active strategy', () => {
      mockStrategy1.canHandle.mockReturnValue(true);
      coordinator.start();

      coordinator.drag(100, 50);

      expect(mockStrategy1.onDrag).toHaveBeenCalledWith(100, 50);
    });

    it('does not throw when no active strategy', () => {
      coordinator.start();

      expect(() => coordinator.drag(100, 50)).not.toThrow();
    });

    it('maintains active strategy across multiple drag calls', () => {
      mockStrategy1.canHandle.mockReturnValue(true);
      coordinator.start();

      coordinator.drag(100, 50);
      coordinator.drag(200, 60);
      coordinator.drag(300, 70);

      expect(mockStrategy1.onDrag).toHaveBeenCalledTimes(3);
    });
  });

  describe('dragEnd', () => {
    it('calls onDragEnd on active strategy', () => {
      mockStrategy1.canHandle.mockReturnValue(true);
      coordinator.start();

      coordinator.dragEnd();

      expect(mockStrategy1.onDragEnd).toHaveBeenCalled();
    });

    it('resets activeStrategy to null', () => {
      mockStrategy1.canHandle.mockReturnValue(true);
      coordinator.start();

      coordinator.dragEnd();

      expect(coordinator.activeStrategy).toBeNull();
    });

    it('does not throw when no active strategy', () => {
      coordinator.start();

      expect(() => coordinator.dragEnd()).not.toThrow();
    });
  });

  describe('full drag cycle', () => {
    it('completes a full drag operation', () => {
      mockStrategy1.canHandle.mockReturnValue(true);

      coordinator.start();
      coordinator.drag(100, 50);
      coordinator.drag(150, 55);
      coordinator.dragEnd();

      expect(mockStrategy1.onDrag).toHaveBeenCalledTimes(2);
      expect(mockStrategy1.onDragEnd).toHaveBeenCalledTimes(1);
      expect(coordinator.activeStrategy).toBeNull();
    });

    it('allows starting a new drag after dragEnd', () => {
      mockStrategy1.canHandle.mockReturnValue(true);

      coordinator.start();
      coordinator.drag(100, 50);
      coordinator.dragEnd();

      mockStrategy1.canHandle.mockClear();
      mockStrategy1.onDrag.mockClear();

      coordinator.start();
      coordinator.drag(200, 60);

      expect(mockStrategy1.canHandle).toHaveBeenCalled();
      expect(mockStrategy1.onDrag).toHaveBeenCalledWith(200, 60);
    });
  });

  describe('lazy strategy selection', () => {
    it('finds strategy on first drag if start was not called', () => {
      mockStrategy1.canHandle.mockReturnValue(true);

      coordinator.drag(100, 50);

      expect(mockStrategy1.canHandle).toHaveBeenCalled();
      expect(mockStrategy1.onDrag).toHaveBeenCalledWith(100, 50);
    });

    it('caches strategy after first drag', () => {
      mockStrategy1.canHandle.mockReturnValue(true);

      coordinator.drag(100, 50);
      mockStrategy1.canHandle.mockClear();

      coordinator.drag(200, 60);

      expect(mockStrategy1.canHandle).not.toHaveBeenCalled();
      expect(mockStrategy1.onDrag).toHaveBeenCalledWith(200, 60);
    });
  });
});
