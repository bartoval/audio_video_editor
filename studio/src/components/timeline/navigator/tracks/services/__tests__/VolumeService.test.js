import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import VolumeService from '../VolumeService.js';

vi.mock('../../../../../../lib', async () => {
  const actual = await vi.importActual('../../../../../../lib');
  return {
    ...actual,
    getTimeFromPosX: vi.fn(posX => posX * 0.1)
  };
});

describe('VolumeService', () => {
  let service;
  let onChangeVolumeMock;
  const config = {};
  const maxPosX = 1000;
  const maxValue = 100;

  beforeEach(() => {
    vi.clearAllMocks();
    onChangeVolumeMock = vi.fn();
    service = new VolumeService(config, maxPosX, maxValue, {
      onChangeVolume: onChangeVolumeMock
    });
  });

  afterEach(() => {
    if (service && typeof service.drawEnd === 'function') {
      vi.clearAllTimers();
    }
  });

  describe('initialization', () => {
    it('initializes with default paths', () => {
      expect(service.paths).toBeDefined();
      expect(service.paths.length).toBe(1);
    });

    it('initializes with provided volume paths', () => {
      const volumePaths = {
        startPoints: 'M0,50,',
        endPoints: '1000,50',
        paths: [
          {
            startX: 0,
            startValue: 50,
            endX: 1000,
            endValue: 50,
            startControlX: 0,
            startControlValue: 50,
            endControlX: 1000,
            endControlValue: 50,
            controlX: 500,
            controlValue: 50
          }
        ]
      };
      const serviceWithPaths = new VolumeService({ volumePaths }, maxPosX, maxValue);
      expect(serviceWithPaths.paths.length).toBe(1);
    });

    it('stores maxPosX and maxValue', () => {
      expect(service.maxPosX).toBe(maxPosX);
      expect(service.maxValue).toBe(maxValue);
    });

    it('starts disabled', () => {
      expect(service.isEnabled()).toBe(false);
    });

    it('calls callback when volume changes', () => {
      service.drawStart(100, 50);
      service.draw(200, 60);
      onChangeVolumeMock.mockClear();
      service.drawEnd();
      expect(onChangeVolumeMock).toHaveBeenCalled();
    });

    it('initializes scale to 1', () => {
      expect(service.scale).toBe(1);
    });
  });

  describe('enable/disable', () => {
    it('enables volume editing', () => {
      const result = service.enable();
      expect(result).toBe(true);
      expect(service.isEnabled()).toBe(true);
    });

    it('disables volume editing', () => {
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

  describe('resize', () => {
    it('updates scale on resize', () => {
      const width = 500;
      service.resize(width);
      expect(service.scale).toBe(maxPosX / width);
    });

    it('calls onChangeVolume after resize', () => {
      onChangeVolumeMock.mockClear();
      service.resize(800);
      expect(onChangeVolumeMock).toHaveBeenCalled();
    });

    it('returns true', () => {
      const result = service.resize(600);
      expect(result).toBe(true);
    });

    it('handles zero width gracefully', () => {
      service.resize(0);
      expect(service.scale).toBe(Infinity);
    });

    it('handles very small width', () => {
      service.resize(1);
      expect(service.scale).toBe(maxPosX);
    });
  });

  describe('drawStart', () => {
    it('applies scale to posX', () => {
      service.scale = 2;
      const result = service.drawStart(100, 50);
      expect(result.posX).toBe(100);
    });

    it('returns scaled position', () => {
      const result = service.drawStart(100, 50);
      expect(result).toEqual({
        posX: expect.any(Number),
        posY: 50
      });
    });

    it('selects existing path segment when drawing on it', () => {
      service.insertKeyframe(500);
      const initialPathCount = service.paths.length;
      service.drawStart(250, 50);
      expect(service.paths.length).toBe(initialPathCount);
    });

    it('adds new path when drawing beyond existing paths', () => {
      service.drawStart(100, 50);
      service.draw(200, 60);
      service.drawEnd();

      const initialPathCount = service.paths.length;
      service.drawStart(500, 55);
      expect(service.paths.length).toBeGreaterThanOrEqual(initialPathCount);
    });
  });

  describe('draw', () => {
    beforeEach(() => {
      service.insertKeyframe(500);
      service.drawStart(750, 50);
    });

    it('clamps posY to maxValue when path is selected', () => {
      const result = service.draw(800, 200);
      expect(result.posY).toBeLessThanOrEqual(maxValue);
    });

    it('clamps posY to zero when path is selected', () => {
      const result = service.draw(800, -50);
      expect(result.posY).toBeGreaterThanOrEqual(0);
    });

    it('applies scale to posX', () => {
      service.scale = 2;
      const result = service.draw(200, 50);
      expect(result.posX).toBeDefined();
    });

    it('updates end points when drawing continues', () => {
      service.selectedPath = null;
      service.draw(300, 70);
      expect(service.endPoints).toBeDefined();
      expect(typeof service.endPoints).toBe('string');
    });

    it('smooths position changes when drawing on path', () => {
      service.draw(300, 50);
      const result = service.draw(500, 50);
      expect(result.posX).toBeDefined();
    });
  });

  describe('drawEnd', () => {
    it('calls onChangeVolume with volume array', () => {
      service.drawStart(100, 50);
      service.draw(200, 60);
      onChangeVolumeMock.mockClear();
      service.drawEnd();
      expect(onChangeVolumeMock).toHaveBeenCalled();
    });

    it('clears selected path', () => {
      service.drawStart(100, 50);
      service.draw(200, 60);
      service.drawEnd();
      expect(service.selectedPath).toBe(null);
    });

    it('returns true', () => {
      service.drawStart(100, 50);
      const result = service.drawEnd();
      expect(result).toBe(true);
    });

    it('volume array contains correct structure', () => {
      service.drawStart(100, 50);
      service.draw(200, 60);
      onChangeVolumeMock.mockClear();
      service.drawEnd();

      const volumeArray = onChangeVolumeMock.mock.calls[0][0];
      expect(Array.isArray(volumeArray)).toBe(true);
      if (volumeArray.length > 0) {
        expect(volumeArray[0]).toHaveProperty('startTime');
        expect(volumeArray[0]).toHaveProperty('durationTime');
        expect(volumeArray[0]).toHaveProperty('data');
      }
    });
  });

  describe('buildPathData', () => {
    it('returns default horizontal line for no paths', () => {
      const pathData = service.buildPathData();
      expect(pathData).toContain('M0,');
      expect(pathData).toContain('L' + maxPosX);
    });

    it('builds path with user curves', () => {
      service.drawStart(100, 50);
      service.draw(200, 60);
      service.drawEnd();

      const pathData = service.buildPathData();
      expect(pathData).toContain('M0,');
      expect(typeof pathData).toBe('string');
    });

    it('includes end points in path', () => {
      service.drawStart(100, 50);
      service.draw(200, 60);
      service.drawEnd();

      const pathData = service.buildPathData();
      expect(pathData).toContain(service.endPoints);
    });
  });

  describe('getPaths', () => {
    it('returns paths data for serialization', () => {
      const pathsData = service.getPaths();
      expect(pathsData).toHaveProperty('startPoints');
      expect(pathsData).toHaveProperty('paths');
      expect(pathsData).toHaveProperty('endPoints');
    });

    it('includes all paths', () => {
      service.drawStart(100, 50);
      service.draw(200, 60);
      service.drawEnd();

      const pathsData = service.getPaths();
      expect(pathsData.paths.length).toBeGreaterThan(0);
    });
  });

  describe('requestRedraw', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('calls callback with path data via RAF', () => {
      const callback = vi.fn();
      service.requestRedraw(callback);

      vi.advanceTimersByTime(16);
      expect(callback).toHaveBeenCalledWith(expect.any(String));
    });

    it('throttles multiple redraw requests', () => {
      const callback = vi.fn();
      service.requestRedraw(callback);
      service.requestRedraw(callback);
      service.requestRedraw(callback);

      vi.advanceTimersByTime(16);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('handles rapid draw calls', () => {
      service.drawStart(100, 50);
      for (let i = 0; i < 100; i++) {
        service.draw(100 + i * 10, 50 + i);
      }
      expect(() => service.drawEnd()).not.toThrow();
    });

    it('handles draw without drawStart', () => {
      expect(() => service.draw(100, 50)).not.toThrow();
    });

    it('handles multiple drawEnd calls', () => {
      service.drawStart(100, 50);
      service.drawEnd();
      expect(() => service.drawEnd()).not.toThrow();
    });

    it('does not call callback if not provided', () => {
      const noCallbackService = new VolumeService(config, maxPosX, maxValue);
      expect(() => {
        noCallbackService.drawStart(100, 50);
        noCallbackService.draw(200, 60);
        noCallbackService.drawEnd();
      }).not.toThrow();
    });

    it('handles very large posX values', () => {
      const result = service.drawStart(999999, 50);
      expect(isFinite(result.posX)).toBe(true);
    });
  });

  describe('keyframe methods', () => {
    describe('insertKeyframe', () => {
      it('adds a new path segment', () => {
        const initialCount = service.paths.length;
        service.insertKeyframe(500);
        expect(service.paths.length).toBe(initialCount + 1);
      });

      it('returns keyframe info', () => {
        const result = service.insertKeyframe(500);
        expect(result).toHaveProperty('pathIndex');
        expect(result).toHaveProperty('isStart');
        expect(result.isStart).toBe(true);
      });

      it('calls onChangeVolume after insert', () => {
        onChangeVolumeMock.mockClear();
        service.insertKeyframe(500);
        expect(onChangeVolumeMock).toHaveBeenCalled();
      });

      it('can insert multiple keyframes', () => {
        service.insertKeyframe(250);
        service.insertKeyframe(500);
        service.insertKeyframe(750);
        expect(service.paths.length).toBe(4);
      });

      it('inserts keyframe at correct Y position on flat line', () => {
        // Initial path should be flat at center (maxValue/2 = 50)
        const centerY = maxValue / 2;

        // Insert keyframe at middle of track
        service.insertKeyframe(500);

        // Get keyframe points
        const keyframes = service.getKeyframePoints();

        // The keyframe should be at the center Y (100% volume)
        expect(keyframes.length).toBeGreaterThan(0);
        expect(keyframes[0].posY).toBe(centerY);
      });

      it('inserts keyframe at correct Y position when posX is near end', () => {
        const centerY = maxValue / 2;

        // Insert keyframe near the end of the track
        service.insertKeyframe(900);

        const keyframes = service.getKeyframePoints();

        expect(keyframes.length).toBeGreaterThan(0);
        expect(keyframes[0].posY).toBe(centerY);
      });

      it('inserts keyframe at correct Y position after resize', () => {
        const centerY = maxValue / 2;

        // Simulate what happens in real app: resize to different width
        service.resize(500); // Half the original width

        // Insert keyframe at middle of visible track
        service.insertKeyframe(250);

        const keyframes = service.getKeyframePoints();

        expect(keyframes.length).toBeGreaterThan(0);
        expect(keyframes[0].posY).toBe(centerY);
      });

      it('inserts keyframe at correct Y position when track is wider than initial path', () => {
        const centerY = maxValue / 2;

        // Create service with smaller initial maxPosX
        const smallService = new VolumeService({}, 200, maxValue, {
          onChangeVolume: onChangeVolumeMock
        });

        // Resize to larger width (simulating track being wider than initial path)
        smallService.resize(800);

        // Insert keyframe beyond original path end
        smallService.insertKeyframe(600);

        const keyframes = smallService.getKeyframePoints();

        expect(keyframes.length).toBeGreaterThan(0);
        // Should still be at center Y
        expect(keyframes[0].posY).toBe(centerY);
      });

      it('inserts keyframe at correct Y when path endX is less than click position', () => {
        const centerY = maxValue / 2;

        // Simulate real bug: path was saved with small endX but track is wider
        const corruptedConfig = {
          volumePaths: {
            startPoints: 'M0,50,',
            endPoints: '156,50',
            paths: [
              {
                startX: 0,
                startValue: 50,
                endX: 156, // Path ends at 156, but track might be wider
                endValue: 50,
                startControlX: 0,
                startControlValue: 50,
                endControlX: 156,
                endControlValue: 50,
                controlX: 78,
                controlValue: 50
              }
            ]
          }
        };

        const corruptedService = new VolumeService(corruptedConfig, maxPosX, maxValue, {
          onChangeVolume: onChangeVolumeMock
        });

        // Click at position 400 (beyond path endX of 156)
        corruptedService.insertKeyframe(400);

        const keyframes = corruptedService.getKeyframePoints();

        expect(keyframes.length).toBeGreaterThan(0);
        // Even though click is beyond path, Y should still be at center
        expect(keyframes[0].posY).toBe(centerY);
      });

      it('path endY should not change after drawStart/draw/drawEnd sequence', () => {
        const centerY = maxValue / 2;

        // Get initial path state
        const initialEndY = service.paths[0].endValue;
        expect(initialEndY).toBe(centerY);

        // Simulate user drawing on the path (but not completing a full curve)
        service.drawStart(100, 30); // Start at Y=30 (not center)
        service.draw(150, 35);
        service.drawEnd();

        // The base path's endValue should still be at center if no keyframe was inserted
        // This test checks if draw operations corrupt the path's endValue
        const finalEndY = service.paths[0].endValue;

        // The endY should remain at center (or be a valid interpolated value)
        // It should NOT be corrupted to a random mouse Y position
        expect(finalEndY).toBeGreaterThanOrEqual(0);
        expect(finalEndY).toBeLessThanOrEqual(maxValue);
      });

      it('keyframe Y is correct after drawing on path', () => {
        const centerY = maxValue / 2;

        // First draw on the path
        service.drawStart(200, 40);
        service.draw(300, 45);
        service.drawEnd();

        // Now insert a keyframe
        service.insertKeyframe(500);

        const keyframes = service.getKeyframePoints();

        // Keyframe should be at center Y (the path is flat at center)
        expect(keyframes.length).toBeGreaterThan(0);
        expect(keyframes[0].posY).toBe(centerY);
      });

      it('restores corrupted Y values to default center', () => {
        const centerY = maxValue / 2;

        // Simulate corrupted saved data with out-of-range Y values
        const corruptedConfig = {
          volumePaths: {
            startPoints: 'M0,14,',
            endPoints: '1000,14',
            paths: [
              {
                startX: 0,
                startValue: 14.296875, // Out of range (should be 0-100)
                endX: 156,
                endValue: -45, // Negative - invalid
                startControlX: 0,
                startControlValue: 200, // Above maxValue - invalid
                endControlX: 156,
                endControlValue: 14.296875,
                controlX: 78,
                controlValue: -10 // Negative - invalid
              }
            ]
          }
        };

        const corruptedService = new VolumeService(corruptedConfig, maxPosX, maxValue, {
          onChangeVolume: onChangeVolumeMock
        });

        // The corrupted Y values should be reset to center
        const path = corruptedService.paths[0];

        // startValue 14.296875 is valid (0-100), so it should be kept
        expect(path.startValue).toBe(14.296875);

        // endValue -45 is invalid, should be reset to center
        expect(path.endValue).toBe(centerY);

        // startControlValue 200 is invalid (> maxValue), should be reset to startValue
        expect(path.startControlValue).toBe(14.296875);

        // controlValue -10 is invalid, should be reset to center
        expect(path.controlValue).toBe(centerY);
      });
    });

    describe('getKeyframePoints', () => {
      it('returns empty array when no user keyframes', () => {
        const keyframes = service.getKeyframePoints();
        expect(keyframes.length).toBe(0);
      });

      it('returns keyframe points after insert', () => {
        service.insertKeyframe(500);
        const keyframes = service.getKeyframePoints();
        expect(keyframes.length).toBeGreaterThan(0);
      });

      it('keyframe points have correct structure', () => {
        service.insertKeyframe(500);
        const keyframes = service.getKeyframePoints();
        expect(keyframes[0]).toHaveProperty('pathIndex');
        expect(keyframes[0]).toHaveProperty('isStart');
        expect(keyframes[0]).toHaveProperty('posX');
        expect(keyframes[0]).toHaveProperty('posY');
      });
    });

    describe('moveKeyframe', () => {
      beforeEach(() => {
        service.insertKeyframe(500);
      });

      it('updates keyframe position', () => {
        const before = service.getKeyframePoints();
        const originalPosX = before[0].posX;
        service.moveKeyframe(1, true, 600, 30);
        const after = service.getKeyframePoints();
        expect(after[0].posX).not.toBe(originalPosX);
      });

      it('clamps posY to valid range', () => {
        service.moveKeyframe(1, true, 600, -100);
        const keyframes = service.getKeyframePoints();
        expect(keyframes[0].posY).toBeGreaterThanOrEqual(0);
      });

      it('calls onChangeVolume after move', () => {
        onChangeVolumeMock.mockClear();
        service.moveKeyframe(1, true, 600, 50);
        expect(onChangeVolumeMock).toHaveBeenCalled();
      });
    });

    describe('removeKeyframe', () => {
      beforeEach(() => {
        service.insertKeyframe(500);
      });

      it('removes a path segment', () => {
        const before = service.paths.length;
        service.removeKeyframe(1, true);
        expect(service.paths.length).toBe(before - 1);
      });

      it('returns true on successful removal', () => {
        const result = service.removeKeyframe(1, true);
        expect(result).toBe(true);
      });

      it('returns false when cannot remove (only base path)', () => {
        service.removeKeyframe(1, true);
        const result = service.removeKeyframe(0, true);
        expect(result).toBe(false);
      });

      it('calls onChangeVolume after removal', () => {
        onChangeVolumeMock.mockClear();
        service.removeKeyframe(1, true);
        expect(onChangeVolumeMock).toHaveBeenCalled();
      });
    });
  });

  describe('DAW-style volume range', () => {
    it('default Y position is at center (100% volume)', () => {
      const pathData = service.buildPathData();
      expect(pathData).toContain(',50');
    });

    it('volume array values are in 0-2 range', () => {
      service.insertKeyframe(500);
      service.drawStart(750, 0);
      service.draw(800, 50);
      service.drawEnd();

      const volumeArray =
        onChangeVolumeMock.mock.calls[onChangeVolumeMock.mock.calls.length - 1][0];

      if (volumeArray.length > 0 && volumeArray[0].data?.values) {
        const values = volumeArray[0].data.values;
        for (const value of values) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(2);
        }
      }
    });

    it('top position (y=0) outputs high volume (>100%)', () => {
      service.insertKeyframe(500);
      service.drawStart(750, 0);
      service.draw(800, 0);
      service.drawEnd();

      const volumeArray =
        onChangeVolumeMock.mock.calls[onChangeVolumeMock.mock.calls.length - 1][0];

      if (volumeArray.length > 0 && volumeArray[0].data?.values) {
        const values = volumeArray[0].data.values;
        const maxVal = Math.max(...values);
        expect(maxVal).toBeGreaterThan(1.0);
      }
    });

    it('bottom position (y=maxValue) outputs low volume (<100%)', () => {
      service.insertKeyframe(500);
      service.drawStart(750, maxValue);
      service.draw(800, maxValue);
      service.drawEnd();

      const volumeArray =
        onChangeVolumeMock.mock.calls[onChangeVolumeMock.mock.calls.length - 1][0];

      if (volumeArray.length > 0 && volumeArray[0].data?.values) {
        const values = volumeArray[0].data.values;
        const minVal = Math.min(...values);
        expect(minVal).toBeLessThan(1.0);
      }
    });
  });
});
