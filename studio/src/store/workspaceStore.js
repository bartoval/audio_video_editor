// @ts-check

/**
 * Workspace Store - manages workspace/project state and configuration
 *
 * This store is persisted to IndexedDB for offline support.
 *
 * State shape:
 * {
 *   uuid: string,                // Current workspace ID
 *   videoUrl: string | null,     // Video file URL
 *   videoMeta: object | null,    // Video metadata (duration, fps, etc.)
 *   cacheBuster: number,         // Cache invalidation timestamp
 *   config: {
 *     thumbs: object | null,     // Thumbnail configuration
 *     bpm: number,               // Beats per minute (1-999)
 *     timeSignature: string,     // Time signature (e.g., '4/4')
 *     fps: number | null         // Frames per second (1-240)
 *   }
 * }
 */
import { createStore } from './createStore';

const initialState = {
  uuid: '0',
  videoUrl: null,
  videoMeta: null,
  cacheBuster: Date.now(),
  config: {
    thumbs: null,
    bpm: 120,
    timeSignature: '4/4',
    fps: null
  }
};

const workspaceStore = createStore(initialState, {
  actions: {
    loadWorkspace(state, data) {
      const { uuid, video, config } = data;

      return {
        uuid: uuid || state.uuid,
        videoUrl: video?.url || null,
        videoMeta: video?.meta || null,
        config: {
          thumbs: config?.thumbs || state.config.thumbs
        },
        cacheBuster: Date.now()
      };
    },

    setUuid(state, uuid) {
      return { uuid };
    },

    setVideo(state, url, meta = null) {
      return {
        videoUrl: url,
        videoMeta: meta,
        cacheBuster: Date.now()
      };
    },

    clearVideo() {
      return {
        videoUrl: null,
        videoMeta: null
      };
    },

    setConfig(state, config) {
      return {
        config: {
          ...state.config,
          ...config
        }
      };
    },

    invalidateCache() {
      return { cacheBuster: Date.now() };
    },

    reset(state) {
      return {
        uuid: '0',
        videoUrl: null,
        videoMeta: null,
        cacheBuster: Date.now(),
        config: {
          thumbs: state.config.thumbs,
          bpm: 120,
          timeSignature: '4/4',
          fps: null
        }
      };
    },

    setBpm(state, bpm) {
      return {
        config: {
          ...state.config,
          bpm: Math.max(1, Math.min(999, bpm))
        }
      };
    },

    setTimeSignature(state, timeSignature) {
      return {
        config: {
          ...state.config,
          timeSignature
        }
      };
    },

    setFps(state, fps) {
      return {
        config: {
          ...state.config,
          fps: fps !== null ? Math.max(1, Math.min(240, fps)) : null
        }
      };
    }
  }
});

export default workspaceStore;
