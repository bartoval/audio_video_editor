import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../AudioProcessor', () => ({ default: { stretch: vi.fn() } }));
vi.mock('../../BufferCache', () => ({ default: { addRef: vi.fn(), get: vi.fn() } }));
vi.mock('../../utils/BufferUtils', () => ({ crop: buffer => buffer }));
vi.mock('../BufferLoader', () => ({ default: class {} }));

import AudioProcessor from '../../AudioProcessor';
import Buffer from '../Buffer';

/** A promise we resolve by hand, to finish stretches in any order */
const deferred = () => {
  let resolve;
  const promise = new Promise(r => (resolve = r));

  return { promise, resolve };
};

describe('Buffer.stretch with overlapping requests', () => {
  let buffer;

  beforeEach(() => {
    vi.clearAllMocks();
    const original = { duration: 10 };
    buffer = new Buffer({
      idTrack: 'track-1',
      startTimeBuffer: 0,
      endTimeBuffer: 10,
      start: -1,
      end: -1,
      buffer: Promise.resolve(original)
    });
  });

  it('keeps the latest request when an older one finishes last', async () => {
    const slow = deferred();
    const fast = deferred();
    AudioProcessor.stretch.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);

    const first = buffer.stretch('track-1', 0.9); // e.g. slider at 110%
    const second = buffer.stretch('track-1', 0.67); // released at 150%

    fast.resolve({ buffer: 'stretched-0.67', duration: 6.7, derivedId: 'd-067' });
    await expect(second).resolves.toBe(true);

    // The old, slow result arrives afterwards: it must not overwrite the new one
    slow.resolve({ buffer: 'stretched-0.9', duration: 9, derivedId: 'd-09' });
    await expect(first).resolves.toBe(false);

    await expect(buffer.get()).resolves.toBe('stretched-0.67');
    expect(buffer.duration).toBe(6.7);
    expect(buffer.derivedId).toBe('d-067');
    expect(buffer.stretchFactor).toBe(0.67);
  });

  it('applies a single request normally', async () => {
    AudioProcessor.stretch.mockResolvedValueOnce({
      buffer: 'stretched',
      duration: 5,
      derivedId: 'd'
    });

    await expect(buffer.stretch('track-1', 0.5)).resolves.toBe(true);
    await expect(buffer.get()).resolves.toBe('stretched');
  });
});
