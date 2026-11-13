const mockChunkRepo = {
  saveChunk: vi.fn().mockResolvedValue(undefined),
  allChunksExist: vi.fn().mockResolvedValue(false),
  assembleChunks: vi.fn().mockResolvedValue(undefined),
  cleanChunks: vi.fn().mockResolvedValue(undefined)
};

const mockFileRepo = {
  ensureDir: vi.fn().mockResolvedValue(undefined),
  writeJson: vi.fn().mockResolvedValue(undefined),
  readJson: vi.fn().mockResolvedValue(null),
  createWriteStream: vi.fn(() => ({ on: vi.fn() })),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  getStats: vi.fn().mockResolvedValue({ size: 1024 }),
  exists: vi.fn().mockResolvedValue(true)
};

const mockProjectRepo = {
  getProjectPath: vi.fn(uuid => `/tmp/test-projects/${uuid}`)
};

const mockMediaRepo = {
  probeMedia: vi.fn(() => ({
    format: { duration: 120, bit_rate: 320000 },
    streams: [
      {
        channel_layout: 'stereo',
        channels: 2,
        sample_rate: 44100,
        bits_per_sample: 16,
        codec_name: 'mp3'
      }
    ]
  }))
};

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}));

vi.mock('../../config', () => ({
  projectsPath: '/tmp/test-projects',
  tmpChunksPath: '/tmp/test-chunks',
  paths: {
    dirs: {
      resources: 'resources',
      videoTracks: 'resources/videoTracks',
      audioTracks: 'resources/audioTracks',
      library: 'library',
      derived: 'library/derived',
      thumbs: 'thumbs',
      saved: 'saved',
      published: 'published'
    },
    files: {
      projects: 'projects.json',
      original: 'originalWithAudio.mp4',
      info: 'info.json',
      trackList: 'trackList.json'
    }
  }
}));

vi.mock('../../utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }),
  formatDuration: vi.fn(() => '02:00.00'),
  NotFoundError: class extends Error {
    constructor(msg) {
      super(msg);
      this.statusCode = 404;
    }
  },
  ValidationError: class extends Error {
    constructor(msg) {
      super(msg);
      this.statusCode = 400;
    }
  },
  createTrackListManager: vi.fn(() => ({
    getTracks: vi.fn(() => ({})),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    getTrack: vi.fn()
  })),
  requireVideoFile: vi.fn(),
  requireAudioFile: vi.fn(),
  generateUniqueFilename: vi.fn(name => `unique_${name}`),
  parseFilename: vi.fn(name => ({
    ext: '.mp3',
    baseName: name.replace(/\.[^.]+$/, ''),
    extLower: 'mp3'
  })),
  computeFileHash: vi.fn(() => 'abc123hash')
}));

const { uploadServiceCreator } = require('../uploadService');

describe('uploadService', () => {
  let service;

  beforeEach(() => {
    vi.clearAllMocks();
    service = uploadServiceCreator({
      projectRepo: mockProjectRepo,
      mediaRepo: mockMediaRepo,
      chunkRepo: mockChunkRepo,
      fileRepo: mockFileRepo
    });
  });

  describe('handleVideoChunk', () => {
    const validFlowParams = {
      flowChunkNumber: 1,
      flowChunkSize: 1024,
      flowTotalSize: 2048,
      flowIdentifier: 'abc123',
      flowFilename: 'video.mp4'
    };

    it('saves chunk and returns partly_done when not all chunks received', async () => {
      mockChunkRepo.allChunksExist.mockResolvedValue(false);

      const result = await service.handleVideoChunk({ size: 1024 }, validFlowParams);

      expect(result.status).toBe('partly_done');
      expect(mockChunkRepo.saveChunk).toHaveBeenCalled();
    });

    it('returns done when all chunks received', async () => {
      mockChunkRepo.allChunksExist.mockResolvedValue(true);

      const result = await service.handleVideoChunk({ size: 1024 }, validFlowParams);

      expect(result.status).toBe('done');
      expect(result.filename).toBe('video.mp4');
    });

    it('rejects missing flow parameters', async () => {
      await expect(
        service.handleVideoChunk({ size: 1024 }, { flowChunkNumber: 1 })
      ).rejects.toThrow('Missing required flow parameters');
    });

    it('rejects invalid file chunk', async () => {
      await expect(service.handleVideoChunk(null, validFlowParams)).rejects.toThrow(
        'Invalid file chunk'
      );
    });

    it('rejects flowIdentifier with path traversal', async () => {
      await expect(
        service.handleVideoChunk(
          { size: 1024 },
          {
            ...validFlowParams,
            flowIdentifier: '../../../etc/passwd'
          }
        )
      ).rejects.toThrow('disallowed characters');
    });

    it('rejects flowIdentifier with shell metacharacters', async () => {
      await expect(
        service.handleVideoChunk(
          { size: 1024 },
          {
            ...validFlowParams,
            flowIdentifier: 'abc; rm -rf /'
          }
        )
      ).rejects.toThrow('disallowed characters');
    });

    it('rejects flowFilename with path traversal', async () => {
      await expect(
        service.handleVideoChunk(
          { size: 1024 },
          {
            ...validFlowParams,
            flowFilename: '../../evil.sh'
          }
        )
      ).rejects.toThrow('disallowed characters');
    });

    it('accepts valid flowIdentifier with alphanumeric, dots, dashes', async () => {
      mockChunkRepo.allChunksExist.mockResolvedValue(false);

      const result = await service.handleVideoChunk(
        { size: 1024 },
        { ...validFlowParams, flowIdentifier: 'file-2024_v1.0' }
      );

      expect(result.status).toBe('partly_done');
    });
  });

  describe('handleAudioChunk', () => {
    const validFlowParams = {
      flowChunkNumber: 1,
      flowChunkSize: 1024,
      flowTotalSize: 1024,
      flowIdentifier: 'audio123',
      flowFilename: 'track.mp3'
    };

    it('rejects flowIdentifier with special characters', async () => {
      await expect(
        service.handleAudioChunk(
          { size: 1024 },
          {
            ...validFlowParams,
            flowIdentifier: 'test$(whoami)'
          },
          'project-uuid'
        )
      ).rejects.toThrow('disallowed characters');
    });

    it('rejects missing flow parameters', async () => {
      await expect(service.handleAudioChunk({ size: 1024 }, {}, 'project-uuid')).rejects.toThrow(
        'Missing required flow parameters'
      );
    });
  });

  describe('assembleVideo', () => {
    it('creates project directories and assembles chunks', async () => {
      await service.assembleVideo('test-uuid', 'identifier123', 3);

      expect(mockFileRepo.ensureDir).toHaveBeenCalled();
      expect(mockChunkRepo.assembleChunks).toHaveBeenCalledWith(
        'identifier123',
        3,
        expect.anything()
      );
      expect(mockChunkRepo.cleanChunks).toHaveBeenCalledWith('identifier123');
    });
  });

  describe('getConversionStatus', () => {
    it('returns pending status when no data exists', async () => {
      mockFileRepo.readJson.mockResolvedValue(null);

      const result = await service.getConversionStatus('test-uuid');

      expect(result.conversionComplete).toBe(false);
      expect(result.thumbnailsComplete).toBe(false);
      expect(result.thumbnailsStatus).toBe('pending');
    });

    it('returns ready when conversion complete', async () => {
      mockFileRepo.readJson.mockResolvedValue({
        metadata: { status: 'ready', thumbnailsStatus: 'ready' }
      });

      const result = await service.getConversionStatus('test-uuid');

      expect(result.conversionComplete).toBe(true);
      expect(result.thumbnailsComplete).toBe(true);
    });

    it('returns not ready when conversion pending', async () => {
      mockFileRepo.readJson.mockResolvedValue({
        metadata: { status: 'pending' }
      });

      const result = await service.getConversionStatus('test-uuid');

      expect(result.conversionComplete).toBe(false);
      expect(result.thumbnailsStatus).toBe('pending');
    });
  });

  describe('convertVideo', () => {
    it('probes media and starts conversion', async () => {
      mockMediaRepo.probeMedia.mockResolvedValue({
        filename: 'test.mp4',
        format: { duration: 120 },
        streams: [{ codec_type: 'video', width: 1920, height: 1080, display_aspect_ratio: '16:9' }],
        metadata: { title: 'Test Video' }
      });
      mockFileRepo.readJson.mockResolvedValue(null);
      mockFileRepo.deleteDir = vi.fn();
      mockMediaRepo.generateThumbs = vi.fn();
      mockMediaRepo.convertVideo = vi.fn().mockResolvedValue();

      const result = await service.convertVideo('test-uuid');

      expect(result.status).toBe('started');
      expect(mockMediaRepo.probeMedia).toHaveBeenCalled();
    });
  });
});
