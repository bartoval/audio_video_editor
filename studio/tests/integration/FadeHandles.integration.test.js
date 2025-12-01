/**
 * Integration test: FadeHandles with real browser
 *
 * Tests FadeHandles drag behavior with real DOM dimensions
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('FadeHandles Integration', () => {
  let container;
  let FadeHandles;

  beforeEach(async () => {
    const module = await import(
      '../../src/components/timeline/navigator/tracks/views/FadeHandles.js'
    );
    FadeHandles = module.default;

    container = createTrackContainer(500, 100);
  });

  afterEach(() => {
    container?.remove();
  });

  describe('Drag with real browser dimensions', () => {
    it('updates position when dragged with valid duration', () => {
      const onFadeChange = vi.fn();
      const handles = new FadeHandles(
        { id: 'test', duration: 10, fadeIn: 0, fadeOut: 0 },
        container,
        { onFadeChange }
      );

      handles.updateLayout(500, 10);

      const fadeIn = container.querySelector('.fade-handle-in');
      expect(fadeIn).not.toBeNull();

      const initialLeft = fadeIn.style.left;

      simulateDrag(fadeIn, 0, 7, 100, 7);

      expect(fadeIn.style.left).not.toBe(initialLeft);
      expect(onFadeChange).toHaveBeenCalled();
    });

    it('does NOT update position when duration is 0 (bug prevention)', () => {
      const onFadeChange = vi.fn();
      const handles = new FadeHandles(
        { id: 'test', duration: 0, fadeIn: 0, fadeOut: 0 },
        container,
        { onFadeChange }
      );

      const fadeIn = container.querySelector('.fade-handle-in');
      const initialLeft = fadeIn.style.left;

      simulateDrag(fadeIn, 0, 7, 100, 7);

      expect(fadeIn.style.left).toBe(initialLeft);
    });

    it('clamps fade-in to not overlap with fade-out', () => {
      const onFadeChange = vi.fn();
      const handles = new FadeHandles(
        { id: 'test', duration: 10, fadeIn: 0, fadeOut: 5 },
        container,
        { onFadeChange }
      );

      handles.updateLayout(500, 10);

      const fadeIn = container.querySelector('.fade-handle-in');

      simulateDrag(fadeIn, 0, 7, 400, 7);

      const result = onFadeChange.mock.calls[0][0];
      expect(result.fadeIn).toBeLessThanOrEqual(5);
    });
  });

  describe('Visual positioning', () => {
    it('positions overlays correctly based on fade duration', () => {
      const handles = new FadeHandles(
        { id: 'test', duration: 10, fadeIn: 2, fadeOut: 3 },
        container,
        {}
      );

      handles.updateLayout(500, 10);

      const overlayIn = container.querySelector('.fade-overlay-in');
      const overlayOut = container.querySelector('.fade-overlay-out');

      expect(overlayIn.style.width).toBe('100px');
      expect(overlayOut.style.width).toBe('150px');
    });
  });
});
