const {
  requireFile,
  requireVideoFile,
  requireAudioFile,
  requireThumbFile,
  requirePublishedVideo
} = require('../fileValidation');

describe('requireFile', () => {
  it('returns path when file exists', async () => {
    const mockFileRepo = { exists: vi.fn().mockResolvedValue(true) };
    const result = await requireFile(mockFileRepo, '/path/to/file.mp3');

    expect(result).toBe('/path/to/file.mp3');
    expect(mockFileRepo.exists).toHaveBeenCalledWith('/path/to/file.mp3');
  });

  it('throws NotFoundError when file does not exist', async () => {
    const mockFileRepo = { exists: vi.fn().mockResolvedValue(false) };

    await expect(requireFile(mockFileRepo, '/missing.mp3')).rejects.toThrow('File not found');
  });

  it('uses custom error message', async () => {
    const mockFileRepo = { exists: vi.fn().mockResolvedValue(false) };

    await expect(requireFile(mockFileRepo, '/missing.mp3', 'Custom error')).rejects.toThrow(
      'Custom error'
    );
  });
});

describe('requireVideoFile', () => {
  it('returns path when video exists', async () => {
    const mockFileRepo = { exists: vi.fn().mockResolvedValue(true) };
    expect(await requireVideoFile(mockFileRepo, '/video.mp4')).toBe('/video.mp4');
  });

  it('throws with video-specific message', async () => {
    const mockFileRepo = { exists: vi.fn().mockResolvedValue(false) };
    await expect(requireVideoFile(mockFileRepo, '/missing.mp4')).rejects.toThrow(
      'Video file not found'
    );
  });
});

describe('requireAudioFile', () => {
  it('throws with audio-specific message', async () => {
    const mockFileRepo = { exists: vi.fn().mockResolvedValue(false) };
    await expect(requireAudioFile(mockFileRepo, '/missing.wav')).rejects.toThrow(
      'Audio file not found'
    );
  });
});

describe('requireThumbFile', () => {
  it('throws with thumbnail-specific message', async () => {
    const mockFileRepo = { exists: vi.fn().mockResolvedValue(false) };
    await expect(requireThumbFile(mockFileRepo, '/missing.webp')).rejects.toThrow(
      'Thumbnail not found'
    );
  });
});

describe('requirePublishedVideo', () => {
  it('throws with published video message', async () => {
    const mockFileRepo = { exists: vi.fn().mockResolvedValue(false) };
    await expect(requirePublishedVideo(mockFileRepo, '/missing.mp4')).rejects.toThrow(
      'Published video not found'
    );
  });
});
