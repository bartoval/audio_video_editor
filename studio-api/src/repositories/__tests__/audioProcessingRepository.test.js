const mockFileRepo = {
  ensureDir: vi.fn().mockResolvedValue(undefined),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  writeJson: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(false)
};

const mockExecFile = vi.fn();

const { audioProcessingRepositoryCreator } = require('../audioProcessingRepository');

describe('audioProcessingRepository', () => {
  let audioRepo;

  beforeEach(() => {
    vi.clearAllMocks();
    audioRepo = audioProcessingRepositoryCreator({
      fileRepo: mockFileRepo,
      execFile: mockExecFile
    });
  });

  describe('stretchAudio', () => {
    it('uses execFile with args array (no shell injection)', async () => {
      mockExecFile.mockImplementation((_cmd, _args, callback) => {
        callback(null, '', '');
      });

      await audioRepo.stretchAudio('/input.wav', '/output.mp3', 1.5, 2, 0, 10);

      expect(mockExecFile).toHaveBeenCalledTimes(3);

      for (const call of mockExecFile.mock.calls) {
        const [executable, args] = call;
        expect(typeof executable).toBe('string');
        expect(Array.isArray(args)).toBe(true);
        args.forEach(arg => expect(typeof arg).toBe('string'));
      }
    });

    it('passes correct rubberband args', async () => {
      mockExecFile.mockImplementation((_cmd, _args, callback) => {
        callback(null, '', '');
      });

      await audioRepo.stretchAudio('/input.wav', '/output.mp3', 2.0, 3, 5, 10);

      const [executable, args] = mockExecFile.mock.calls[1];
      expect(executable).toBe('rubberband');
      expect(args).toContain('--ignore-clipping');
      expect(args).toContain('-t');
      expect(args).toContain('2');
      expect(args).toContain('-p');
      expect(args).toContain('3');
    });

    it('includes trim args when startTime > 0', async () => {
      mockExecFile.mockImplementation((_cmd, _args, callback) => {
        callback(null, '', '');
      });

      await audioRepo.stretchAudio('/input.wav', '/output.mp3', 1.0, 0, 5.5, 10);

      const [executable, args] = mockExecFile.mock.calls[0];
      expect(executable).toBe('ffmpeg');
      expect(args).toContain('-ss');
      expect(args).toContain('5.5');
      expect(args).toContain('-t');
      expect(args).toContain('10');
    });

    it('rejects non-finite ratio', async () => {
      await expect(
        audioRepo.stretchAudio('/input.wav', '/output.mp3', NaN, 0, 0, 0)
      ).rejects.toThrow('Invalid parameter "ratio"');
    });

    it('rejects Infinity as pitchValue', async () => {
      await expect(
        audioRepo.stretchAudio('/input.wav', '/output.mp3', 1.0, Infinity, 0, 0)
      ).rejects.toThrow('Invalid parameter "pitchValue"');
    });

    it('rejects string parameter (type coercion attack)', async () => {
      await expect(
        audioRepo.stretchAudio('/input.wav', '/output.mp3', 1.0, 0, '5; rm -rf /', 0)
      ).rejects.toThrow('Invalid parameter "startTime"');
    });

    it('cleans up temp files on failure', async () => {
      let callCount = 0;
      mockExecFile.mockImplementation((_cmd, _args, callback) => {
        callCount++;
        if (callCount === 2) {
          callback(new Error('rubberband failed'));
        } else {
          callback(null, '', '');
        }
      });

      await expect(
        audioRepo.stretchAudio('/input.wav', '/output.mp3', 1.0, 0, 0, 10)
      ).rejects.toThrow('rubberband failed');

      expect(mockFileRepo.deleteFile).toHaveBeenCalled();
    });
  });
});
