import { describe, it, expect, vi, beforeEach } from 'vitest';
import PanService from '../PanService.js';

describe('PanService', () => {
  let service;
  let onChangePanMock;
  const config = { panValue: 0 };
  const maxPosY = 100;

  beforeEach(() => {
    onChangePanMock = vi.fn();
    service = new PanService(config, maxPosY, {
      onChangePan: onChangePanMock
    });
  });

  describe('initialization', () => {
    it('initializes with config pan value', () => {
      const serviceWithPan = new PanService({ panValue: 0.5 }, maxPosY);
      expect(serviceWithPan.gain).toBe(0.5);
    });

    it('initializes with default pan value', () => {
      const serviceDefault = new PanService({}, maxPosY);
      expect(serviceDefault.gain).toBe(0);
    });

    it('stores maxPosY correctly', () => {
      expect(service.maxPosY).toBe(maxPosY);
    });

    it('starts disabled', () => {
      expect(service.isEnabled()).toBe(false);
    });

    it('calls callback when value changes', () => {
      service.setValueStart(50, 50);
      expect(onChangePanMock).toHaveBeenCalled();
    });
  });

  describe('enable/disable', () => {
    it('enables pan editing', () => {
      const result = service.enable();
      expect(result).toBe(true);
      expect(service.isEnabled()).toBe(true);
    });

    it('disables pan editing', () => {
      service.enable();
      const result = service.disable();
      expect(result).toBe(true);
      expect(service.isEnabled()).toBe(false);
    });

    it('can toggle enable/disable multiple times', () => {
      service.enable();
      expect(service.isEnabled()).toBe(true);
      service.disable();
      expect(service.isEnabled()).toBe(false);
      service.enable();
      expect(service.isEnabled()).toBe(true);
    });
  });

  describe('setValueStart', () => {
    it('clamps posY to maxPosY', () => {
      const result = service.setValueStart(50, 150);
      expect(result.posY).toBe(maxPosY);
    });

    it('clamps posY to minPosY', () => {
      const result = service.setValueStart(50, -10);
      expect(result.posY).toBe(0);
    });

    it('calculates gain from posY (center)', () => {
      const result = service.setValueStart(50, 50);
      expect(result.gain).toBe(0);
    });

    it('calculates gain from posY (top)', () => {
      const result = service.setValueStart(50, 0);
      expect(result.gain).toBe(-1);
    });

    it('calculates gain from posY (bottom)', () => {
      const result = service.setValueStart(50, 100);
      expect(result.gain).toBe(1);
    });

    it('stores posX and posY', () => {
      service.setValueStart(75, 25);
      expect(service.posX).toBe(75);
      expect(service.posY).toBe(25);
    });

    it('returns posX, posY, and gain', () => {
      const result = service.setValueStart(60, 40);
      expect(result).toEqual({
        posX: 60,
        posY: 40,
        gain: expect.any(Number)
      });
    });
  });

  describe('setValue', () => {
    it('updates gain during drag', () => {
      service.setValueStart(50, 50);
      const result = service.setValue(60, 75);
      expect(result.gain).toBeCloseTo(0.5, 1);
    });

    it('clamps posY during drag', () => {
      const result = service.setValue(50, 200);
      expect(result.posY).toBe(maxPosY);
    });

    it('updates stored position', () => {
      service.setValue(80, 30);
      expect(service.posX).toBe(80);
      expect(service.posY).toBe(30);
    });

    it('handles rapid position updates', () => {
      service.setValue(10, 10);
      service.setValue(20, 20);
      service.setValue(30, 30);
      expect(service.posX).toBe(30);
      expect(service.posY).toBe(30);
    });
  });

  describe('setValueEnd', () => {
    it('calls onChangePan callback with final gain', () => {
      service.setValueStart(50, 60);
      service.setValueEnd();
      expect(onChangePanMock).toHaveBeenCalledWith(service.gain);
    });

    it('calls callback only once on end', () => {
      service.setValueStart(50, 60);
      service.setValue(50, 70);
      service.setValue(50, 80);
      onChangePanMock.mockClear();
      service.setValueEnd();
      expect(onChangePanMock).toHaveBeenCalledTimes(1);
    });

    it('returns true', () => {
      service.setValueStart(50, 50);
      const result = service.setValueEnd();
      expect(result).toBe(true);
    });
  });

  describe('getInitialPosY', () => {
    it('calculates correct posY from gain (center)', () => {
      service.gain = 0;
      const posY = service.getInitialPosY();
      expect(posY).toBe(50);
    });

    it('calculates correct posY from gain (top)', () => {
      service.gain = -1;
      const posY = service.getInitialPosY();
      expect(posY).toBe(0);
    });

    it('calculates correct posY from gain (bottom)', () => {
      service.gain = 1;
      const posY = service.getInitialPosY();
      expect(posY).toBe(100);
    });

    it('round-trips gain -> posY -> gain', () => {
      const originalGain = 0.5;
      service.gain = originalGain;
      const posY = service.getInitialPosY();
      const calculatedGain = (posY * 2) / maxPosY - 1;
      expect(calculatedGain).toBeCloseTo(originalGain, 10);
    });
  });

  describe('edge cases', () => {
    it('handles zero maxPosY gracefully', () => {
      const zeroService = new PanService(config, 0);
      const result = zeroService.setValueStart(50, 50);
      expect(isNaN(result.gain)).toBe(true);
    });

    it('handles negative posX', () => {
      const result = service.setValueStart(-10, 50);
      expect(result.posX).toBe(-10);
    });

    it('handles very large posX', () => {
      const result = service.setValueStart(99999, 50);
      expect(result.posX).toBe(99999);
    });

    it('does not call callback if not provided', () => {
      const noCallbackService = new PanService(config, maxPosY);
      expect(() => {
        noCallbackService.setValueStart(50, 50);
        noCallbackService.setValueEnd();
      }).not.toThrow();
    });
  });
});
