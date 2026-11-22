import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../AudioProcessor', () => ({ default: { stretch: vi.fn() } }));
vi.mock('../../BufferCache', () => ({
  default: { addRef: vi.fn(), get: vi.fn(), set: vi.fn() }
}));
vi.mock('../../utils/BufferUtils', () => ({ crop: buffer => buffer }));
vi.mock('../BufferLoader', () => ({ default: class {} }));

import AudioProcessor from '../../AudioProcessor';
import Buffer from '../Buffer';

const PEAKS = { sampleRate: 48000, length: 480000, bucket: 256, data: new Float32Array(4) };
const FULL_FILE = { duration: 10, label: 'decoded file' };

const createLoader = (peaks = PEAKS) => ({
  loadFromCache: vi.fn().mockResolvedValue(FULL_FILE),
  isNetworkAvailable: () => false,
  fetchAndDecode: vi.fn(),
  saveToCache: vi.fn(),
  loadPeaks: vi.fn().mockResolvedValue(peaks),
  savePeaks: vi.fn().mockResolvedValue(peaks)
});

describe('Buffer waveform peaks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the file peaks and the cropped range for a buffer loaded from a file', async () => {
    const loader = createLoader();
    const buffer = new Buffer({ idTrack: 'song.mp3', start: 2, end: 6, loader });

    await expect(buffer.getPeaks()).resolves.toEqual({ peaks: PEAKS, start: 2, end: 6 });
    expect(loader.loadPeaks).toHaveBeenCalledWith('song.mp3');
  });

  it('uses the whole file when there is no crop', async () => {
    const buffer = new Buffer({ idTrack: 'song.mp3', loader: createLoader() });

    await expect(buffer.getPeaks()).resolves.toMatchObject({ start: -1, end: -1 });
  });

  it('stores the peaks of the whole decoded file after loading it', async () => {
    const loader = createLoader();
    const buffer = new Buffer({ idTrack: 'song.mp3', start: 2, end: 6, loader });

    await buffer.get();

    expect(loader.savePeaks).toHaveBeenCalledWith('song.mp3', FULL_FILE);
  });

  it('has no file peaks for a buffer that came from memory (clone)', async () => {
    const loader = createLoader();
    const buffer = new Buffer({
      idTrack: 'song.mp3',
      start: 0,
      end: 3,
      buffer: Promise.resolve(FULL_FILE),
      loader
    });

    await expect(buffer.getPeaks()).resolves.toBeNull();
    expect(loader.loadPeaks).not.toHaveBeenCalled();
  });

  it('stops using the original peaks after a stretch and stores the derived ones', async () => {
    const loader = createLoader();
    const buffer = new Buffer({ idTrack: 'song.mp3', loader });
    const stretched = { duration: 20, label: 'stretched' };
    AudioProcessor.stretch.mockResolvedValueOnce({
      buffer: stretched,
      duration: 20,
      derivedId: 'song-s2_0.wav'
    });

    await buffer.stretch('song.mp3', 2);

    await expect(buffer.getPeaks()).resolves.toBeNull();
    expect(loader.savePeaks).toHaveBeenCalledWith('song-s2_0.wav', stretched);
  });

  it('returns null when the file has no stored peaks yet', async () => {
    const buffer = new Buffer({ idTrack: 'song.mp3', loader: createLoader(null) });

    await expect(buffer.getPeaks()).resolves.toBeNull();
  });
});
