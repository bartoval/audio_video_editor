vi.mock('fluent-ffmpeg', () => {
  const ffprobe = vi.fn();
  const ffmpegInstance = {
    seekInput: vi.fn().mockReturnThis(),
    duration: vi.fn().mockReturnThis(),
    outputOptions: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    videoCodec: vi.fn().mockReturnThis(),
    noAudio: vi.fn().mockReturnThis(),
    size: vi.fn().mockReturnThis(),
    frames: vi.fn().mockReturnThis(),
    audioCodec: vi.fn().mockReturnThis(),
    audioFrequency: vi.fn().mockReturnThis(),
    audioChannels: vi.fn().mockReturnThis(),
    audioBitrate: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    run: vi.fn()
  };
  const fn = vi.fn(() => ffmpegInstance);
  fn.ffprobe = ffprobe;

  return { default: fn, __esModule: true, ...fn };
});

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
  ffmpeg: { webpQuality: 80, smallVideoHeight: 155, hwEncoder: null },
  thumbTiles: { cols: 10, rows: 10, height: 80 },
  paths: {
    ext: { thumb: '.webp' },
    thumbScales: [{ fps: 1, scale: '0.02' }],
    fileNames: { videoOriginal: 'original.mp4', videoSmall: 'small.mp4' },
    subDirs: { videoTracks: 'videoTracks', audioTracks: 'audioTracks' }
  }
}));

const mockFileRepo = {
  ensureDir: vi.fn().mockResolvedValue(undefined),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  writeJson: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(false)
};

const { mediaRepositoryCreator } = require('../mediaRepository');

describe('mediaRepository (facade)', () => {
  let mediaRepo;

  beforeEach(() => {
    vi.clearAllMocks();
    mediaRepo = mediaRepositoryCreator({
      fileRepo: mockFileRepo,
      execFile: vi.fn()
    });
  });

  it('exposes all expected functions', () => {
    const expectedMethods = [
      'probeMedia',
      'getVideoDuration',
      'extractFrame',
      'generateThumbs',
      'convertVideo',
      'stretchAudio',
      'convertAudioFormat',
      'exportVideo',
      'exportAudio'
    ];

    for (const method of expectedMethods) {
      expect(typeof mediaRepo[method]).toBe('function');
    }
  });

  it('returns exactly the expected number of methods', () => {
    expect(Object.keys(mediaRepo)).toHaveLength(9);
  });
});
