import { describe, it, expect, beforeEach } from 'vitest';
import {
  SCALE_EPSILON,
  setScale,
  getScale,
  setScaleFactor,
  getScaleFactor,
  getPosXFromTime,
  getTimeFromPosX,
  getTimeFormatted,
  setFrames,
  getFrames,
  scaleChanged,
  scalesEqual
} from '../scale.js';

describe('scale utilities', () => {
  beforeEach(() => {
    setScale(0.1);
    setScaleFactor(10);
  });

  describe('setScale / getScale', () => {
    it('sets and gets scale value', () => {
      setScale(0.5);
      expect(getScale()).toBe(0.5);

      setScale(1.0);
      expect(getScale()).toBe(1.0);
    });
  });

  describe('setScaleFactor / getScaleFactor', () => {
    it('sets and gets scale factor', () => {
      setScaleFactor(20);
      expect(getScaleFactor()).toBe(20);

      setScaleFactor(5);
      expect(getScaleFactor()).toBe(5);
    });
  });

  describe('getPosXFromTime', () => {
    it('converts time to pixel position', () => {
      setScaleFactor(10);
      expect(getPosXFromTime(0)).toBe(0);
      expect(getPosXFromTime(1)).toBe(10);
      expect(getPosXFromTime(5.5)).toBe(55);
      expect(getPosXFromTime(10)).toBe(100);
    });

    it('throws error for invalid input', () => {
      expect(() => getPosXFromTime(-1)).toThrow('wrong input: time is -1');
      expect(() => getPosXFromTime(NaN)).toThrow('wrong input');
    });

    it('works with different scale factors', () => {
      setScaleFactor(100);
      expect(getPosXFromTime(1)).toBe(100);

      setScaleFactor(0.5);
      expect(getPosXFromTime(10)).toBe(5);
    });
  });

  describe('getTimeFromPosX', () => {
    it('converts pixel position to time', () => {
      setScaleFactor(10);
      expect(getTimeFromPosX(0)).toBe(0);
      expect(getTimeFromPosX(10)).toBe(1);
      expect(getTimeFromPosX(55)).toBe(5.5);
      expect(getTimeFromPosX(100)).toBe(10);
    });

    it('throws error for invalid input', () => {
      expect(() => getTimeFromPosX(-1)).toThrow('wrong input: posX is -1');
      expect(() => getTimeFromPosX(NaN)).toThrow('wrong input');
    });

    it('works with different scale factors', () => {
      setScaleFactor(100);
      expect(getTimeFromPosX(100)).toBe(1);

      setScaleFactor(0.5);
      expect(getTimeFromPosX(5)).toBe(10);
    });
  });

  describe('round-trip conversion', () => {
    it('converts time to position and back', () => {
      setScaleFactor(10);
      const time = 123.456;
      const posX = getPosXFromTime(time);
      const convertedTime = getTimeFromPosX(posX);
      expect(convertedTime).toBeCloseTo(time, 10);
    });
  });

  describe('getTimeFormatted', () => {
    it('formats time as mm:ss.mmm (milliseconds)', () => {
      expect(getTimeFormatted(0)).toBe('00:00.000');
      expect(getTimeFormatted(1)).toBe('00:01.000');
      expect(getTimeFormatted(60)).toBe('01:00.000');
      expect(getTimeFormatted(61.5)).toBe('01:01.500');
      expect(getTimeFormatted(125.789)).toBe('02:05.789');
    });

    it('handles minutes wrap at 60', () => {
      expect(getTimeFormatted(3661)).toBe('01:01.000');
    });

    it('handles fractional seconds with full millisecond precision', () => {
      expect(getTimeFormatted(1.234)).toBe('00:01.234');
      expect(getTimeFormatted(0.001)).toBe('00:00.001');
      expect(getTimeFormatted(0.1)).toBe('00:00.100');
    });
  });

  describe('setFrames / getFrames', () => {
    it('calculates frame info from delta time', () => {
      setScale(0.1);
      setFrames(0.016);

      const frames = getFrames();
      expect(frames).toHaveProperty('frame');
      expect(frames).toHaveProperty('preciseFrame');
      expect(typeof frames.frame).toBe('number');
      expect(typeof frames.preciseFrame).toBe('number');
    });

    it('frame is ceiling of preciseFrame', () => {
      setScale(0.1);
      setFrames(0.016);

      const frames = getFrames();
      expect(frames.frame).toBe(Math.ceil(frames.preciseFrame));
    });

    it('handles different scale values', () => {
      setScale(1.0);
      setFrames(0.016);
      const frames1 = getFrames();

      setScale(0.01);
      setFrames(0.016);
      const frames2 = getFrames();

      expect(frames1.preciseFrame).not.toBe(frames2.preciseFrame);
    });
  });

  describe('SCALE_EPSILON', () => {
    it('is a small positive number', () => {
      expect(SCALE_EPSILON).toBeGreaterThan(0);
      expect(SCALE_EPSILON).toBeLessThan(0.001);
    });
  });

  describe('scaleChanged', () => {
    it('returns true when scales differ significantly', () => {
      expect(scaleChanged(0.1, 0.2)).toBe(true);
      expect(scaleChanged(1.0, 1.001)).toBe(true);
      expect(scaleChanged(0.01, 0.02)).toBe(true);
    });

    it('returns false when scales are within epsilon', () => {
      expect(scaleChanged(0.1, 0.1)).toBe(false);
      expect(scaleChanged(0.1, 0.1 + SCALE_EPSILON / 2)).toBe(false);
    });

    it('handles negative differences', () => {
      expect(scaleChanged(0.2, 0.1)).toBe(true);
      expect(scaleChanged(1.0, 0.999)).toBe(true);
    });
  });

  describe('scalesEqual', () => {
    it('returns true when scales are within epsilon', () => {
      expect(scalesEqual(0.1, 0.1)).toBe(true);
      expect(scalesEqual(0.1, 0.1 + SCALE_EPSILON / 2)).toBe(true);
    });

    it('returns false when scales differ significantly', () => {
      expect(scalesEqual(0.1, 0.2)).toBe(false);
      expect(scalesEqual(1.0, 1.001)).toBe(false);
    });

    it('is inverse of scaleChanged', () => {
      const pairs = [
        [0.1, 0.1],
        [0.1, 0.2],
        [1.0, 1.0 + SCALE_EPSILON / 2],
        [1.0, 1.001]
      ];

      pairs.forEach(([a, b]) => {
        expect(scalesEqual(a, b)).toBe(!scaleChanged(a, b));
      });
    });
  });
});
