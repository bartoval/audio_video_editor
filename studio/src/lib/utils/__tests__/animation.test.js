import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyTransform3d,
  applyTransformMultiple,
  setTransition,
  lerp,
  clamp,
  normalize,
  denormalize
} from '../animation.js';

describe('animation utilities', () => {
  describe('applyTransform3d', () => {
    let element;

    beforeEach(() => {
      element = document.createElement('div');
    });

    it('applies 3D transform to element', () => {
      applyTransform3d(element, 10, 20, 30);
      expect(element.style.transform).toBe('translate3d(10px, 20px, 30px)');
    });

    it('uses default values when not provided', () => {
      applyTransform3d(element);
      expect(element.style.transform).toBe('translate3d(0px, 0px, 0px)');
    });

    it('handles partial parameters', () => {
      applyTransform3d(element, 100);
      expect(element.style.transform).toBe('translate3d(100px, 0px, 0px)');

      applyTransform3d(element, 100, 200);
      expect(element.style.transform).toBe('translate3d(100px, 200px, 0px)');
    });

    it('handles null element gracefully', () => {
      expect(() => applyTransform3d(null, 10, 20, 30)).not.toThrow();
      expect(() => applyTransform3d(undefined, 10, 20, 30)).not.toThrow();
    });

    it('handles negative values', () => {
      applyTransform3d(element, -10, -20, -30);
      expect(element.style.transform).toBe('translate3d(-10px, -20px, -30px)');
    });
  });

  describe('applyTransformMultiple', () => {
    let elements;

    beforeEach(() => {
      elements = [
        document.createElement('div'),
        document.createElement('div'),
        document.createElement('div')
      ];
    });

    it('applies transform to all elements', () => {
      applyTransformMultiple(elements, 50, 100, 0);

      elements.forEach(element => {
        expect(element.style.transform).toBe('translate3d(50px, 100px, 0px)');
      });
    });

    it('handles empty array', () => {
      expect(() => applyTransformMultiple([], 10, 20, 30)).not.toThrow();
    });

    it('skips null elements in array', () => {
      const mixedElements = [elements[0], null, elements[2], undefined];
      expect(() => applyTransformMultiple(mixedElements, 10, 20, 30)).not.toThrow();

      expect(elements[0].style.transform).toBe('translate3d(10px, 20px, 30px)');
      expect(elements[2].style.transform).toBe('translate3d(10px, 20px, 30px)');
    });
  });

  describe('setTransition', () => {
    let element;

    beforeEach(() => {
      element = document.createElement('div');
    });

    it('adds transition class when enabled', () => {
      setTransition(element, true);
      expect(element.classList.contains('event-transition')).toBe(true);
    });

    it('removes transition class when disabled', () => {
      element.classList.add('event-transition');
      setTransition(element, false);
      expect(element.classList.contains('event-transition')).toBe(false);
    });

    it('uses custom transition class', () => {
      setTransition(element, true, 'custom-transition');
      expect(element.classList.contains('custom-transition')).toBe(true);
      expect(element.classList.contains('event-transition')).toBe(false);
    });

    it('handles null element gracefully', () => {
      expect(() => setTransition(null, true)).not.toThrow();
      expect(() => setTransition(undefined, false)).not.toThrow();
    });
  });

  describe('lerp', () => {
    it('performs linear interpolation', () => {
      expect(lerp(0, 100, 0)).toBe(0);
      expect(lerp(0, 100, 0.5)).toBe(50);
      expect(lerp(0, 100, 1)).toBe(100);
    });

    it('handles negative values', () => {
      expect(lerp(-10, 10, 0.5)).toBe(0);
      expect(lerp(10, -10, 0.5)).toBe(0);
    });

    it('handles factors outside 0-1 range', () => {
      expect(lerp(0, 100, 1.5)).toBe(150);
      expect(lerp(0, 100, -0.5)).toBe(-50);
    });

    it('handles fractional values', () => {
      expect(lerp(0, 1, 0.333)).toBeCloseTo(0.333, 3);
      expect(lerp(10, 20, 0.25)).toBe(12.5);
    });
  });

  describe('clamp', () => {
    it('clamps value to min', () => {
      expect(clamp(5, 10, 20)).toBe(10);
      expect(clamp(-100, 0, 100)).toBe(0);
    });

    it('clamps value to max', () => {
      expect(clamp(25, 10, 20)).toBe(20);
      expect(clamp(200, 0, 100)).toBe(100);
    });

    it('returns value when within range', () => {
      expect(clamp(15, 10, 20)).toBe(15);
      expect(clamp(50, 0, 100)).toBe(50);
    });

    it('handles edge values', () => {
      expect(clamp(10, 10, 20)).toBe(10);
      expect(clamp(20, 10, 20)).toBe(20);
    });

    it('works with negative ranges', () => {
      expect(clamp(-5, -10, -1)).toBe(-5);
      expect(clamp(-15, -10, -1)).toBe(-10);
      expect(clamp(0, -10, -1)).toBe(-1);
    });
  });

  describe('normalize', () => {
    it('normalizes value to 0-1 range', () => {
      expect(normalize(0, 0, 100)).toBe(0);
      expect(normalize(50, 0, 100)).toBe(0.5);
      expect(normalize(100, 0, 100)).toBe(1);
    });

    it('handles different ranges', () => {
      expect(normalize(5, 0, 10)).toBe(0.5);
      expect(normalize(25, 0, 50)).toBe(0.5);
      expect(normalize(750, 500, 1000)).toBe(0.5);
    });

    it('handles negative ranges', () => {
      expect(normalize(0, -100, 100)).toBe(0.5);
      expect(normalize(-50, -100, 0)).toBe(0.5);
    });

    it('handles values outside range', () => {
      expect(normalize(150, 0, 100)).toBe(1.5);
      expect(normalize(-50, 0, 100)).toBe(-0.5);
    });
  });

  describe('denormalize', () => {
    it('converts normalized value back to range', () => {
      expect(denormalize(0, 0, 100)).toBe(0);
      expect(denormalize(0.5, 0, 100)).toBe(50);
      expect(denormalize(1, 0, 100)).toBe(100);
    });

    it('handles different ranges', () => {
      expect(denormalize(0.5, 0, 10)).toBe(5);
      expect(denormalize(0.5, 0, 50)).toBe(25);
      expect(denormalize(0.5, 500, 1000)).toBe(750);
    });

    it('handles negative ranges', () => {
      expect(denormalize(0.5, -100, 100)).toBe(0);
      expect(denormalize(0.5, -100, 0)).toBe(-50);
    });

    it('handles values outside 0-1', () => {
      expect(denormalize(1.5, 0, 100)).toBe(150);
      expect(denormalize(-0.5, 0, 100)).toBe(-50);
    });
  });

  describe('normalize/denormalize round-trip', () => {
    it('converts value to normalized and back', () => {
      const value = 75;
      const min = 0;
      const max = 100;

      const normalized = normalize(value, min, max);
      const denormalized = denormalize(normalized, min, max);

      expect(denormalized).toBe(value);
    });

    it('works with different ranges', () => {
      const value = 123.456;
      const min = -500;
      const max = 500;

      const normalized = normalize(value, min, max);
      const denormalized = denormalize(normalized, min, max);

      expect(denormalized).toBeCloseTo(value, 10);
    });
  });
});
