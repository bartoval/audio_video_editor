const { createTrackListManager } = require('../trackList');

describe('createTrackListManager', () => {
  const mockFiles = { trackList: 'trackList.json' };
  let mockFileRepo;
  let manager;

  beforeEach(() => {
    mockFileRepo = {
      readJson: vi.fn(),
      writeJson: vi.fn()
    };
    manager = createTrackListManager('/projects/test', mockFiles, mockFileRepo);
  });

  describe('getTracks', () => {
    it('returns tracks from file', async () => {
      const tracks = { 'track1.wav': { duration: 10 } };
      mockFileRepo.readJson.mockResolvedValue({ tracks });

      const result = await manager.getTracks();

      expect(result).toEqual(tracks);
    });

    it('returns empty object when no tracks', async () => {
      mockFileRepo.readJson.mockResolvedValue(null);

      const result = await manager.getTracks();

      expect(result).toEqual({});
    });

    it('returns empty object when tracks key missing', async () => {
      mockFileRepo.readJson.mockResolvedValue({});

      const result = await manager.getTracks();

      expect(result).toEqual({});
    });
  });

  describe('getTrack', () => {
    it('returns specific track', async () => {
      const trackData = { duration: 10, channels: 2 };
      mockFileRepo.readJson.mockResolvedValue({ tracks: { 'track1.wav': trackData } });

      const result = await manager.getTrack('track1.wav');

      expect(result).toEqual(trackData);
    });

    it('returns null for missing track', async () => {
      mockFileRepo.readJson.mockResolvedValue({ tracks: {} });

      const result = await manager.getTrack('missing.wav');

      expect(result).toBeNull();
    });
  });

  describe('addTrack', () => {
    it('adds track and saves', async () => {
      mockFileRepo.readJson.mockResolvedValue({ tracks: {} });
      const metadata = { duration: 5, channels: 2 };

      const result = await manager.addTrack('new.wav', metadata);

      expect(result).toEqual(metadata);
      expect(mockFileRepo.writeJson).toHaveBeenCalledWith('/projects/test/trackList.json', {
        tracks: { 'new.wav': metadata }
      });
    });

    it('preserves existing tracks', async () => {
      const existing = { 'old.wav': { duration: 3 } };
      mockFileRepo.readJson.mockResolvedValue({ tracks: existing });

      await manager.addTrack('new.wav', { duration: 5 });

      expect(mockFileRepo.writeJson).toHaveBeenCalledWith('/projects/test/trackList.json', {
        tracks: { 'old.wav': { duration: 3 }, 'new.wav': { duration: 5 } }
      });
    });
  });

  describe('removeTrack', () => {
    it('removes existing track and returns true', async () => {
      mockFileRepo.readJson.mockResolvedValue({ tracks: { 'track.wav': { duration: 5 } } });

      const result = await manager.removeTrack('track.wav');

      expect(result).toBe(true);
      expect(mockFileRepo.writeJson).toHaveBeenCalledWith('/projects/test/trackList.json', {
        tracks: {}
      });
    });

    it('returns false for non-existent track', async () => {
      mockFileRepo.readJson.mockResolvedValue({ tracks: {} });

      const result = await manager.removeTrack('missing.wav');

      expect(result).toBe(false);
      expect(mockFileRepo.writeJson).not.toHaveBeenCalled();
    });
  });

  describe('hasTrack', () => {
    it('returns true when track exists', async () => {
      mockFileRepo.readJson.mockResolvedValue({ tracks: { 'track.wav': {} } });

      expect(await manager.hasTrack('track.wav')).toBe(true);
    });

    it('returns false when track does not exist', async () => {
      mockFileRepo.readJson.mockResolvedValue({ tracks: {} });

      expect(await manager.hasTrack('missing.wav')).toBe(false);
    });
  });
});
