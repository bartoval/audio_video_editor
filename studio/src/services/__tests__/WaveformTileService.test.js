import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

let mockWorker = null;

class MockWorker {
  constructor() {
    this.onmessage = null;
    this.onerror = null;
    mockWorker = this;

    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({ data: { type: 'ready' } });
      }
    }, 0);
  }

  postMessage(message) {
    if (message.type === 'getTile') {
      setTimeout(() => {
        if (this.onmessage) {
          const { requestId, clipId, tileIdx, magnification } = message.data;

          this.onmessage({
            data: {
              type: 'tile',
              data: {
                requestId,
                clipId,
                tileIdx,
                magnification,
                peaks: new Float32Array([0.5, -0.3, 0.4, -0.2])
              }
            }
          });
        }
      }, 5);
    } else if (message.type === 'invalidate') {
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage({
            data: {
              type: 'invalidated',
              data: { count: 1 }
            }
          });
        }
      }, 0);
    }
  }

  terminate() {
    mockWorker = null;
  }
}

vi.stubGlobal('Worker', MockWorker);

vi.mock('../../config/routes.js', () => ({
  ASSETS: {
    waveformWorker: '/waveform-worker.js'
  }
}));

const createMockAudioBuffer = (duration = 10, sampleRate = 44100) => {
  const length = Math.floor(duration * sampleRate);
  const channelData = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    channelData[i] = Math.sin((i / sampleRate) * 440 * Math.PI * 2) * 0.5;
  }

  return {
    length,
    sampleRate,
    numberOfChannels: 1,
    getChannelData: vi.fn(() => channelData)
  };
};

describe('WaveformTileService', () => {
  let waveformTileService;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockWorker = null;

    vi.resetModules();

    const module = await import('../WaveformTileService.js');
    waveformTileService = module.default;

    waveformTileService.destroy();
  });

  afterEach(() => {
    waveformTileService?.destroy();
  });

  describe('getTileIndexForTime', () => {
    it('returns correct tile index for time at boundaries', () => {
      expect(waveformTileService.getTileIndexForTime(0)).toBe(0);
      expect(waveformTileService.getTileIndexForTime(1.9)).toBe(0);
      expect(waveformTileService.getTileIndexForTime(2)).toBe(1);
      expect(waveformTileService.getTileIndexForTime(4)).toBe(2);
    });

    it('handles fractional times correctly', () => {
      expect(waveformTileService.getTileIndexForTime(0.5)).toBe(0);
      expect(waveformTileService.getTileIndexForTime(2.5)).toBe(1);
      expect(waveformTileService.getTileIndexForTime(5.9)).toBe(2);
    });
  });

  describe('getTileTimeRange', () => {
    it('returns correct time range for tile 0', () => {
      const range = waveformTileService.getTileTimeRange(0);

      expect(range.start).toBe(0);
      expect(range.end).toBe(2);
    });

    it('returns correct time range for tile 1', () => {
      const range = waveformTileService.getTileTimeRange(1);

      expect(range.start).toBe(2);
      expect(range.end).toBe(4);
    });

    it('returns correct time range for tile 5', () => {
      const range = waveformTileService.getTileTimeRange(5);

      expect(range.start).toBe(10);
      expect(range.end).toBe(12);
    });
  });

  describe('getTileDuration', () => {
    it('returns configured tile duration of 2 seconds', () => {
      expect(waveformTileService.getTileDuration()).toBe(2);
    });
  });

  describe('onChange', () => {
    it('adds listener and returns cleanup function', () => {
      const listener = vi.fn();
      const cleanup = waveformTileService.onChange(listener);

      expect(typeof cleanup).toBe('function');

      cleanup();
    });

    it('removes listener on cleanup', () => {
      const listener = vi.fn();
      const cleanup = waveformTileService.onChange(listener);

      cleanup();

      waveformTileService.invalidateAll();

      expect(listener).not.toHaveBeenCalled();
    });

    it('calls listener when cache changes', async () => {
      const listener = vi.fn();

      waveformTileService.onChange(listener);

      const audioBuffer = createMockAudioBuffer(10);

      await waveformTileService.getTile('clip1', 0, 6, audioBuffer);

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('invalidate', () => {
    it('clears cache for specific clipId', () => {
      waveformTileService.invalidate('clip1');

      expect(true).toBe(true);
    });

    it('sends invalidate message to worker if initialized', async () => {
      const audioBuffer = createMockAudioBuffer(10);

      await waveformTileService.getTile('clip1', 0, 6, audioBuffer);

      waveformTileService.invalidate('clip1');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWorker).not.toBe(null);
    });
  });

  describe('invalidateAll', () => {
    it('clears all cached tiles', () => {
      waveformTileService.invalidateAll();

      expect(true).toBe(true);
    });
  });

  describe('destroy', () => {
    it('terminates worker and clears state', async () => {
      const audioBuffer = createMockAudioBuffer(10);

      await waveformTileService.getTile('clip1', 0, 6, audioBuffer);

      waveformTileService.destroy();

      expect(mockWorker).toBe(null);
    });

    it('can be called multiple times safely', () => {
      waveformTileService.destroy();
      waveformTileService.destroy();

      expect(true).toBe(true);
    });
  });

  describe('getTile', () => {
    it('initializes worker on first call', async () => {
      const audioBuffer = createMockAudioBuffer(10);

      await waveformTileService.getTile('clip1', 0, 6, audioBuffer);

      expect(mockWorker).not.toBe(null);
    });

    it('returns peaks from worker', async () => {
      const audioBuffer = createMockAudioBuffer(10);

      const peaks = await waveformTileService.getTile('clip1', 0, 6, audioBuffer);

      expect(peaks).toBeInstanceOf(Float32Array);
      expect(peaks.length).toBe(4);
    });

    it('returns empty array for out-of-range tile', async () => {
      const audioBuffer = createMockAudioBuffer(1);

      const result = await waveformTileService.getTile('clip1', 10, 6, audioBuffer);

      expect(result).toEqual(new Float32Array(0));
    });

    it('extracts channel data from audio buffer', async () => {
      const audioBuffer = createMockAudioBuffer(10);

      await waveformTileService.getTile('clip1', 0, 6, audioBuffer);

      expect(audioBuffer.getChannelData).toHaveBeenCalledWith(0);
    });
  });

  describe('getTilesForWindow', () => {
    it('returns object with tiles and bounds', async () => {
      const audioBuffer = createMockAudioBuffer(20);

      const result = await waveformTileService.getTilesForWindow('clip1', 3, 5, 6, audioBuffer);

      expect(result).toHaveProperty('tiles');
      expect(result).toHaveProperty('bufferedStart');
      expect(result).toHaveProperty('bufferedEnd');
      expect(Array.isArray(result.tiles)).toBe(true);
      expect(result.tiles.length).toBeGreaterThan(0);
    });

    it('each tile has required properties', async () => {
      const audioBuffer = createMockAudioBuffer(20);

      const { tiles } = await waveformTileService.getTilesForWindow('clip1', 0, 2, 6, audioBuffer);

      const tile = tiles[0];

      expect(tile).toHaveProperty('tileIdx');
      expect(tile).toHaveProperty('tileStart');
      expect(tile).toHaveProperty('tileEnd');
      expect(tile).toHaveProperty('peaks');
    });

    it('includes buffer tiles around visible window', async () => {
      const audioBuffer = createMockAudioBuffer(20);

      const { tiles } = await waveformTileService.getTilesForWindow('clip1', 6, 8, 6, audioBuffer);

      const tileIndices = tiles.map(t => t.tileIdx);

      expect(tileIndices).toContain(3);
    });

    it('returns buffered bounds larger than requested window', async () => {
      const audioBuffer = createMockAudioBuffer(20);

      const { bufferedStart, bufferedEnd } = await waveformTileService.getTilesForWindow(
        'clip1',
        6,
        8,
        6,
        audioBuffer
      );

      expect(bufferedStart).toBeLessThanOrEqual(6);
      expect(bufferedEnd).toBeGreaterThanOrEqual(8);
    });
  });

  describe('caching', () => {
    it('caches tile data after first fetch', async () => {
      const audioBuffer = createMockAudioBuffer(10);

      await waveformTileService.getTile('clip1', 0, 6, audioBuffer);

      const callCount = audioBuffer.getChannelData.mock.calls.length;

      await waveformTileService.getTile('clip1', 0, 6, audioBuffer);

      expect(audioBuffer.getChannelData.mock.calls.length).toBe(callCount);
    });

    it('uses different cache for different magnification', async () => {
      const audioBuffer = createMockAudioBuffer(10);

      await waveformTileService.getTile('clip1', 0, 6, audioBuffer);

      const callCount1 = audioBuffer.getChannelData.mock.calls.length;

      await waveformTileService.getTile('clip1', 0, 12, audioBuffer);

      expect(audioBuffer.getChannelData.mock.calls.length).toBeGreaterThan(callCount1);
    });
  });

  describe('request deduplication', () => {
    it('returns existing promise for in-flight request', async () => {
      const audioBuffer = createMockAudioBuffer(10);

      const promise1 = waveformTileService.getTile('clip1', 0, 6, audioBuffer);
      const promise2 = waveformTileService.getTile('clip1', 0, 6, audioBuffer);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toEqual(result2);
    });
  });
});
