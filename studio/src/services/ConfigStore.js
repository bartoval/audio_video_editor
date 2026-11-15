// @ts-check

/** ConfigStore - Local timeline configuration */

let config = null;
const listeners = new Set();
const STORAGE_KEY = 'studio-thumbnails-config-v1';

/**
 * Load saved configuration or built-in defaults
 * Returns cached config if already loaded
 */
export const load = async () => {
  if (config) {
    return config;
  }

  try {
    config = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    /* Use local defaults on a fresh device. */
  }
  if (!config?.scales) {
    config = {
      scales: ['0.01', '0.02', '0.05', '0.1', '0.2', '0.5', '1', '2'].map(scale => ({
        scale,
        isPriority: scale === '0.1'
      })),
      defaultScale: '0.1',
      tiles: { cols: 10, rows: 10 },
      extension: '.webp'
    };
  }
  notifyListeners();
  return config;
};

/**
 * Set configuration manually (for testing or SSE fallback)
 */
export const setConfig = thumbsConfig => {
  config = thumbsConfig;
  notifyListeners();
};

/**
 * Check if config is loaded
 */
export const isReady = () => config !== null;

/**
 * Subscribe to config changes
 */
export const onReady = callback => {
  if (config) {
    callback(config);
  }

  listeners.add(callback);

  return () => listeners.delete(callback);
};

/**
 * Get all available scales as numbers
 * @returns {number[] | null}
 */
export const getScales = () => {
  if (!config?.scales) {
    return null;
  }

  return config.scales.map(({ scale }) => parseFloat(scale));
};

/**
 * Get default/priority scale
 * @returns {string | undefined}
 */
export const getDefaultScale = () => config?.defaultScale;

/**
 * Convert zoom scale to thumb scale key (1:1 mapping)
 * @param {number} zoomScale
 * @returns {string}
 */
export const getThumbScaleForZoom = zoomScale => String(zoomScale);

/**
 * Get tile grid configuration
 * @returns {{ cols: number, rows: number } | null}
 */
export const getTiles = () => config?.tiles || null;

/**
 * Get thumbs per tile (cols * rows)
 * @returns {number | null}
 */
export const getThumbsPerTile = () => {
  const tiles = getTiles();

  if (!tiles) {
    return null;
  }

  return tiles.cols * tiles.rows;
};

/**
 * Get thumbnail file extension
 * @returns {string | null}
 */
export const getThumbExtension = () => config?.extension || null;

function notifyListeners() {
  listeners.forEach(cb => {
    try {
      cb(config);
    } catch (err) {
      console.error('[ConfigStore] Listener error:', err);
    }
  });
}
