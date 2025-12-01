// @ts-check

import { createStore } from './createStore';

export const AI_MUSIC_STATUS = {
  IDLE: 'idle',
  GENERATING: 'generating',
  COMPLETE: 'complete',
  ERROR: 'error'
};

const initialState = {
  status: AI_MUSIC_STATUS.IDLE,
  provider: null,
  jobId: null,
  tracks: [],
  error: null
};

const aiMusicStore = createStore(initialState, {
  actions: {
    setGenerating(state, { provider, jobId }) {
      return {
        status: AI_MUSIC_STATUS.GENERATING,
        provider,
        jobId,
        tracks: [],
        error: null
      };
    },

    setComplete(state, tracks) {
      return {
        status: AI_MUSIC_STATUS.COMPLETE,
        tracks
      };
    },

    setError(state, error) {
      return {
        status: AI_MUSIC_STATUS.ERROR,
        error
      };
    },

    reset() {
      return { ...initialState };
    }
  }
});

export default aiMusicStore;
