import { describe, it, expect, vi, beforeEach } from 'vitest';
import timelineStore from '../timelineStore.js';

describe('timelineStore', () => {
  const createMockTrack = (id = '1', overrides = {}) => ({
    id,
    idTrack: `track-${id}`,
    label: `Track ${id}`,
    startTime: 0,
    durationTime: 10,
    ...overrides
  });

  beforeEach(() => {
    timelineStore.actions.clear();
  });

  describe('initial state', () => {
    it('has correct initial state', () => {
      const state = timelineStore.getState();

      expect(state.tracks).toEqual([]);
      expect(state.selection).toBeNull();
      expect(state.thumbs).toEqual({
        loading: false,
        progress: 0,
        scale: '0.1',
        status: 'pending',
        scalesReady: []
      });
    });
  });

  describe('setTracks', () => {
    it('sets all tracks (replaces existing)', () => {
      const tracks = [createMockTrack('1'), createMockTrack('2')];

      timelineStore.actions.setTracks(tracks);

      expect(timelineStore.getState().tracks).toEqual(tracks);
      expect(timelineStore.getState().tracks).toHaveLength(2);
    });

    it('creates new array reference', () => {
      const tracks = [createMockTrack('1')];
      timelineStore.actions.setTracks(tracks);

      expect(timelineStore.getState().tracks).not.toBe(tracks);
    });

    it('replaces previous tracks', () => {
      timelineStore.actions.setTracks([createMockTrack('1'), createMockTrack('2')]);
      timelineStore.actions.setTracks([createMockTrack('3')]);

      expect(timelineStore.getState().tracks).toHaveLength(1);
      expect(timelineStore.getState().tracks[0].id).toBe('3');
    });
  });

  describe('addTracks', () => {
    it('adds tracks to existing list', () => {
      timelineStore.actions.setTracks([createMockTrack('1')]);
      timelineStore.actions.addTracks([createMockTrack('2'), createMockTrack('3')]);

      expect(timelineStore.getState().tracks).toHaveLength(3);
    });

    it('preserves existing tracks', () => {
      const track1 = createMockTrack('1');
      timelineStore.actions.setTracks([track1]);
      timelineStore.actions.addTracks([createMockTrack('2')]);

      expect(timelineStore.getState().tracks[0]).toEqual(track1);
    });

    it('handles empty array', () => {
      timelineStore.actions.setTracks([createMockTrack('1')]);
      timelineStore.actions.addTracks([]);

      expect(timelineStore.getState().tracks).toHaveLength(1);
    });
  });

  describe('updateTrack', () => {
    beforeEach(() => {
      timelineStore.actions.setTracks([
        createMockTrack('1', { label: 'Track 1' }),
        createMockTrack('2', { label: 'Track 2' })
      ]);
    });

    it('updates specific track', () => {
      timelineStore.actions.updateTrack('1', { label: 'Updated Track 1' });

      const tracks = timelineStore.getState().tracks;
      expect(tracks[0].label).toBe('Updated Track 1');
      expect(tracks[1].label).toBe('Track 2');
    });

    it('merges patch with existing track', () => {
      timelineStore.actions.updateTrack('1', { startTime: 5 });

      const track = timelineStore.getState().tracks[0];
      expect(track.startTime).toBe(5);
      expect(track.label).toBe('Track 1');
      expect(track.durationTime).toBe(10);
    });

    it('does nothing if track not found', () => {
      const originalTracks = timelineStore.getState().tracks;
      timelineStore.actions.updateTrack('999', { label: 'Non-existent' });

      expect(timelineStore.getState().tracks).toEqual(originalTracks);
    });

    it('creates new track object (immutability)', () => {
      const originalTrack = timelineStore.getState().tracks[0];
      timelineStore.actions.updateTrack('1', { label: 'Updated' });

      expect(timelineStore.getState().tracks[0]).not.toBe(originalTrack);
    });
  });

  describe('removeTrack', () => {
    beforeEach(() => {
      timelineStore.actions.setTracks([
        createMockTrack('1'),
        createMockTrack('2'),
        createMockTrack('3')
      ]);
    });

    it('removes track by id', () => {
      timelineStore.actions.removeTrack('2');

      const tracks = timelineStore.getState().tracks;
      expect(tracks).toHaveLength(2);
      expect(tracks.find(track => track.id === '2')).toBeUndefined();
    });

    it('clears selection if removed track was selected', () => {
      timelineStore.actions.setSelection('2');
      timelineStore.actions.removeTrack('2');

      expect(timelineStore.getState().selection).toBeNull();
    });

    it('preserves selection if different track removed', () => {
      timelineStore.actions.setSelection('1');
      timelineStore.actions.removeTrack('2');

      expect(timelineStore.getState().selection).toBe('1');
    });

    it('does nothing if track not found', () => {
      const originalLength = timelineStore.getState().tracks.length;
      timelineStore.actions.removeTrack('999');

      expect(timelineStore.getState().tracks).toHaveLength(originalLength);
    });
  });

  describe('setSelection', () => {
    beforeEach(() => {
      timelineStore.actions.setTracks([createMockTrack('1'), createMockTrack('2')]);
    });

    it('sets selected track id', () => {
      timelineStore.actions.setSelection('1');
      expect(timelineStore.getState().selection).toBe('1');
    });

    it('changes selection', () => {
      timelineStore.actions.setSelection('1');
      timelineStore.actions.setSelection('2');
      expect(timelineStore.getState().selection).toBe('2');
    });

    it('clears selection with null', () => {
      timelineStore.actions.setSelection('1');
      timelineStore.actions.setSelection(null);
      expect(timelineStore.getState().selection).toBeNull();
    });
  });

  describe('thumbs loading', () => {
    it('sets loading state', () => {
      timelineStore.actions.setThumbsLoading(true);
      expect(timelineStore.getState().thumbs.loading).toBe(true);

      timelineStore.actions.setThumbsLoading(false);
      expect(timelineStore.getState().thumbs.loading).toBe(false);
    });

    it('preserves other thumbs state', () => {
      timelineStore.actions.setThumbsProgress({ percent: 50, scale: '0.2' });
      timelineStore.actions.setThumbsLoading(true);

      const thumbs = timelineStore.getState().thumbs;
      expect(thumbs.loading).toBe(true);
      expect(thumbs.progress).toBe(50);
      expect(thumbs.scale).toBe('0.2');
    });
  });

  describe('thumbs progress', () => {
    it('sets progress percentage', () => {
      timelineStore.actions.setThumbsProgress({ percent: 75 });
      expect(timelineStore.getState().thumbs.progress).toBe(75);
    });

    it('sets progress and scale', () => {
      timelineStore.actions.setThumbsProgress({ percent: 50, scale: '0.05' });

      const thumbs = timelineStore.getState().thumbs;
      expect(thumbs.progress).toBe(50);
      expect(thumbs.scale).toBe('0.05');
    });

    it('updates only progress if scale not provided', () => {
      timelineStore.actions.setThumbsScale('0.2');
      timelineStore.actions.setThumbsProgress({ percent: 100 });

      const thumbs = timelineStore.getState().thumbs;
      expect(thumbs.progress).toBe(100);
      expect(thumbs.scale).toBe('0.2');
    });
  });

  describe('thumbs scale', () => {
    it('sets thumbs scale/zoom', () => {
      timelineStore.actions.setThumbsScale('0.05');
      expect(timelineStore.getState().thumbs.scale).toBe('0.05');
    });

    it('preserves other thumbs state', () => {
      timelineStore.actions.setThumbsLoading(true);
      timelineStore.actions.setThumbsProgress({ percent: 50 });
      timelineStore.actions.setThumbsScale('0.2');

      const thumbs = timelineStore.getState().thumbs;
      expect(thumbs.loading).toBe(true);
      expect(thumbs.progress).toBe(50);
      expect(thumbs.scale).toBe('0.2');
    });
  });

  describe('clear', () => {
    it('clears tracks and selection', () => {
      timelineStore.actions.setTracks([createMockTrack('1'), createMockTrack('2')]);
      timelineStore.actions.setSelection('1');
      timelineStore.actions.setThumbsLoading(true);
      timelineStore.actions.setThumbsProgress({ percent: 50 });

      timelineStore.actions.clear();

      const state = timelineStore.getState();
      expect(state.tracks).toEqual([]);
      expect(state.selection).toBeNull();
      expect(state.thumbs.loading).toBe(false);
      expect(state.thumbs.progress).toBe(0);
    });

    it('preserves thumbs scale on clear', () => {
      timelineStore.actions.setThumbsScale('0.2');
      timelineStore.actions.clear();

      expect(timelineStore.getState().thumbs.scale).toBe('0.2');
    });
  });

  describe('subscriptions', () => {
    it('notifies subscribers on state changes', () => {
      const callback = vi.fn();
      timelineStore.subscribe(callback);

      timelineStore.actions.setTracks([createMockTrack('1')]);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          tracks: expect.arrayContaining([expect.objectContaining({ id: '1' })])
        })
      );
    });

    it('notifies even if selection value same (store always notifies)', () => {
      const callback = vi.fn();
      timelineStore.subscribe(callback);

      timelineStore.actions.setSelection('1');
      expect(callback).toHaveBeenCalledTimes(1);

      timelineStore.actions.setSelection('1');
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });
});
