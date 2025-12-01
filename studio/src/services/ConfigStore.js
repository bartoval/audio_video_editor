// @ts-check

/** ConfigStore - Centralized configuration from backend */
import { ROUTES } from '../config/routes';

let config = null;
let loadPromise = null;
const listeners = new Set();

/**
 * Load configuration from backend API
 * Returns cached config if already loaded
 */
export const load = async () => {
  if (config) {
    return config;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = fetch(ROUTES.config)
    .then(res => {
      if (!res.ok) {
        throw new Error('Failed to load config');
      }

      return res.json();
    })
    .then(data => {
      config = data.thumbs;
      notifyListeners();

      return config;
    });

  return loadPromise;
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
