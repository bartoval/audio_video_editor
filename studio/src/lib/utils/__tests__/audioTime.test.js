import { describe, it, expect } from 'vitest';
import { calculateSample, formatSample, sampleToSeconds } from '../audioTime.js';

describe('audioTime utilities', () => {
  describe('calculateSample', () => {
    it('calculates sample position at default 48000 Hz', () => {
      expect(calculateSample(0)).toBe(0);
      expect(calculateSample(1)).toBe(48000);
      expect(calculateSample(2)).toBe(96000);
    });

    it('calculates sample position at 44100 Hz', () => {
      expect(calculateSample(1, 44100)).toBe(44100);
      expect(calculateSample(2, 44100)).toBe(88200);
    });

    it('calculates sample position at 96000 Hz', () => {
      expect(calculateSample(1, 96000)).toBe(96000);
      expect(calculateSample(0.5, 96000)).toBe(48000);
    });

    it('floors sample position for fractional times', () => {
      // 0.5 seconds at 48000 Hz = 24000 samples exactly
      expect(calculateSample(0.5, 48000)).toBe(24000);
      // 0.0001 seconds at 48000 Hz = 4.8 samples, floors to 4
      expect(calculateSample(0.0001, 48000)).toBe(4);
    });

    it('returns 0 for zero sample rate', () => {
      expect(calculateSample(1, 0)).toBe(0);
    });

    it('returns 0 for negative sample rate', () => {
      expect(calculateSample(1, -48000)).toBe(0);
    });

    it('returns 0 for null/undefined sample rate', () => {
      expect(calculateSample(1, null)).toBe(0);
      expect(calculateSample(1, undefined)).toBe(48000); // Uses default
    });
  });

  describe('formatSample', () => {
    it('formats sample with 7-digit padding', () => {
      expect(formatSample(0)).toBe('S0000000');
      expect(formatSample(1)).toBe('S0000001');
      expect(formatSample(123)).toBe('S0000123');
      expect(formatSample(48000)).toBe('S0048000');
    });

    it('handles large sample numbers', () => {
      expect(formatSample(1234567)).toBe('S1234567');
      expect(formatSample(9999999)).toBe('S9999999');
    });

    it('handles sample numbers exceeding 7 digits', () => {
      expect(formatSample(12345678)).toBe('S12345678');
    });
  });

  describe('sampleToSeconds', () => {
    it('converts sample to time at default 48000 Hz', () => {
      expect(sampleToSeconds(0)).toBe(0);
      expect(sampleToSeconds(48000)).toBe(1);
      expect(sampleToSeconds(96000)).toBe(2);
      expect(sampleToSeconds(24000)).toBe(0.5);
    });

    it('converts sample at 44100 Hz', () => {
      expect(sampleToSeconds(44100, 44100)).toBe(1);
      expect(sampleToSeconds(88200, 44100)).toBe(2);
    });

    it('converts sample at 96000 Hz', () => {
      expect(sampleToSeconds(96000, 96000)).toBe(1);
      expect(sampleToSeconds(48000, 96000)).toBe(0.5);
    });

    it('returns 0 for zero sample rate', () => {
      expect(sampleToSeconds(48000, 0)).toBe(0);
    });

    it('returns 0 for negative sample rate', () => {
      expect(sampleToSeconds(48000, -48000)).toBe(0);
    });
  });

  describe('roundtrip conversion', () => {
    it('converts seconds to sample and back', () => {
      const sampleRate = 48000;
      const times = [0, 0.5, 1, 2, 10, 60];

      for (const time of times) {
        const sample = calculateSample(time, sampleRate);
        const backToTime = sampleToSeconds(sample, sampleRate);
        expect(backToTime).toBe(time);
      }
    });

    it('works with different sample rates', () => {
      const sampleRates = [44100, 48000, 96000];

      for (const sampleRate of sampleRates) {
        const time = 2.5;
        const sample = calculateSample(time, sampleRate);
        const backToTime = sampleToSeconds(sample, sampleRate);
        expect(backToTime).toBe(time);
      }
    });

    it('sample to seconds and back preserves sample (for whole samples)', () => {
      const sampleRate = 48000;
      const samples = [0, 1, 100, 48000, 96000, 1000000];

      for (const sample of samples) {
        const seconds = sampleToSeconds(sample, sampleRate);
        const backToSample = calculateSample(seconds, sampleRate);
        expect(backToSample).toBe(sample);
      }
    });
  });
});
