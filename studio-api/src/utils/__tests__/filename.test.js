const {
  parseFilename,
  generateUniqueFilename,
  generateStretchedFilename,
  getMimeType,
  getAudioMimeType,
  getVideoMimeType,
  getImageMimeType,
  sanitizeFilename,
  sanitizePath
} = require('../filename');

describe('parseFilename', () => {
  it('parses standard filename', () => {
    const result = parseFilename('track.mp3');
    expect(result).toEqual({ ext: '.mp3', baseName: 'track', extLower: 'mp3' });
  });

  it('handles uppercase extension', () => {
    const result = parseFilename('VIDEO.MP4');
    expect(result).toEqual({ ext: '.MP4', baseName: 'VIDEO', extLower: 'mp4' });
  });

  it('handles filename with dots', () => {
    const result = parseFilename('my.audio.file.wav');
    expect(result).toEqual({ ext: '.wav', baseName: 'my.audio.file', extLower: 'wav' });
  });

  it('handles filename without extension', () => {
    const result = parseFilename('noext');
    expect(result).toEqual({ ext: '', baseName: 'noext', extLower: '' });
  });
});

describe('generateUniqueFilename', () => {
  it('preserves extension', () => {
    const result = generateUniqueFilename('song.mp3');
    expect(result).toMatch(/^song-.*\.mp3$/);
  });

  it('includes suffix when provided', () => {
    const result = generateUniqueFilename('song.mp3', 'stretched');
    expect(result).toMatch(/^song-stretched-.*\.mp3$/);
  });

  it('generates unique names on each call', () => {
    const first = generateUniqueFilename('track.wav');
    const second = generateUniqueFilename('track.wav');
    expect(first).not.toBe(second);
  });
});

describe('generateStretchedFilename', () => {
  it('adds stretched suffix', () => {
    const result = generateStretchedFilename('audio.wav');
    expect(result).toMatch(/^audio-stretched-\d+\.wav$/);
  });
});

describe('getMimeType', () => {
  it('returns correct MIME for mp3', () => {
    expect(getMimeType('file.mp3')).toBe('audio/mpeg');
  });

  it('returns correct MIME for mp4', () => {
    expect(getMimeType('file.mp4')).toBe('video/mp4');
  });

  it('returns correct MIME for webp', () => {
    expect(getMimeType('file.webp')).toBe('image/webp');
  });

  it('returns default for unknown extension', () => {
    expect(getMimeType('file.xyz')).toBe('application/octet-stream');
  });

  it('accepts custom default', () => {
    expect(getMimeType('file.xyz', 'text/plain')).toBe('text/plain');
  });
});

describe('getAudioMimeType', () => {
  it('returns audio/mpeg for mp3', () => {
    expect(getAudioMimeType('file.mp3')).toBe('audio/mpeg');
  });

  it('returns audio/wav for wav', () => {
    expect(getAudioMimeType('file.wav')).toBe('audio/wav');
  });

  it('returns default audio/mpeg for unknown', () => {
    expect(getAudioMimeType('file.xyz')).toBe('audio/mpeg');
  });
});

describe('getVideoMimeType', () => {
  it('returns video/mp4 for mp4', () => {
    expect(getVideoMimeType('file.mp4')).toBe('video/mp4');
  });

  it('returns video/quicktime for mov', () => {
    expect(getVideoMimeType('file.mov')).toBe('video/quicktime');
  });

  it('returns default video/mp4 for unknown', () => {
    expect(getVideoMimeType('file.xyz')).toBe('video/mp4');
  });
});

describe('getImageMimeType', () => {
  it('returns image/webp for webp', () => {
    expect(getImageMimeType('file.webp')).toBe('image/webp');
  });

  it('returns image/jpeg for jpg', () => {
    expect(getImageMimeType('file.jpg')).toBe('image/jpeg');
  });

  it('returns default image/webp for unknown', () => {
    expect(getImageMimeType('file.xyz')).toBe('image/webp');
  });
});

describe('sanitizeFilename', () => {
  it('strips path traversal', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
  });

  it('strips query string', () => {
    expect(sanitizeFilename('file.mp3?t=123')).toBe('file.mp3');
  });

  it('strips hash fragment', () => {
    expect(sanitizeFilename('file.mp3#section')).toBe('file.mp3');
  });

  it('strips ampersand fragment', () => {
    expect(sanitizeFilename('file.mp3&t=123')).toBe('file.mp3');
  });

  it('preserves normal filename', () => {
    expect(sanitizeFilename('my-track.wav')).toBe('my-track.wav');
  });
});

describe('sanitizePath', () => {
  it('removes double-dot segments', () => {
    expect(sanitizePath('../../etc/passwd')).toBe('etc/passwd');
  });

  it('removes single-dot segments', () => {
    expect(sanitizePath('./folder/./file.txt')).toBe('folder/file.txt');
  });

  it('normalizes backslashes', () => {
    expect(sanitizePath('folder\\subfolder\\file.txt')).toBe('folder/subfolder/file.txt');
  });

  it('preserves valid path', () => {
    expect(sanitizePath('0.01/tile_0.webp')).toBe('0.01/tile_0.webp');
  });

  it('removes empty segments', () => {
    expect(sanitizePath('folder//file.txt')).toBe('folder/file.txt');
  });
});
