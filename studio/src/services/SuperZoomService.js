const listeners = new Set();

let isEnabled = false;
let sharedPopup = null;
let activeController = null;

const CONFIG = {
  windowSize: 0.5, // seconds to show in popup
  magnification: 6, // zoom factor vs normal view
  popupWidth: 280, // pixels
  popupHeight: 140, // pixels
  offsetX: 20, // popup offset from cursor
  offsetY: -190
};

export const enable = () => {
  if (isEnabled) {
    return;
  }

  isEnabled = true;
  document.body.classList.add('superzoom-enabled');
  notify();
};

export const disable = () => {
  if (!isEnabled) {
    return;
  }

  isEnabled = false;
  document.body.classList.remove('superzoom-enabled');
  notify();
};

export const toggle = () => {
  if (isEnabled) {
    disable();
  } else {
    enable();
  }
};

export const isActive = () => isEnabled;

export const getConfig = () => ({ ...CONFIG });

export const setWindowSize = seconds => {
  CONFIG.windowSize = Math.max(0.1, Math.min(2, seconds));
  notify();
};

export const setMagnification = factor => {
  CONFIG.magnification = Math.max(2, Math.min(12, factor));
  notify();
};

/**
 * Subscribe to state changes
 * @param {Function} callback
 * @returns {Function} Unsubscribe function
 */
export const onChange = callback => {
  listeners.add(callback);

  return () => listeners.delete(callback);
};

/**
 * Get or create the shared popup instance
 * @param {Function} PopupClass - The SuperZoomPopup class
 * @returns {Object} The popup instance
 */
export const getOrCreatePopup = PopupClass => {
  if (!sharedPopup) {
    sharedPopup = new PopupClass();
    sharedPopup.mount();
  }

  return sharedPopup;
};

/**
 * Set the active controller that owns the popup
 * @param {Object} controller
 */
export const setActiveController = controller => {
  activeController = controller;
};

/**
 * Get the active controller
 * @returns {Object|null}
 */
export const getActiveController = () => activeController;

/**
 * Hide popup if the specified controller is active
 * @param {Object} controller
 */
export const hidePopupFor = controller => {
  if (activeController === controller && sharedPopup) {
    sharedPopup.hide();
    activeController = null;
  }
};

/**
 * Destroy the shared popup instance
 */
export const destroyPopup = () => {
  if (sharedPopup) {
    sharedPopup.destroy();
    sharedPopup = null;
    activeController = null;
  }
};

function notify() {
  const state = {
    isEnabled,
    config: { ...CONFIG }
  };

  listeners.forEach(cb => {
    try {
      cb(state);
    } catch (err) {
      console.error('[SuperZoomService] Listener error:', err);
    }
  });
}

// Cleanup shared popup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', destroyPopup);
}

export default {
  enable,
  disable,
  toggle,
  isActive,
  getConfig,
  setWindowSize,
  setMagnification,
  onChange,
  getOrCreatePopup,
  setActiveController,
  getActiveController,
  hidePopupFor,
  destroyPopup
};
