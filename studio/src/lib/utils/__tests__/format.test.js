import { describe, it, expect, vi } from 'vitest';
import {
  formatBytes,
  formatSampleRate,
  formatBitrate,
  formatDuration,
  buildMetaString,
  drawTimeOnCanvas
} from '../format.js';

describe('format utilities', () => {
  describe('formatBytes', () => {
    it('formats bytes correctly', () => {
      expect(formatBytes(500)).toBe('500 B');
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1048576)).toBe('1.0 MB');
      expect(formatBytes(1073741824)).toBe('1.00 GB');
    });

    it('returns empty string for falsy values', () => {
      expect(formatBytes(0)).toBe('');
      expect(formatBytes(null)).toBe('');
      expect(formatBytes(undefined)).toBe('');
    });
  });

  describe('formatSampleRate', () => {
    it('formats sample rate in kHz', () => {
      expect(formatSampleRate(44100)).toBe('44.1 kHz');
      expect(formatSampleRate(48000)).toBe('48.0 kHz');
      expect(formatSampleRate(96000)).toBe('96.0 kHz');
    });

    it('returns empty string for falsy values', () => {
      expect(formatSampleRate(0)).toBe('');
      expect(formatSampleRate(null)).toBe('');
    });

    it('handles valid rates', () => {
      expect(formatSampleRate(1000)).toBe('1.0 kHz');
    });
  });

  describe('formatBitrate', () => {
    it('formats bitrate in kbps (no conversion)', () => {
      expect(formatBitrate(128)).toBe('128 kbps');
      expect(formatBitrate(320)).toBe('320 kbps');
      expect(formatBitrate(256)).toBe('256 kbps');
    });

    it('returns empty string for falsy values', () => {
      expect(formatBitrate(0)).toBe('');
      expect(formatBitrate(null)).toBe('');
    });
  });

  describe('formatDuration', () => {
    it('formats duration as mm:ss.mmm (milliseconds)', () => {
      expect(formatDuration(0)).toBe('00:00.000');
      expect(formatDuration(1)).toBe('00:01.000');
      expect(formatDuration(60)).toBe('01:00.000');
      expect(formatDuration(61.5)).toBe('01:01.500');
      expect(formatDuration(125.789)).toBe('02:05.789');
    });

    it('wraps minutes at 60 (hours reset to minutes)', () => {
      expect(formatDuration(3661)).toBe('01:01.000');
    });

    it('handles fractional seconds with full millisecond precision', () => {
      expect(formatDuration(1.234)).toBe('00:01.234');
      expect(formatDuration(0.001)).toBe('00:00.001');
      expect(formatDuration(0.1)).toBe('00:00.100');
    });
  });

  describe('buildMetaString', () => {
    it('builds string with all metadata', () => {
      const result = buildMetaString({
        format: 'mp3',
        bitrate: 320,
        sampleRate: 44100,
        channelLayout: 'stereo',
        bitDepth: 16
      });

      expect(result).toBe('MP3 • 16-bit • 320 kbps • 44.1 kHz • stereo');
    });

    it('handles partial metadata', () => {
      const result = buildMetaString({
        format: 'wav',
        sampleRate: 48000
      });

      expect(result).toBe('WAV • 48.0 kHz');
    });

    it('derives channel layout from channels count', () => {
      expect(buildMetaString({ channels: 1 })).toBe('mono');
      expect(buildMetaString({ channels: 2 })).toBe('stereo');
      expect(buildMetaString({ channels: 6 })).toBe('6ch');
    });

    it('prefers channelLayout over derived channels', () => {
      const result = buildMetaString({
        channelLayout: '5.1',
        channels: 6
      });

      expect(result).toBe('5.1');
    });

    it('returns empty string for empty metadata', () => {
      expect(buildMetaString({})).toBe('');
    });

    it('handles null/undefined values', () => {
      const result = buildMetaString({
        format: null,
        bitrate: undefined,
        sampleRate: 44100
      });

      expect(result).toBe('44.1 kHz');
    });
  });

  describe('drawTimeOnCanvas', () => {
    it('draws formatted time on canvas', () => {
      const mockCtx = {
        clearRect: vi.fn(),
        fillText: vi.fn(),
        font: '',
        fillStyle: '',
        textAlign: '',
        textBaseline: ''
      };

      const mockCanvas = {
        getContext: vi.fn(() => mockCtx),
        width: 100,
        height: 30,
        parentElement: document.createElement('div')
      };

      drawTimeOnCanvas(mockCanvas, 65.5);

      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
      expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 100, 30);
      expect(mockCtx.fillText).toHaveBeenCalledWith('01:05.500', 50, 15);
      expect(mockCtx.textAlign).toBe('center');
      expect(mockCtx.textBaseline).toBe('middle');
    });
  });
});
