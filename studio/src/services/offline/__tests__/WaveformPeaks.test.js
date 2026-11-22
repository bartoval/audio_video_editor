import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const rows = new Map();

vi.mock('../IndexedDB', () => ({
  STORES: { WAVEFORM_PEAKS: 'waveformPeaks' },
  default: {
    getInstance: () => ({
      get: vi.fn(async (_store, key) => rows.get(key)),
      put: vi.fn(async (_store, row) => rows.set(row.key, row)),
      delete: vi.fn(async (_store, key) => rows.delete(key))
    })
  }
}));

import * as WaveformPeaks from '../WaveformPeaks';

const decoded = {
  length: 1024,
  sampleRate: 48000,
  numberOfChannels: 1,
  getChannelData: () => new Float32Array(1024).fill(0.5)
};

describe('WaveformPeaks', () => {
  let decodeAudioData;

  beforeEach(() => {
    rows.clear();
    WaveformPeaks.clearMemory();
    decodeAudioData = vi.fn().mockResolvedValue(decoded);
    vi.stubGlobal(
      'OfflineAudioContext',
      class {
        decodeAudioData = decodeAudioData;
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const blob = () => ({ arrayBuffer: async () => new ArrayBuffer(8) });

  it('returns null for a file without peaks', async () => {
    await expect(WaveformPeaks.get('ws', 'a.mp3')).resolves.toBeNull();
  });

  it('stores peaks computed from a decoded buffer and reads them back', async () => {
    const peaks = await WaveformPeaks.saveFromBuffer('ws', 'a.mp3', decoded);

    expect(peaks).toMatchObject({ sampleRate: 48000, length: 1024, bucket: 256 });
    expect(rows.get('ws:a.mp3')).toMatchObject({ workspaceUuid: 'ws', id: 'a.mp3' });

    WaveformPeaks.clearMemory();
    const read = await WaveformPeaks.get('ws', 'a.mp3');
    expect(read.data).toEqual(peaks.data);
  });

  it('decodes a file once, even when asked twice at the same time', async () => {
    const getBlob = vi.fn(blob);

    const [first, second] = await Promise.all([
      WaveformPeaks.ensure('ws', 'a.mp3', getBlob),
      WaveformPeaks.ensure('ws', 'a.mp3', getBlob)
    ]);

    expect(first).toBe(second);
    expect(decodeAudioData).toHaveBeenCalledTimes(1);
    expect(getBlob).toHaveBeenCalledTimes(1);
  });

  it('does not decode when the peaks are already stored', async () => {
    await WaveformPeaks.saveFromBuffer('ws', 'a.mp3', decoded);

    await WaveformPeaks.ensure('ws', 'a.mp3', blob);

    expect(decodeAudioData).not.toHaveBeenCalled();
  });

  it('returns null when the file is not available', async () => {
    await expect(WaveformPeaks.ensure('ws', 'missing.mp3', () => null)).resolves.toBeNull();
  });

  it('forgets the peaks of a deleted file', async () => {
    await WaveformPeaks.saveFromBuffer('ws', 'a.mp3', decoded);

    await WaveformPeaks.remove('ws', 'a.mp3');

    await expect(WaveformPeaks.get('ws', 'a.mp3')).resolves.toBeNull();
  });
});
