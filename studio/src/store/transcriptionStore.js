// @ts-check

import { createStore } from './createStore';

/**
 * @typedef {Object} TranscriptionSegment
 * @property {number} start
 * @property {number} end
 * @property {string} text
 */

/**
 * @typedef {Object} TranscriptionData
 * @property {string} text
 * @property {TranscriptionSegment[]} segments
 * @property {string} language
 * @property {number} duration
 */

/**
 * @typedef {Object} TranscriptionState
 * @property {Record<string, TranscriptionData>} transcriptions
 * @property {string | null} activeAudioId
 */

/** @type {TranscriptionState} */
const initialState = {
  transcriptions: {},
  activeAudioId: null
};

const transcriptionStore = createStore(initialState, {
  actions: {
    setTranscription(state, { audioId, data }) {
      return {
        transcriptions: { ...state.transcriptions, [audioId]: data }
      };
    },

    removeTranscription(state, audioId) {
      const { [audioId]: _, ...rest } = state.transcriptions;

      return { transcriptions: rest };
    },

    setActiveAudioId(_state, audioId) {
      return { activeAudioId: audioId };
    },

    clear() {
      return { transcriptions: {}, activeAudioId: null };
    },

    hydrate(_state, transcriptions) {
      return { transcriptions: transcriptions || {} };
    }
  }
});

export default transcriptionStore;
