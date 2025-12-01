const mockFileRepo = {
  ensureDir: vi.fn().mockResolvedValue(undefined),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  writeJson: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(false)
};

const mockExecFile = vi.fn();

const { exportRepositoryCreator } = require('../exportRepository');

describe('exportRepository', () => {
  let exportRepo;

  beforeEach(() => {
    vi.clearAllMocks();
    exportRepo = exportRepositoryCreator({
      fileRepo: mockFileRepo,
      execFile: mockExecFile
    });
  });

  describe('buildVolumeFilter (via exportAudio)', () => {
    it('builds simple volume filter without shell quotes', async () => {
      mockExecFile.mockImplementation((_cmd, _args, callback) => {
        callback(null, '', '');
      });

      const tracks = [
        {
          idTrack: 'test.wav',
          stretchFactor: 1,
          pitch: 0,
          startTime: 0,
          panValue: 0,
          gain: 0.8,
          volumeValues: []
        }
      ];

      await exportRepo.exportAudio('/output.mp3', tracks, '/library', 10);

      const firstCall = mockExecFile.mock.calls[0];
      const filterArg = firstCall[1].find((_arg, idx) => firstCall[1][idx - 1] === '-filter:a');

      expect(filterArg).toBeDefined();
      expect(filterArg).toMatch(/^volume=0\.80000$/);
      expect(filterArg).not.toContain('"');
      expect(filterArg).not.toContain("'");
    });
  });

  describe('buildDelayFilter (via exportAudio)', () => {
    it('builds delay filter without shell quotes', async () => {
      mockExecFile.mockImplementation((_cmd, _args, callback) => {
        callback(null, '', '');
      });

      const tracks = [
        {
          idTrack: 'test.wav',
          stretchFactor: 1,
          pitch: 0,
          startTime: 2,
          panValue: 0,
          gain: 1,
          volumeValues: []
        }
      ];

      await exportRepo.exportAudio('/output.mp3', tracks, '/library', 10);

      const firstCall = mockExecFile.mock.calls[0];
      const filterArg = firstCall[1].find((_arg, idx) => firstCall[1][idx - 1] === '-filter:a');

      expect(filterArg).toContain('adelay=');
      expect(filterArg).not.toContain('"');
    });
  });

  describe('buildPanFilter (via exportAudio)', () => {
    it('builds pan filter without shell quotes', async () => {
      mockExecFile.mockImplementation((_cmd, _args, callback) => {
        callback(null, '', '');
      });

      const tracks = [
        {
          idTrack: 'test.wav',
          stretchFactor: 1,
          pitch: 0,
          startTime: 0,
          panValue: 0.5,
          gain: 1,
          volumeValues: []
        }
      ];

      await exportRepo.exportAudio('/output.mp3', tracks, '/library', 10);

      const firstCall = mockExecFile.mock.calls[0];
      const filterArg = firstCall[1].find((_arg, idx) => firstCall[1][idx - 1] === '-filter:a');

      expect(filterArg).toContain('pan=stereo|FL<');
      expect(filterArg).not.toContain('"');
    });
  });

  describe('buildTrimArgs (via exportAudio)', () => {
    it('includes trim args when isCut is true', async () => {
      mockExecFile.mockImplementation((_cmd, _args, callback) => {
        callback(null, '', '');
      });

      const tracks = [
        {
          idTrack: 'test.wav',
          stretchFactor: 1,
          pitch: 0,
          startTime: 0,
          panValue: 0,
          gain: 1,
          volumeValues: [],
          isCut: true,
          startTimeBuffer: 2,
          durationTimeBuffer: 5,
          durationTimeCut: 0
        }
      ];

      await exportRepo.exportAudio('/output.mp3', tracks, '/library', 10);

      const firstCall = mockExecFile.mock.calls[0];
      const args = firstCall[1];
      expect(args).toContain('-ss');
      expect(args).toContain('2');
      expect(args).toContain('-t');
      expect(args).toContain('5');
    });

    it('skips trim args when isCut is false', async () => {
      mockExecFile.mockImplementation((_cmd, _args, callback) => {
        callback(null, '', '');
      });

      const tracks = [
        {
          idTrack: 'test.wav',
          stretchFactor: 1,
          pitch: 0,
          startTime: 0,
          panValue: 0,
          gain: 1,
          volumeValues: [],
          isCut: false
        }
      ];

      await exportRepo.exportAudio('/output.mp3', tracks, '/library', 10);

      const firstCall = mockExecFile.mock.calls[0];
      const args = firstCall[1];
      const indexOfI = args.indexOf('-i');
      const argsBefore = args.slice(0, indexOfI);
      expect(argsBefore).not.toContain('-ss');
    });
  });

  describe('exportAudio input validation', () => {
    it('rejects non-finite stretchFactor in tracks', async () => {
      const tracks = [
        {
          idTrack: 'test.wav',
          stretchFactor: NaN,
          pitch: 0,
          startTime: 0,
          panValue: 0
        }
      ];

      await expect(exportRepo.exportAudio('/output.mp3', tracks, '/library', 10)).rejects.toThrow(
        'Invalid parameter "stretchFactor"'
      );
    });

    it('rejects no tracks', async () => {
      await expect(exportRepo.exportAudio('/output.mp3', [], '/library', 10)).rejects.toThrow(
        'No audio tracks to export'
      );
    });

    it('rejects invalid duration', async () => {
      await expect(
        exportRepo.exportAudio('/output.mp3', [{ idTrack: 'x.wav' }], '/library', 0)
      ).rejects.toThrow('Invalid duration');
    });
  });
});
