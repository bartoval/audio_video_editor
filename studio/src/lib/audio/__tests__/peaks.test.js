import { describe, it, expect } from 'vitest';
import { canDrawAt, computePeaks, computePeaksFromBuffer, frameRange, peaksToPath } from '../peaks';

/** Minimal AudioBuffer stand-in */
const fakeBuffer = (channels, sampleRate = 100) => ({
  length: channels[0].length,
  sampleRate,
  numberOfChannels: channels.length,
  getChannelData: c => channels[c]
});

describe('computePeaks', () => {
  it('keeps max then min per bucket, merged across channels', () => {
    const left = new Float32Array([0.1, 0.5, -0.2, 0.3, 0.0, -0.9]);
    const right = new Float32Array([0.7, -0.1, 0.0, -0.4, 0.2, 0.1]);

    const peaks = computePeaks([left, right], 6, 100, 2);

    expect(peaks).toMatchObject({ sampleRate: 100, length: 6, bucket: 2 });
    // buckets: [0,1] [2,3] [4,5]
    expect(Array.from(peaks.data)).toEqual([
      expect.closeTo(0.7),
      expect.closeTo(-0.1),
      expect.closeTo(0.3),
      expect.closeTo(-0.4),
      expect.closeTo(0.2),
      expect.closeTo(-0.9)
    ]);
  });

  it('summarizes a shorter last bucket', () => {
    const peaks = computePeaks([new Float32Array([0.2, -0.2, 0.9])], 3, 100, 2);

    expect(peaks.data.length).toBe(4);
    expect(peaks.data[2]).toBeCloseTo(0.9);
    expect(peaks.data[3]).toBe(0);
  });
});

describe('computePeaksFromBuffer', () => {
  it('gives the same peaks as the synchronous version across many slices', async () => {
    const frames = 8192 * 3 + 5; // more than one slice with bucket 1
    const channel = new Float32Array(frames).map((_, i) => Math.sin(i / 7));

    const sliced = await computePeaksFromBuffer(fakeBuffer([channel]), 1);
    const direct = computePeaks([channel], frames, 100, 1);

    expect(sliced.data).toEqual(direct.data);
  });
});

describe('frameRange', () => {
  const peaks = { sampleRate: 100, length: 1000, bucket: 10, data: new Float32Array(200) };

  it('treats negative bounds as the whole file, like the buffer crop', () => {
    expect(frameRange(peaks, -1, -1)).toEqual({ startFrame: 0, endFrame: 1000 });
    expect(frameRange(peaks)).toEqual({ startFrame: 0, endFrame: 1000 });
  });

  it('converts seconds to frames and clamps to the file', () => {
    expect(frameRange(peaks, 2, 5)).toEqual({ startFrame: 200, endFrame: 500 });
    expect(frameRange(peaks, 8, 20)).toEqual({ startFrame: 800, endFrame: 1000 });
  });
});

describe('peaksToPath', () => {
  // 8 buckets of 10 frames, bucket i has max i/10 and min -i/10
  const data = new Float32Array(16);
  for (let i = 0; i < 8; i++) {
    data[i * 2] = i / 10;
    data[i * 2 + 1] = -i / 10;
  }
  const peaks = { sampleRate: 100, length: 80, bucket: 10, data };

  it('returns max/min points per pixel in the views format', () => {
    const path = peaksToPath(peaks, { pixels: 4 });

    expect(path).toHaveLength(8);
    // each pixel covers two buckets: the louder one wins
    expect(path.map(p => p.x)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(path.map(p => p.y)).toEqual([
      expect.closeTo(0.1),
      expect.closeTo(-0.1),
      expect.closeTo(0.3),
      expect.closeTo(-0.3),
      expect.closeTo(0.5),
      expect.closeTo(-0.5),
      expect.closeTo(0.7),
      expect.closeTo(-0.7)
    ]);
  });

  it('draws only the cropped range', () => {
    // 0.2s..0.4s = frames 20..40 = buckets 2 and 3
    const path = peaksToPath(peaks, { pixels: 2, start: 0.2, end: 0.4 });

    expect(path.map(p => p.y)).toEqual([
      expect.closeTo(0.2),
      expect.closeTo(-0.2),
      expect.closeTo(0.3),
      expect.closeTo(-0.3)
    ]);
  });

  it('repeats a bucket when zoomed in past one bucket per pixel', () => {
    const path = peaksToPath(peaks, { pixels: 16 });

    expect(path).toHaveLength(32);
    expect(path[0].y).toBe(0);
    expect(path[2].y).toBe(0); // pixel 1 still in bucket 0
    expect(path[4].y).toBeCloseTo(0.1); // pixel 2 in bucket 1
  });
});

describe('canDrawAt', () => {
  const peaks = { sampleRate: 48000, length: 0, bucket: 256, data: new Float32Array() };

  it('accepts zooms where a pixel covers at least one bucket', () => {
    expect(canDrawAt(peaks, 0.1)).toBe(true);
    expect(canDrawAt(peaks, 256 / 48000)).toBe(true);
  });

  it('rejects deeper zooms, which need the decoded audio', () => {
    expect(canDrawAt(peaks, 0.001)).toBe(false);
  });
});
