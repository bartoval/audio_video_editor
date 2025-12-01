// @ts-check

/**
 * Timeline Store - manages timeline tracks, markers, selection, and thumbnails state
 *
 * This store is persisted to IndexedDB for offline support.
 *
 * State shape:
 * {
 *   tracks: Array<Track>,          // Audio/video tracks in timeline
 *   selection: string | null,      // Selected track ID
 *   markers: Array<Marker>,        // Timeline markers (points in time)
 *   selectedMarkerId: string|null, // Selected marker ID
 *   thumbs: {
 *     loading: boolean,            // Thumbnails generation in progress
 *     progress: number,            // Generation progress 0-100
 *     scale: string,               // Current thumb scale/zoom
 *     status: string,              // pending|processing|ready|error
 *     scalesReady: Array<string>   // Scales that have been generated
 *   }
 * }
 */
import { THUMBNAILS } from '../config/ui';
import { THUMBS_STATUS } from '../config/constants';

import { createStore } from './createStore';

const initialState = {
  tracks: [],
  selection: null,
  markers: [],
  selectedMarkerId: null,
  thumbs: {
    loading: false,
    progress: 0,
    scale: THUMBNAILS.DEFAULT_SCALE,
    status: THUMBS_STATUS.PENDING,
    scalesReady: []
  }
};

const timelineStore = createStore(initialState, {
  actions: {
    setTracks(state, tracks) {
      return { tracks: [...tracks] };
    },

    addTracks(state, newTracks) {
      return { tracks: [...state.tracks, ...newTracks] };
    },

    updateTrack(state, id, patch) {
      const tracks = state.tracks.map(track => (track.id === id ? { ...track, ...patch } : track));

      return { tracks };
    },

    removeTrack(state, id) {
      const tracks = state.tracks.filter(track => track.id !== id);
      const selection = state.selection === id ? null : state.selection;

      return { tracks, selection };
    },

    setSelection(state, id) {
      return { selection: id };
    },

    setMarkers(_state, markers) {
      return { markers: [...markers] };
    },

    addMarker(state, marker) {
      const markers = [...state.markers, marker].sort((a, b) => a.time - b.time);

      return { markers };
    },

    updateMarker(state, id, patch) {
      const markers = state.markers.map(marker =>
        marker.id === id ? { ...marker, ...patch } : marker
      );

      return { markers: markers.sort((a, b) => a.time - b.time) };
    },

    removeMarker(state, id) {
      const markers = state.markers.filter(marker => marker.id !== id);
      const selectedMarkerId = state.selectedMarkerId === id ? null : state.selectedMarkerId;

      return { markers, selectedMarkerId };
    },

    selectMarker(state, id) {
      return { selectedMarkerId: id };
    },

    setThumbsLoading(state, loading) {
      return {
        thumbs: {
          ...state.thumbs,
          loading
        }
      };
    },

    setThumbsProgress(state, data) {
      const { percent, scale } = data;

      return {
        thumbs: {
          ...state.thumbs,
          progress: percent,
          ...(scale !== undefined && { scale })
        }
      };
    },

    setThumbsScale(state, scale) {
      return {
        thumbs: {
          ...state.thumbs,
          scale
        }
      };
    },

    setThumbsStatus(state, status) {
      return {
        thumbs: {
          ...state.thumbs,
          status
        }
      };
    },

    setScalesReady(state, scales) {
      return {
        thumbs: {
          ...state.thumbs,
          scalesReady: scales
        }
      };
    },

    clear(state) {
      return {
        tracks: [],
        selection: null,
        markers: [],
        selectedMarkerId: null,
        thumbs: {
          loading: false,
          progress: 0,
          scale: state.thumbs.scale,
          status: THUMBS_STATUS.PENDING,
          scalesReady: []
        }
      };
    }
  }
});

export default timelineStore;
