vi.mock('../../config', () => ({
  ffmpeg: {
    hwEncoder: null,
    presets: {
      cpu: { preset: 'veryfast', crf: 28 },
      nvenc: { preset: 'p4', cq: 28 }
    }
  }
}));

vi.mock('../logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}));

const {
  calculateAspectRatio,
  isWebCompatibleCodec,
  runFfmpeg,
  getEncoderConfig
} = require('../ffmpeg');

describe('calculateAspectRatio', () => {
  it('returns 16:9 for standard widescreen', () => {
    expect(calculateAspectRatio(1920, 1080)).toBe('16:9');
  });

  it('returns 16:9 for 1280x720', () => {
    expect(calculateAspectRatio(1280, 720)).toBe('16:9');
  });

  it('returns 4:3 for standard', () => {
    expect(calculateAspectRatio(640, 480)).toBe('4:3');
  });

  it('returns 21:9 for ultrawide', () => {
    expect(calculateAspectRatio(2560, 1080)).toBe('21:9');
  });

  it('returns raw ratio for non-standard', () => {
    expect(calculateAspectRatio(500, 300)).toBe('500:300');
  });

  it('returns null when width is 0', () => {
    expect(calculateAspectRatio(0, 1080)).toBeNull();
  });

  it('returns null when height is 0', () => {
    expect(calculateAspectRatio(1920, 0)).toBeNull();
  });

  it('returns null for undefined dimensions', () => {
    expect(calculateAspectRatio(undefined, undefined)).toBeNull();
  });
});

describe('isWebCompatibleCodec', () => {
  it('returns true for h264', () => {
    expect(isWebCompatibleCodec('h264')).toBe(true);
  });

  it('returns true for vp9', () => {
    expect(isWebCompatibleCodec('vp9')).toBe(true);
  });

  it('returns true for av1', () => {
    expect(isWebCompatibleCodec('av1')).toBe(true);
  });

  it('returns true case-insensitive', () => {
    expect(isWebCompatibleCodec('H264')).toBe(true);
  });

  it('returns false for hevc', () => {
    expect(isWebCompatibleCodec('hevc')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isWebCompatibleCodec(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isWebCompatibleCodec(undefined)).toBe(false);
  });
});

describe('getEncoderConfig', () => {
  it('returns CPU encoder config by default', () => {
    const config = getEncoderConfig();

    expect(config.codec).toBe('libx264');
    expect(config.options).toEqual(
      expect.arrayContaining([expect.stringContaining('-preset'), expect.stringContaining('-crf')])
    );
  });

  it('returns options array', () => {
    const config = getEncoderConfig();

    expect(Array.isArray(config.options)).toBe(true);
    expect(config.options.length).toBeGreaterThan(0);
  });
});

describe('runFfmpeg', () => {
  it('resolves on end event', async () => {
    const handlers = {};
    const mockCommand = {
      on: vi.fn((event, handler) => {
        handlers[event] = handler;

        return mockCommand;
      }),
      run: vi.fn(() => {
        handlers.end();
      })
    };

    await expect(runFfmpeg(mockCommand)).resolves.toBeUndefined();
    expect(mockCommand.run).toHaveBeenCalled();
  });

  it('rejects on error event', async () => {
    const handlers = {};
    const mockCommand = {
      on: vi.fn((event, handler) => {
        handlers[event] = handler;

        return mockCommand;
      }),
      run: vi.fn(() => {
        handlers.error(new Error('FFmpeg failed'));
      })
    };

    await expect(runFfmpeg(mockCommand)).rejects.toThrow('FFmpeg failed');
  });
});
