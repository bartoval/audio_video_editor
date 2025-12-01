// @ts-check

/**
 * ToolMode Service - Facade over uiStore for backward compatibility
 *
 * This module now delegates to uiStore.toolMode state.
 * Body class updates are handled by connectToolModeEffect() in storeConnectors.
 */
import uiStore from '../store/uiStore';

/**
 * @param {string} mode
 */
export const activate = mode => {
  uiStore.actions.setToolMode(mode);
};

export const deactivate = () => {
  uiStore.actions.clearToolMode();
};

/**
 * @param {string} mode
 */
export const toggle = mode => {
  uiStore.actions.toggleToolMode(mode);
};

/** @returns {string | null} */
export const getMode = () => uiStore.getState().toolMode;

/**
 * @param {string} mode
 * @returns {boolean}
 */
export const isMode = mode => uiStore.getState().toolMode === mode;

/** @returns {boolean} */
export const isActive = () => uiStore.getState().toolMode !== null;

/**
 * @param {(mode: string | null) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export const onModeChange = callback => {
  let previousMode = uiStore.getState().toolMode;

  return uiStore.subscribe(state => {
    if (state.toolMode !== previousMode) {
      previousMode = state.toolMode;
      callback(state.toolMode);
    }
  });
};
