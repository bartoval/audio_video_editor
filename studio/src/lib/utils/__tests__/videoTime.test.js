import { describe, it, expect } from 'vitest';
import {
  calculateFrame,
  calculateTimecode,
  formatFrame,
  formatTimecode,
  frameToSeconds
} from '../videoTime.js';

describe('videoTime utilities', () => {
  describe('calculateFrame', () => {
    it('calculates frame number from time at 24 fps', () => {
      expect(calculateFrame(0, 24)).toBe(0);
      expect(calculateFrame(1, 24)).toBe(24);
      expect(calculateFrame(2.5, 24)).toBe(60);
    });

    it('calculates frame number at 30 fps', () => {
      expect(calculateFrame(1, 30)).toBe(30);
      expect(calculateFrame(2, 30)).toBe(60);
    });

    it('calculates frame number at 60 fps', () => {
      expect(calculateFrame(1, 60)).toBe(60);
      expect(calculateFrame(0.5, 60)).toBe(30);
    });

    it('uses 24 fps as default', () => {
      expect(calculateFrame(1)).toBe(24);
    });

    it('returns 0 for zero fps', () => {
      expect(calculateFrame(1, 0)).toBe(0);
    });

    it('returns 0 for negative fps', () => {
      expect(calculateFrame(1, -24)).toBe(0);
    });

    it('floors frame number', () => {
      expect(calculateFrame(0.04, 24)).toBe(0); // 0.96 frames
      expect(calculateFrame(0.05, 24)).toBe(1); // 1.2 frames
    });
  });

  describe('calculateTimecode', () => {
    it('calculates SMPTE timecode at 0 seconds', () => {
      const tc = calculateTimecode(0, 24);
      expect(tc).toEqual({ hours: 0, minutes: 0, seconds: 0, frames: 0 });
    });

    it('calculates timecode for 1 second at 24 fps', () => {
      const tc = calculateTimecode(1, 24);
      expect(tc).toEqual({ hours: 0, minutes: 0, seconds: 1, frames: 0 });
    });

    it('calculates frames within second', () => {
      const tc = calculateTimecode(1.5, 24); // 36 frames total
      expect(tc.frames).toBe(12); // 36 % 24 = 12
      expect(tc.seconds).toBe(1);
    });

    it('calculates minutes', () => {
      const tc = calculateTimecode(65, 24); // 1 min 5 sec
      expect(tc.minutes).toBe(1);
      expect(tc.seconds).toBe(5);
    });

    it('calculates hours', () => {
      const tc = calculateTimecode(3661, 24); // 1 hour 1 min 1 sec
      expect(tc.hours).toBe(1);
      expect(tc.minutes).toBe(1);
      expect(tc.seconds).toBe(1);
    });

    it('uses 24 fps as default', () => {
      const tc = calculateTimecode(1);
      expect(tc.seconds).toBe(1);
    });
  });

  describe('formatFrame', () => {
    it('formats frame with padding', () => {
      expect(formatFrame(0, 24)).toBe('F00000 @24fps');
      expect(formatFrame(123, 24)).toBe('F00123 @24fps');
      expect(formatFrame(99999, 30)).toBe('F99999 @30fps');
    });

    it('handles different fps values', () => {
      expect(formatFrame(50, 60)).toBe('F00050 @60fps');
    });
  });

  describe('formatTimecode', () => {
    it('formats SMPTE timecode with padding', () => {
      expect(formatTimecode(0, 0, 0, 0)).toBe('00:00:00:00');
      expect(formatTimecode(1, 2, 3, 4)).toBe('01:02:03:04');
      expect(formatTimecode(12, 34, 56, 23)).toBe('12:34:56:23');
    });
  });

  describe('frameToSeconds', () => {
    it('converts frame to time at 24 fps', () => {
      expect(frameToSeconds(0, 24)).toBe(0);
      expect(frameToSeconds(24, 24)).toBe(1);
      expect(frameToSeconds(48, 24)).toBe(2);
      expect(frameToSeconds(12, 24)).toBe(0.5);
    });

    it('converts frame at 30 fps', () => {
      expect(frameToSeconds(30, 30)).toBe(1);
      expect(frameToSeconds(60, 30)).toBe(2);
    });

    it('uses 24 fps as default', () => {
      expect(frameToSeconds(24)).toBe(1);
    });

    it('returns 0 for zero fps', () => {
      expect(frameToSeconds(24, 0)).toBe(0);
    });

    it('returns 0 for negative fps', () => {
      expect(frameToSeconds(24, -24)).toBe(0);
    });
  });

  describe('roundtrip conversion', () => {
    it('converts frame to seconds and back', () => {
      const fps = 24;
      const frames = [0, 1, 12, 24, 48, 100, 1000];

      for (const frame of frames) {
        const seconds = frameToSeconds(frame, fps);
        const backToFrame = calculateFrame(seconds, fps);
        expect(backToFrame).toBe(frame);
      }
    });

    it('works with different fps values', () => {
      const fpsValues = [24, 25, 30, 60];

      for (const fps of fpsValues) {
        const frame = 100;
        const seconds = frameToSeconds(frame, fps);
        const backToFrame = calculateFrame(seconds, fps);
        expect(backToFrame).toBe(frame);
      }
    });
  });
});
