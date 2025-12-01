import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FadeHandles from '../FadeHandles';

describe('FadeHandles', () => {
  let $parent;
  let fadeHandles;
  let onFadeChange;

  beforeEach(() => {
    $parent = document.createElement('div');
    $parent.style.width = '500px';
    $parent.style.height = '100px';
    document.body.appendChild($parent);
    onFadeChange = vi.fn();
  });

  afterEach(() => {
    fadeHandles?.destroy();
    $parent?.remove();
  });

  const createFadeHandles = (config = {}) => {
    fadeHandles = new FadeHandles(
      { id: 'test', duration: 0, fadeIn: 0, fadeOut: 0, ...config },
      $parent,
      { onFadeChange }
    );

    return fadeHandles;
  };

  const simulateDrag = (element, startX, endX) => {
    element.dispatchEvent(new MouseEvent('mousedown', { clientX: startX, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: endX, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  };

  describe('render', () => {
    it('creates fade-in handle', () => {
      createFadeHandles();

      const fadeIn = $parent.querySelector('.fade-handle-in');
      expect(fadeIn).not.toBeNull();
      expect(fadeIn.style.left).toBe('0px');
    });

    it('creates fade-out handle', () => {
      createFadeHandles();

      const fadeOut = $parent.querySelector('.fade-handle-out');
      expect(fadeOut).not.toBeNull();
      expect(fadeOut.style.right).toBe('0px');
    });

    it('creates fade overlays', () => {
      createFadeHandles();

      expect($parent.querySelector('.fade-overlay-in')).not.toBeNull();
      expect($parent.querySelector('.fade-overlay-out')).not.toBeNull();
    });
  });

  describe('updateLayout', () => {
    it('does not update when trackWidth is 0', () => {
      createFadeHandles();
      fadeHandles.setFadeIn(1);

      fadeHandles.updateLayout(0, 10);

      const fadeIn = $parent.querySelector('.fade-handle-in');
      expect(fadeIn.style.left).toBe('0px');
    });

    it('does not update when trackDuration is 0', () => {
      createFadeHandles();
      fadeHandles.setFadeIn(1);

      fadeHandles.updateLayout(500, 0);

      const fadeIn = $parent.querySelector('.fade-handle-in');
      expect(fadeIn.style.left).toBe('0px');
    });

    it('positions fade-in handle based on duration', () => {
      createFadeHandles();
      fadeHandles.setFadeIn(2);
      fadeHandles.updateLayout(500, 10);

      const fadeIn = $parent.querySelector('.fade-handle-in');
      // 2s fade / 10s duration * 500px = 100px
      expect(fadeIn.style.left).toBe('100px');
    });

    it('positions fade-out handle based on duration', () => {
      createFadeHandles();
      fadeHandles.setFadeOut(2);
      fadeHandles.updateLayout(500, 10);

      const fadeOut = $parent.querySelector('.fade-handle-out');
      expect(fadeOut.style.right).toBe('100px');
    });

    it('sets overlay widths correctly', () => {
      createFadeHandles();
      fadeHandles.setFadeIn(2);
      fadeHandles.setFadeOut(3);
      fadeHandles.updateLayout(500, 10);

      const overlayIn = $parent.querySelector('.fade-overlay-in');
      const overlayOut = $parent.querySelector('.fade-overlay-out');
      expect(overlayIn.style.width).toBe('100px');
      expect(overlayOut.style.width).toBe('150px');
    });
  });

  describe('drag with valid duration', () => {
    it('updates fadeIn on drag right', () => {
      createFadeHandles();
      fadeHandles.updateLayout(500, 10);

      const fadeIn = $parent.querySelector('.fade-handle-in');
      simulateDrag(fadeIn, 0, 100);

      expect(onFadeChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'in',
          fadeIn: expect.any(Number)
        })
      );
      expect(onFadeChange.mock.calls[0][0].fadeIn).toBeGreaterThan(0);
    });

    it('updates fadeOut on drag left', () => {
      createFadeHandles();
      fadeHandles.updateLayout(500, 10);

      const fadeOut = $parent.querySelector('.fade-handle-out');
      simulateDrag(fadeOut, 500, 400);

      expect(onFadeChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'out',
          fadeOut: expect.any(Number)
        })
      );
      expect(onFadeChange.mock.calls[0][0].fadeOut).toBeGreaterThan(0);
    });

    it('clamps fadeIn to not exceed track duration minus fadeOut', () => {
      createFadeHandles();
      fadeHandles.setFadeOut(5);
      fadeHandles.updateLayout(500, 10);

      const fadeIn = $parent.querySelector('.fade-handle-in');
      // Drag beyond what's allowed
      simulateDrag(fadeIn, 0, 400);

      const result = onFadeChange.mock.calls[0][0];
      expect(result.fadeIn).toBeLessThanOrEqual(5);
    });

    it('clamps fadeOut to not exceed track duration minus fadeIn', () => {
      createFadeHandles();
      fadeHandles.setFadeIn(5);
      fadeHandles.updateLayout(500, 10);

      const fadeOut = $parent.querySelector('.fade-handle-out');
      simulateDrag(fadeOut, 500, 100);

      const result = onFadeChange.mock.calls[0][0];
      expect(result.fadeOut).toBeLessThanOrEqual(5);
    });

    it('does not allow negative fadeIn', () => {
      createFadeHandles();
      fadeHandles.updateLayout(500, 10);

      const fadeIn = $parent.querySelector('.fade-handle-in');
      simulateDrag(fadeIn, 100, 0);

      const result = onFadeChange.mock.calls[0][0];
      expect(result.fadeIn).toBeGreaterThanOrEqual(0);
    });
  });

  describe('drag without valid duration (bug prevention)', () => {
    it('does not update fade values when duration is 0', () => {
      createFadeHandles();
      // No updateLayout called - simulates the bug we fixed

      const fadeIn = $parent.querySelector('.fade-handle-in');
      simulateDrag(fadeIn, 0, 100);

      // onFadeChange is still called, but values should be 0
      expect(onFadeChange).toHaveBeenCalled();
      const result = onFadeChange.mock.calls[0][0];
      expect(result.fadeIn).toBe(0);
      expect(result.fadeOut).toBe(0);
    });

    it('does not move handle position when duration is 0', () => {
      createFadeHandles();
      // No updateLayout called

      const fadeIn = $parent.querySelector('.fade-handle-in');
      const initialLeft = fadeIn.style.left;

      fadeIn.dispatchEvent(new MouseEvent('mousedown', { clientX: 0, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, bubbles: true }));

      // Position should not change since #updateOverlays returns early
      expect(fadeIn.style.left).toBe(initialLeft);

      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
  });

  describe('getters and setters', () => {
    it('getFadeIn returns current fadeIn duration', () => {
      createFadeHandles({ fadeIn: 2 });

      expect(fadeHandles.getFadeIn()).toBe(2);
    });

    it('getFadeOut returns current fadeOut duration', () => {
      createFadeHandles({ fadeOut: 3 });

      expect(fadeHandles.getFadeOut()).toBe(3);
    });

    it('setFadeIn updates fadeIn duration', () => {
      createFadeHandles();
      fadeHandles.setFadeIn(5);

      expect(fadeHandles.getFadeIn()).toBe(5);
    });

    it('setFadeOut updates fadeOut duration', () => {
      createFadeHandles();
      fadeHandles.setFadeOut(4);

      expect(fadeHandles.getFadeOut()).toBe(4);
    });

    it('setFadeIn clamps to minimum 0', () => {
      createFadeHandles();
      fadeHandles.setFadeIn(-5);

      expect(fadeHandles.getFadeIn()).toBe(0);
    });
  });

  describe('destroy', () => {
    it('removes event listeners', () => {
      createFadeHandles();
      fadeHandles.updateLayout(500, 10);

      const fadeIn = $parent.querySelector('.fade-handle-in');
      fadeHandles.destroy();

      // After destroy, drag should not trigger callback
      onFadeChange.mockClear();
      simulateDrag(fadeIn, 0, 100);

      expect(onFadeChange).not.toHaveBeenCalled();
    });
  });
});
