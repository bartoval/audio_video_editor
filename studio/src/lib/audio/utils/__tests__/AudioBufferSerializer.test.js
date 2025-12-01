import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  serializeAudioBuffer,
  deserializeAudioBuffer,
  blobToAudioBuffer,
  audioBufferToWavBlob
} from '../AudioBufferSerializer';
import * as BufferUtils from '../BufferUtils';

// Mock BufferUtils
vi.mock('../BufferUtils', () => ({
  extractChannels: vi.fn(),
  createFromChannels: vi.fn(),
  decode: vi.fn()
}));

describe('AudioBufferSerializer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('serializeAudioBuffer', () => {
    it('should return null for null input', () => {
      expect(serializeAudioBuffer(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(serializeAudioBuffer(undefined)).toBeNull();
    });

    it('should serialize AudioBuffer properties', () => {
      const mockChannels = [new Float32Array([1, 2, 3]), new Float32Array([4, 5, 6])];
      BufferUtils.extractChannels.mockReturnValue(mockChannels);

      const mockAudioBuffer = {
        sampleRate: 44100,
        length: 3,
        numberOfChannels: 2,
        duration: 0.068
      };

      const result = serializeAudioBuffer(mockAudioBuffer);

      expect(result).toEqual({
        sampleRate: 44100,
        length: 3,
        numberOfChannels: 2,
        duration: 0.068,
        channels: mockChannels
      });
      expect(BufferUtils.extractChannels).toHaveBeenCalledWith(mockAudioBuffer);
    });
  });

  describe('deserializeAudioBuffer', () => {
    it('should return null for null input', () => {
      expect(deserializeAudioBuffer(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(deserializeAudioBuffer(undefined)).toBeNull();
    });

    it('should return null for missing channels', () => {
      expect(deserializeAudioBuffer({ length: 100, sampleRate: 44100 })).toBeNull();
    });

    it('should return null for missing length', () => {
      expect(deserializeAudioBuffer({ channels: [], sampleRate: 44100 })).toBeNull();
    });

    it('should return null for missing sampleRate', () => {
      expect(deserializeAudioBuffer({ channels: [], length: 100 })).toBeNull();
    });

    it('should throw when no AudioContext available', () => {
      const data = {
        channels: [new Float32Array([1, 2, 3])],
        length: 3,
        sampleRate: 44100
      };

      // Remove global audioContextInstance
      const originalInstance = window.audioContextInstance;
      window.audioContextInstance = undefined;

      expect(() => deserializeAudioBuffer(data)).toThrow('No AudioContext available');

      window.audioContextInstance = originalInstance;
    });

    it('should use provided AudioContext', () => {
      const mockBuffer = { duration: 1 };
      BufferUtils.createFromChannels.mockReturnValue(mockBuffer);

      const mockContext = { createBuffer: vi.fn() };
      const data = {
        channels: [new Float32Array([1, 2, 3])],
        length: 3,
        sampleRate: 44100
      };

      const result = deserializeAudioBuffer(data, mockContext);

      expect(result).toBe(mockBuffer);
      expect(BufferUtils.createFromChannels).toHaveBeenCalledWith(
        data.channels,
        data.length,
        data.sampleRate
      );
    });

    it('should use global audioContextInstance when no context provided', () => {
      const mockBuffer = { duration: 1 };
      BufferUtils.createFromChannels.mockReturnValue(mockBuffer);

      window.audioContextInstance = { createBuffer: vi.fn() };
      const data = {
        channels: [new Float32Array([1, 2, 3])],
        length: 3,
        sampleRate: 44100
      };

      const result = deserializeAudioBuffer(data);

      expect(result).toBe(mockBuffer);
    });
  });

  describe('blobToAudioBuffer', () => {
    it('should return null for null input', async () => {
      const result = await blobToAudioBuffer(null);

      expect(result).toBeNull();
    });

    it('should return null for undefined input', async () => {
      const result = await blobToAudioBuffer(undefined);

      expect(result).toBeNull();
    });

    it('should decode blob to AudioBuffer', async () => {
      const mockBuffer = { duration: 1 };
      const mockArrayBuffer = new ArrayBuffer(10);
      BufferUtils.decode.mockResolvedValue(mockBuffer);

      const mockBlob = {
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer)
      };

      const result = await blobToAudioBuffer(mockBlob);

      expect(mockBlob.arrayBuffer).toHaveBeenCalled();
      expect(BufferUtils.decode).toHaveBeenCalledWith(mockArrayBuffer);
      expect(result).toBe(mockBuffer);
    });
  });

  describe('audioBufferToWavBlob', () => {
    it('should return null for null input', () => {
      expect(audioBufferToWavBlob(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(audioBufferToWavBlob(undefined)).toBeNull();
    });

    it('should create WAV blob from mono AudioBuffer', () => {
      const channelData = new Float32Array([0, 0.5, -0.5, 1, -1]);
      const mockAudioBuffer = {
        numberOfChannels: 1,
        sampleRate: 44100,
        length: 5,
        getChannelData: vi.fn().mockReturnValue(channelData)
      };

      const result = audioBufferToWavBlob(mockAudioBuffer);

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('audio/wav');
      // WAV header (44 bytes) + 5 samples * 2 bytes = 54 bytes
      expect(result.size).toBe(54);
    });

    it('should create WAV blob from stereo AudioBuffer', () => {
      const leftChannel = new Float32Array([0, 0.5, -0.5]);
      const rightChannel = new Float32Array([0.25, -0.25, 0.75]);
      const mockAudioBuffer = {
        numberOfChannels: 2,
        sampleRate: 48000,
        length: 3,
        getChannelData: vi.fn(channel => (channel === 0 ? leftChannel : rightChannel))
      };

      const result = audioBufferToWavBlob(mockAudioBuffer);

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('audio/wav');
      // WAV header (44 bytes) + 3 samples * 2 channels * 2 bytes = 56 bytes
      expect(result.size).toBe(56);
      expect(mockAudioBuffer.getChannelData).toHaveBeenCalledWith(0);
      expect(mockAudioBuffer.getChannelData).toHaveBeenCalledWith(1);
    });

    it('should clamp values outside -1 to 1 range', () => {
      // Values > 1 or < -1 should be clamped
      const channelData = new Float32Array([2, -2, 0]);
      const mockAudioBuffer = {
        numberOfChannels: 1,
        sampleRate: 44100,
        length: 3,
        getChannelData: vi.fn().mockReturnValue(channelData)
      };

      // Should not throw
      const result = audioBufferToWavBlob(mockAudioBuffer);

      expect(result).toBeInstanceOf(Blob);
    });
  });
});
