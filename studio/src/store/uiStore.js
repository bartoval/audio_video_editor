// @ts-check

/** UI Store - manages ephemeral UI state (not persisted) */
import { createStore } from './createStore';

const initialState = {
  tasks: {},
  toasts: [],
  toolMode: null
};

let toastIdCounter = 0;

const uiStore = createStore(initialState, {
  actions: {
    setTaskStatus(state, taskId, options) {
      const { status, progress, type } = options;

      return {
        tasks: {
          ...state.tasks,
          [taskId]: {
            status,
            ...(progress !== undefined && { progress }),
            ...(type !== undefined && { type })
          }
        }
      };
    },

    clearTaskStatus(state, taskId) {
      const { [taskId]: _removed, ...tasks } = state.tasks;

      return { tasks };
    },

    clearAllTasks() {
      return { tasks: {} };
    },

    pushToast(state, toast) {
      const id = `toast-${++toastIdCounter}`;
      const newToast = {
        id,
        type: toast.type || 'info',
        msg: toast.msg,
        details: toast.details,
        timeHide: toast.timeHide
      };

      return {
        toasts: [...state.toasts, newToast]
      };
    },

    removeToast(state, id) {
      return {
        toasts: state.toasts.filter(toast => toast.id !== id)
      };
    },

    clearAllToasts() {
      return { toasts: [] };
    },

    refreshInspector() {
      return { inspectorRefresh: Date.now() };
    },

    setToolMode(state, mode) {
      if (state.toolMode === mode) {
        return state;
      }

      return { toolMode: mode };
    },

    clearToolMode(state) {
      if (state.toolMode === null) {
        return state;
      }

      return { toolMode: null };
    },

    toggleToolMode(state, mode) {
      return { toolMode: state.toolMode === mode ? null : mode };
    }
  }
});

export default uiStore;
