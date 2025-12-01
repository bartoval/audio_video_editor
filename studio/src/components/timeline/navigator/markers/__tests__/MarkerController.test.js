import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MarkerController from '../MarkerController';

vi.mock('../../../../../lib', () => ({
  getTimeFromPosX: vi.fn(posX => posX / 10),
  getPosXFromTime: vi.fn(time => time * 10),
  generateUuid: vi.fn(() => 'test-uuid-' + Math.random().toString(36).slice(2, 9))
}));

vi.mock('../../../../../services/SnappingService', () => ({
  default: {
    snap: vi.fn(posX => posX),
    registerSnapPoints: vi.fn(),
    clearSnapPoints: vi.fn()
  }
}));

vi.mock('../view', () => ({
  createMarkerLayer: vi.fn(() => ({
    el: {
      getBoundingClientRect: () => ({ left: 0 })
    },
    bind: vi.fn(),
    setState: vi.fn(),
    destroy: vi.fn()
  }))
}));

describe('MarkerController', () => {
  let controller;
  let $parent;
  let mockCallbacks;
  let mockRuler;

  beforeEach(() => {
    $parent = document.createElement('div');
    mockCallbacks = {
      onMove: vi.fn(),
      onScrubberMove: vi.fn(),
      onAdd: vi.fn(),
      onEdit: vi.fn(),
      onRemove: vi.fn(),
      onSelect: vi.fn()
    };
    mockRuler = {
      getPosX: vi.fn().mockReturnValue(0),
      getAbsolutePosX: vi.fn().mockReturnValue(100),
      getRange: vi.fn().mockReturnValue({ width: 500 })
    };

    controller = new MarkerController($parent, mockCallbacks);
    controller.init([], mockRuler);
  });

  afterEach(() => {
    controller?.destroy();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('initializes with empty markers', () => {
      expect(controller.count()).toBe(0);
    });

    it('initializes with existing markers', () => {
      const markers = [
        { id: 'marker-1', time: 5, label: 'First' },
        { id: 'marker-2', time: 10, label: 'Second' }
      ];

      controller.init(markers, mockRuler);

      expect(controller.count()).toBe(2);
    });

    it('returns true on successful init', () => {
      const result = controller.init([], mockRuler);

      expect(result).toBe(true);
    });
  });

  describe('add', () => {
    it('adds a marker and triggers callback', () => {
      const config = { id: 'test-marker', time: 5, label: 'Test Marker' };

      const marker = controller.add(config);

      expect(marker).toBeTruthy();
      expect(controller.count()).toBe(1);
      expect(mockCallbacks.onAdd).toHaveBeenCalled();
    });
  });

  describe('addAt', () => {
    it('adds marker at position', () => {
      const marker = controller.addAt(50);

      expect(marker).toBeTruthy();
      expect(controller.count()).toBe(1);
    });

    it('prevents duplicate markers at same time', () => {
      controller.addAt(50);
      const duplicate = controller.addAt(50);

      expect(duplicate).toBeNull();
      expect(controller.count()).toBe(1);
    });

    it('increments marker counter for labels', () => {
      controller.addAt(50);
      controller.addAt(100);

      const markers = controller.getMarkers();

      expect(markers[0].getLabel()).toBe('Marker 1');
      expect(markers[1].getLabel()).toBe('Marker 2');
    });
  });

  describe('addAtPlayhead', () => {
    it('adds marker at current playhead position', () => {
      mockRuler.getAbsolutePosX.mockReturnValue(150);

      const marker = controller.addAtPlayhead();

      expect(marker).toBeTruthy();
      expect(mockRuler.getAbsolutePosX).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('removes existing marker', () => {
      const marker = controller.addAt(50);
      const markerId = marker.getId();

      const result = controller.remove(markerId);

      expect(result).toBe(true);
      expect(controller.count()).toBe(0);
      expect(mockCallbacks.onRemove).toHaveBeenCalledWith({ id: markerId });
    });

    it('returns false for non-existent marker', () => {
      const result = controller.remove('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('edit', () => {
    it('edits marker time', () => {
      const marker = controller.addAt(50);
      const markerId = marker.getId();

      const result = controller.edit(markerId, { time: 15 });

      expect(result).toBe(true);
      expect(marker.getTime()).toBe(15);
      expect(mockCallbacks.onEdit).toHaveBeenCalled();
    });

    it('edits marker label', () => {
      const marker = controller.addAt(50);
      const markerId = marker.getId();

      controller.edit(markerId, { label: 'New Label' });

      expect(marker.getLabel()).toBe('New Label');
    });

    it('returns false for non-existent marker', () => {
      const result = controller.edit('non-existent', { time: 10 });

      expect(result).toBe(false);
    });
  });

  describe('select', () => {
    it('selects marker and triggers callback', () => {
      const marker = controller.addAt(50);
      const markerId = marker.getId();

      const selected = controller.select(markerId);

      expect(selected).toBe(marker);
      expect(mockCallbacks.onSelect).toHaveBeenCalled();
    });

    it('returns null for non-existent marker', () => {
      const selected = controller.select('non-existent');

      expect(selected).toBeNull();
    });

    it('moves scrubber when marker is in viewport', () => {
      const marker = controller.addAt(50);

      controller.select(marker.getId());

      expect(mockCallbacks.onScrubberMove).toHaveBeenCalled();
    });

    it('moves viewport when marker is outside', () => {
      mockRuler.getPosX.mockReturnValue(1000);

      const marker = controller.addAt(50);
      controller.select(marker.getId());

      expect(mockCallbacks.onMove).toHaveBeenCalled();
    });
  });

  describe('goToPrevious', () => {
    beforeEach(() => {
      controller.add({ id: 'm1', time: 5, label: 'M1' });
      controller.add({ id: 'm2', time: 10, label: 'M2' });
      controller.add({ id: 'm3', time: 15, label: 'M3' });
    });

    it('returns null when no markers exist', () => {
      controller.init([], mockRuler);

      const result = controller.goToPrevious(10);

      expect(result).toBeNull();
    });

    it('navigates to previous marker from current time', () => {
      const result = controller.goToPrevious(12);

      expect(result.getTime()).toBe(10);
    });

    it('navigates to previous when marker is selected', () => {
      controller.select('m3');

      const result = controller.goToPrevious(15);

      expect(result.getTime()).toBe(10);
    });

    it('returns null at first marker', () => {
      controller.select('m1');

      const result = controller.goToPrevious(5);

      expect(result).toBeNull();
    });
  });

  describe('goToNext', () => {
    beforeEach(() => {
      controller.add({ id: 'm1', time: 5, label: 'M1' });
      controller.add({ id: 'm2', time: 10, label: 'M2' });
      controller.add({ id: 'm3', time: 15, label: 'M3' });
    });

    it('returns null when no markers exist', () => {
      controller.init([], mockRuler);

      const result = controller.goToNext(10);

      expect(result).toBeNull();
    });

    it('navigates to next marker from current time', () => {
      const result = controller.goToNext(7);

      expect(result.getTime()).toBe(10);
    });

    it('navigates to next when marker is selected', () => {
      controller.select('m1');

      const result = controller.goToNext(5);

      expect(result.getTime()).toBe(10);
    });

    it('returns null at last marker', () => {
      controller.select('m3');

      const result = controller.goToNext(15);

      expect(result).toBeNull();
    });
  });

  describe('getLoopBounds', () => {
    it('returns null with less than 2 markers', () => {
      controller.addAt(50);

      expect(controller.getLoopBounds()).toBeNull();
    });

    it('returns bounds from first two markers', () => {
      controller.add({ id: 'm1', time: 5, label: 'Start' });
      controller.add({ id: 'm2', time: 15, label: 'End' });

      const bounds = controller.getLoopBounds();

      expect(bounds).toEqual({ start: 5, end: 15 });
    });
  });

  describe('clampToDuration', () => {
    it('clamps markers that exceed duration', () => {
      controller.add({ id: 'm1', time: 5, label: 'M1' });
      controller.add({ id: 'm2', time: 20, label: 'M2' });

      controller.clampToDuration(10);

      const markers = controller.getMarkers();

      expect(markers[0].getTime()).toBe(5);
      expect(markers[1].getTime()).toBe(10);
    });
  });

  describe('moveTo', () => {
    it('updates view translate', () => {
      const result = controller.moveTo(100);

      expect(result).toBe(true);
      expect(controller.view.setState).toHaveBeenCalledWith({ translateX: -100 });
    });
  });

  describe('updateFrame', () => {
    it('updates view during playback', () => {
      const result = controller.updateFrame(50);

      expect(result).toBe(true);
      expect(controller.view.setState).toHaveBeenCalledWith({ translateX: -50 });
    });

    it('returns false for invalid position', () => {
      const result = controller.updateFrame(0);

      expect(result).toBe(false);
    });
  });

  describe('export', () => {
    it('exports markers as JSON', () => {
      controller.add({ id: 'm1', time: 5, label: 'M1', type: 'user' });

      const exported = controller.export();

      expect(exported).toHaveLength(1);
      expect(exported[0].id).toBe('m1');
      expect(exported[0].time).toBe(5);
    });
  });

  describe('destroy', () => {
    it('cleans up resources', () => {
      controller.destroy();

      expect(controller.view.destroy).toHaveBeenCalled();
    });
  });
});
