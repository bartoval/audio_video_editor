import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../services/api', () => ({
  getAudioList: vi.fn().mockResolvedValue({}),
  deleteAudioLibraryItem: vi.fn().mockResolvedValue({ status: 'deleted' })
}));

vi.mock('../../../services/workspace', () => ({
  getUuid: () => '0',
  getTrackUrl: vi.fn(id => `/audio/${id}`),
  getDerivedTrackUrl: vi.fn(id => `/audio/derived/${id}`)
}));

import LibraryModel from '../LibraryModel';

describe('LibraryModel events', () => {
  it('emits removed when deleteItem is called', async () => {
    const model = new LibraryModel();
    // Mock API call
    const removeSpy = vi.spyOn(model, 'removeItem').mockImplementation(() => {});
    // Stub deleteAudioLibraryItem
    vi.mock('../../../services/api', () => ({
      getAudioList: vi.fn().mockResolvedValue({}),
      deleteAudioLibraryItem: vi.fn().mockResolvedValue({ status: 'deleted' })
    }));

    const cb = vi.fn();
    model.on('removed', cb);
    await model.deleteItem('test-id');

    expect(removeSpy).toHaveBeenCalledWith('test-id');
    expect(cb).toHaveBeenCalledWith({ id: 'test-id' });
  });
});
