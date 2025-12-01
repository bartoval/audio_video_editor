import { describe, it, expect, vi, beforeEach } from 'vitest';
import workspaceStore from '../workspaceStore.js';

describe('workspaceStore', () => {
  beforeEach(() => {
    workspaceStore.actions.reset();
  });

  describe('initial state', () => {
    it('has correct initial state', () => {
      const state = workspaceStore.getState();

      expect(state.uuid).toBe('0');
      expect(state.videoUrl).toBeNull();
      expect(state.videoMeta).toBeNull();
      expect(state.cacheBuster).toBeGreaterThan(0);
      expect(state.config).toEqual({ thumbs: null, bpm: 120, timeSignature: '4/4', fps: null });
    });
  });

  describe('loadWorkspace', () => {
    it('loads workspace data', () => {
      const workspaceData = {
        uuid: 'workspace-123',
        video: {
          url: '/video.mp4',
          meta: { duration: 60, width: 1920, height: 1080 }
        },
        config: {
          thumbs: { scales: ['0.1', '0.2'] }
        }
      };

      workspaceStore.actions.loadWorkspace(workspaceData);

      const state = workspaceStore.getState();
      expect(state.uuid).toBe('workspace-123');
      expect(state.videoUrl).toBe('/video.mp4');
      expect(state.videoMeta).toEqual({ duration: 60, width: 1920, height: 1080 });
      expect(state.config.thumbs).toEqual({ scales: ['0.1', '0.2'] });
    });

    it('handles partial workspace data', () => {
      workspaceStore.actions.loadWorkspace({ uuid: 'test-uuid' });

      const state = workspaceStore.getState();
      expect(state.uuid).toBe('test-uuid');
      expect(state.videoUrl).toBeNull();
      expect(state.videoMeta).toBeNull();
    });

    it('preserves uuid if not provided', () => {
      workspaceStore.actions.setUuid('existing-uuid');
      workspaceStore.actions.loadWorkspace({ video: { url: '/video.mp4' } });

      expect(workspaceStore.getState().uuid).toBe('existing-uuid');
    });

    it('updates cacheBuster on load', () => {
      const oldCacheBuster = workspaceStore.getState().cacheBuster;

      vi.useFakeTimers();
      vi.advanceTimersByTime(1000);

      workspaceStore.actions.loadWorkspace({ uuid: 'test' });

      expect(workspaceStore.getState().cacheBuster).toBeGreaterThan(oldCacheBuster);

      vi.useRealTimers();
    });
  });

  describe('setUuid', () => {
    it('sets workspace UUID', () => {
      workspaceStore.actions.setUuid('new-uuid-456');
      expect(workspaceStore.getState().uuid).toBe('new-uuid-456');
    });

    it('overwrites existing UUID', () => {
      workspaceStore.actions.setUuid('first-uuid');
      workspaceStore.actions.setUuid('second-uuid');
      expect(workspaceStore.getState().uuid).toBe('second-uuid');
    });
  });

  describe('setVideo', () => {
    it('sets video URL and metadata', () => {
      const meta = { duration: 120, width: 1280, height: 720, format: 'mp4' };

      workspaceStore.actions.setVideo('/new-video.mp4', meta);

      const state = workspaceStore.getState();
      expect(state.videoUrl).toBe('/new-video.mp4');
      expect(state.videoMeta).toEqual(meta);
    });

    it('sets video URL without metadata', () => {
      workspaceStore.actions.setVideo('/video.mp4');

      expect(workspaceStore.getState().videoUrl).toBe('/video.mp4');
      expect(workspaceStore.getState().videoMeta).toBeNull();
    });

    it('updates cacheBuster', () => {
      const oldCacheBuster = workspaceStore.getState().cacheBuster;

      vi.useFakeTimers();
      vi.advanceTimersByTime(100);

      workspaceStore.actions.setVideo('/video.mp4');

      expect(workspaceStore.getState().cacheBuster).toBeGreaterThan(oldCacheBuster);

      vi.useRealTimers();
    });
  });

  describe('clearVideo', () => {
    it('clears video URL and metadata', () => {
      workspaceStore.actions.setVideo('/video.mp4', { duration: 60 });
      workspaceStore.actions.clearVideo();

      const state = workspaceStore.getState();
      expect(state.videoUrl).toBeNull();
      expect(state.videoMeta).toBeNull();
    });

    it('preserves other state', () => {
      workspaceStore.actions.setUuid('test-uuid');
      workspaceStore.actions.setConfig({ thumbs: { scale: '0.1' } });
      workspaceStore.actions.clearVideo();

      const state = workspaceStore.getState();
      expect(state.uuid).toBe('test-uuid');
      expect(state.config.thumbs).toEqual({ scale: '0.1' });
    });
  });

  describe('setConfig', () => {
    it('sets configuration', () => {
      const config = {
        thumbs: { scales: ['0.1', '0.2', '0.5'] }
      };

      workspaceStore.actions.setConfig(config);

      expect(workspaceStore.getState().config.thumbs).toEqual(config.thumbs);
    });

    it('merges with existing config', () => {
      workspaceStore.actions.setConfig({ thumbs: { scale: '0.1' } });
      workspaceStore.actions.setConfig({ other: 'value' });

      const config = workspaceStore.getState().config;
      expect(config.thumbs).toEqual({ scale: '0.1' });
      expect(config.other).toBe('value');
    });

    it('updates nested config properties', () => {
      workspaceStore.actions.setConfig({ thumbs: { scale: '0.1' } });
      workspaceStore.actions.setConfig({ thumbs: { format: 'jpg' } });

      expect(workspaceStore.getState().config.thumbs).toEqual({ format: 'jpg' });
    });
  });

  describe('invalidateCache', () => {
    it('updates cacheBuster timestamp', () => {
      const oldCacheBuster = workspaceStore.getState().cacheBuster;

      vi.useFakeTimers();
      vi.advanceTimersByTime(1000);

      workspaceStore.actions.invalidateCache();

      expect(workspaceStore.getState().cacheBuster).toBeGreaterThan(oldCacheBuster);

      vi.useRealTimers();
    });

    it('preserves other state', () => {
      workspaceStore.actions.setUuid('test-uuid');
      workspaceStore.actions.setVideo('/video.mp4');
      workspaceStore.actions.invalidateCache();

      const state = workspaceStore.getState();
      expect(state.uuid).toBe('test-uuid');
      expect(state.videoUrl).toBe('/video.mp4');
    });
  });

  describe('reset', () => {
    it('resets workspace to default', () => {
      workspaceStore.actions.setUuid('test-uuid');
      workspaceStore.actions.setVideo('/video.mp4', { duration: 60 });
      workspaceStore.actions.reset();

      const state = workspaceStore.getState();
      expect(state.uuid).toBe('0');
      expect(state.videoUrl).toBeNull();
      expect(state.videoMeta).toBeNull();
    });

    it('preserves backend thumbs config on reset', () => {
      workspaceStore.actions.setConfig({ thumbs: { backend: 'config' } });
      workspaceStore.actions.reset();

      expect(workspaceStore.getState().config.thumbs).toEqual({ backend: 'config' });
    });

    it('updates cacheBuster on reset', () => {
      const oldCacheBuster = workspaceStore.getState().cacheBuster;

      vi.useFakeTimers();
      vi.advanceTimersByTime(500);

      workspaceStore.actions.reset();

      expect(workspaceStore.getState().cacheBuster).toBeGreaterThan(oldCacheBuster);

      vi.useRealTimers();
    });
  });

  describe('subscriptions', () => {
    it('notifies subscribers on state changes', () => {
      const callback = vi.fn();
      workspaceStore.subscribe(callback);

      workspaceStore.actions.setUuid('test-uuid');

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ uuid: 'test-uuid' }));
    });

    it('supports multiple subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      workspaceStore.subscribe(callback1);
      workspaceStore.subscribe(callback2);

      workspaceStore.actions.setVideo('/video.mp4');

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('handles complete workspace setup flow', () => {
      const workspaceData = {
        uuid: 'workspace-789',
        video: {
          url: '/project.mp4',
          meta: { duration: 180, width: 1920, height: 1080 }
        },
        config: {
          thumbs: { scales: ['0.1', '0.2', '0.5'] }
        }
      };

      workspaceStore.actions.loadWorkspace(workspaceData);

      const state = workspaceStore.getState();
      expect(state.uuid).toBe('workspace-789');
      expect(state.videoUrl).toBe('/project.mp4');
      expect(state.videoMeta.duration).toBe(180);
      expect(state.config.thumbs.scales).toContain('0.1');
    });

    it('handles video change in existing workspace', () => {
      workspaceStore.actions.setUuid('workspace-123');
      workspaceStore.actions.setVideo('/video1.mp4', { duration: 60 });

      const cacheBuster1 = workspaceStore.getState().cacheBuster;

      vi.useFakeTimers();
      vi.advanceTimersByTime(1000);

      workspaceStore.actions.setVideo('/video2.mp4', { duration: 120 });

      const state = workspaceStore.getState();
      expect(state.uuid).toBe('workspace-123');
      expect(state.videoUrl).toBe('/video2.mp4');
      expect(state.videoMeta.duration).toBe(120);
      expect(state.cacheBuster).toBeGreaterThan(cacheBuster1);

      vi.useRealTimers();
    });
  });
});
