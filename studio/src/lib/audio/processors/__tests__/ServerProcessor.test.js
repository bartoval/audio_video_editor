import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetchWithRetry = vi.fn();
const mockFetchAudio = vi.fn();

vi.mock('../../../../services/workspace', () => ({
  getUuid: () => 'test-uuid',
  getDerivedTrackUrl: id => `/api/v1/workspaces/test-uuid/audio/derived/${id}`
}));

vi.mock('../../../../config/routes', () => ({
  buildUrl: (type, uuid, path) => `/api/v1/workspaces/${uuid}/${type}${path}`
}));

vi.mock('../../utils/FetchUtils', () => ({
  fetchWithRetry: mockFetchWithRetry,
  fetchAudio: mockFetchAudio
}));

vi.mock('../../../../services/offline/IndexedDB', () => ({
  default: {
    saveAudioBlob: vi.fn().mockResolvedValue()
  }
}));

describe('ServerProcessor', () => {
  let ServerProcessor;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await import('../ServerProcessor');
    ServerProcessor = module.default;
  });

  describe('stretch - hasValidRange calculation', () => {
    const mockSourceBuffer = { duration: 207.5 };
    const idTrack = 'track-123';
    const stretchFactor = 1.0;
    const pitchValue = 12;

    beforeEach(() => {
      mockFetchWithRetry.mockResolvedValue({
        json: () =>
          Promise.resolve({
            outputId: 'derived-track-id',
            url: '/api/v1/workspaces/test-uuid/audio/derived/derived-track-id'
          })
      });
      mockFetchAudio.mockResolvedValue({ duration: 207.5 });
    });

    it('uses sourceBuffer.duration when start=-1 and end=-1', async () => {
      const context = { start: -1, end: -1 };

      await ServerProcessor.stretch(mockSourceBuffer, idTrack, stretchFactor, pitchValue, context);

      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"startTime":0')
        })
      );
      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"duration":207.5')
        })
      );
    });

    it('uses sourceBuffer.duration when start=0 and end=-1', async () => {
      const context = { start: 0, end: -1 };

      await ServerProcessor.stretch(mockSourceBuffer, idTrack, stretchFactor, pitchValue, context);

      const call = mockFetchWithRetry.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.startTime).toBe(0);
      expect(body.duration).toBe(207.5);
    });

    it('uses provided range when start and end are valid', async () => {
      const context = { start: 10, end: 50 };

      await ServerProcessor.stretch(mockSourceBuffer, idTrack, stretchFactor, pitchValue, context);

      const call = mockFetchWithRetry.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.startTime).toBe(10);
      expect(body.duration).toBe(40);
    });

    it('uses sourceBuffer.duration when start > end (invalid range)', async () => {
      const context = { start: 50, end: 10 };

      await ServerProcessor.stretch(mockSourceBuffer, idTrack, stretchFactor, pitchValue, context);

      const call = mockFetchWithRetry.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.startTime).toBe(0);
      expect(body.duration).toBe(207.5);
    });

    it('uses sourceBuffer.duration when start equals end', async () => {
      const context = { start: 10, end: 10 };

      await ServerProcessor.stretch(mockSourceBuffer, idTrack, stretchFactor, pitchValue, context);

      const call = mockFetchWithRetry.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.startTime).toBe(0);
      expect(body.duration).toBe(207.5);
    });

    it('handles cut track with valid range (4 seconds)', async () => {
      const context = { start: 0, end: 4 };

      await ServerProcessor.stretch(mockSourceBuffer, idTrack, stretchFactor, pitchValue, context);

      const call = mockFetchWithRetry.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.startTime).toBe(0);
      expect(body.duration).toBe(4);
    });

    it('handles full track after reset (start=-1, end=-1)', async () => {
      const fullTrackBuffer = { duration: 207.5 };
      const context = { start: -1, end: -1 };

      await ServerProcessor.stretch(fullTrackBuffer, idTrack, stretchFactor, pitchValue, context);

      const call = mockFetchWithRetry.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.startTime).toBe(0);
      expect(body.duration).toBe(207.5);
    });
  });

  describe('stretch - request body', () => {
    const mockSourceBuffer = { duration: 100 };

    beforeEach(() => {
      mockFetchWithRetry.mockResolvedValue({
        json: () =>
          Promise.resolve({
            outputId: 'derived-id',
            url: null
          })
      });
      mockFetchAudio.mockResolvedValue({ duration: 100 });
    });

    it('sends correct audioId in request', async () => {
      const context = { start: -1, end: -1 };

      await ServerProcessor.stretch(mockSourceBuffer, 'my-track-id', 1.0, 5, context);

      const call = mockFetchWithRetry.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.audioId).toBe('my-track-id');
    });

    it('sends correct pitchValue in request', async () => {
      const context = { start: -1, end: -1 };

      await ServerProcessor.stretch(mockSourceBuffer, 'track', 1.0, 12, context);

      const call = mockFetchWithRetry.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.pitchValue).toBe(12);
    });

    it('sends ratio with one decimal place', async () => {
      const context = { start: -1, end: -1 };

      await ServerProcessor.stretch(mockSourceBuffer, 'track', 1.5, 0, context);

      const call = mockFetchWithRetry.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.ratio).toBe('1.5');
    });
  });

  describe('stretch - response handling', () => {
    const mockSourceBuffer = { duration: 100 };
    const context = { start: -1, end: -1 };

    beforeEach(() => {
      mockFetchAudio.mockResolvedValue({ duration: 100 });
    });

    it('returns derivedId from server response', async () => {
      mockFetchWithRetry.mockResolvedValue({
        json: () =>
          Promise.resolve({
            outputId: 'server-derived-id',
            url: null
          })
      });

      const result = await ServerProcessor.stretch(mockSourceBuffer, 'track', 1.0, 0, context);

      expect(result.derivedId).toBe('server-derived-id');
    });

    it('returns buffer duration from fetched audio', async () => {
      mockFetchWithRetry.mockResolvedValue({
        json: () =>
          Promise.resolve({
            outputId: 'id',
            url: null
          })
      });
      mockFetchAudio.mockResolvedValue({ duration: 150 });

      const result = await ServerProcessor.stretch(mockSourceBuffer, 'track', 1.5, 0, context);

      expect(result.duration).toBe(150);
    });
  });

  describe('deferred operations', () => {
    it('applyVolume returns deferred result', () => {
      const result = ServerProcessor.applyVolume();

      expect(result).toEqual({ buffer: null, deferred: true });
    });

    it('applyPan returns deferred result', () => {
      const result = ServerProcessor.applyPan();

      expect(result).toEqual({ buffer: null, deferred: true });
    });

    it('applyVolumeAndPan returns deferred result', () => {
      const result = ServerProcessor.applyVolumeAndPan();

      expect(result).toEqual({ buffer: null, deferred: true });
    });
  });
});
