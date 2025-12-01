import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Volume from '../Volume.js';

describe('Volume', () => {
  let volume;
  let mockGainNode;

  beforeEach(() => {
    mockGainNode = {
      gain: {
        value: 1,
        setValueCurveAtTime: vi.fn(),
        cancelScheduledValues: vi.fn()
      },
      connect: vi.fn(),
      disconnect: vi.fn()
    };

    window.audioContextInstance = {
      createGain: vi.fn(() => mockGainNode)
    };

    volume = new Volume();
  });

  afterEach(() => {
    delete window.audioContextInstance;
  });

  describe('initialization', () => {
    it('initializes with default value of 1.0 (100% in DAW-style)', () => {
      expect(volume.defaultValue).toBe(1.0);
    });

    it('starts with null node', () => {
      expect(volume.getNode()).toBe(null);
    });

    it('starts with empty volume data', () => {
      expect(volume.getVolumeData()).toEqual([]);
    });

    it('starts with master gain of 1', () => {
      expect(volume.getMasterGain()).toBe(1);
    });

    it('accepts config with volumeData', () => {
      const volumeData = [{ startTime: 0, durationTime: 1, data: {} }];
      const vol = new Volume({ volumeData });
      expect(vol.getVolumeData()).toEqual(volumeData);
    });

    it('accepts config with gain', () => {
      const vol = new Volume({ gain: 0.5 });
      expect(vol.getMasterGain()).toBe(0.5);
    });
  });

  describe('node management', () => {
    it('creates gain node', () => {
      const result = volume.createNode();
      expect(result).toBe(true);
      expect(window.audioContextInstance.createGain).toHaveBeenCalled();
      expect(volume.getNode()).toBe(mockGainNode);
    });

    it('removes gain node', () => {
      volume.createNode();
      const result = volume.removeNode();
      expect(result).toBe(true);
      expect(volume.getNode()).toBe(null);
    });

    it('connects to destination', () => {
      volume.createNode();
      const destination = {};
      const result = volume.connectNode(destination);
      expect(result).toBe(true);
      expect(mockGainNode.connect).toHaveBeenCalledWith(destination);
    });

    it('disconnects from destination', () => {
      volume.createNode();
      const result = volume.disconnectNode('dest');
      expect(result).toBe(true);
      expect(mockGainNode.disconnect).toHaveBeenCalledWith('dest');
    });
  });

  describe('setVolumeData', () => {
    it('stores volume data', () => {
      const volumeData = [
        { startTime: 0, durationTime: 1, data: { values: [1, 0.5], times: [0, 0.5] } }
      ];
      volume.setVolumeData(volumeData);
      expect(volume.getVolumeData().length).toBe(1);
    });

    it('returns true', () => {
      const result = volume.setVolumeData([]);
      expect(result).toBe(true);
    });

    it('applies gain when node exists', () => {
      volume.createNode();
      const volumeData = [
        { startTime: 0, durationTime: 1, data: { values: [1, 0.5], times: [0, 0.5] } }
      ];
      volume.setVolumeData(volumeData);
      expect(mockGainNode.gain.cancelScheduledValues).toHaveBeenCalled();
    });
  });

  describe('setMasterGain', () => {
    it('stores master gain value', () => {
      volume.setMasterGain(1.5);
      expect(volume.getMasterGain()).toBe(1.5);
    });

    it('updates node gain when node exists', () => {
      volume.createNode();
      volume.setMasterGain(1.5);
      expect(mockGainNode.gain.value).toBe(1.5);
    });

    it('multiplies defaultValue by masterGain', () => {
      volume.createNode();
      volume.setMasterGain(2);
      expect(mockGainNode.gain.value).toBe(2);
    });
  });

  describe('setGain', () => {
    beforeEach(() => {
      volume.createNode();
    });

    it('returns true', () => {
      const result = volume.setGain(0, 0);
      expect(result).toBe(true);
    });

    it('sets default value when no volume data', () => {
      volume.setGain(0, 0);
      expect(mockGainNode.gain.value).toBe(1.0);
    });

    it('applies volume curve when data exists', () => {
      const volumeData = [
        {
          startTime: 0,
          durationTime: 1,
          data: { values: new Float32Array([1, 0.5, 0.8]), times: [0, 0.5, 1] }
        }
      ];
      volume.setVolumeData(volumeData, 0, 0);
      expect(mockGainNode.gain.setValueCurveAtTime).toHaveBeenCalled();
    });
  });
});
