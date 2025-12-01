/**
 * ThumbsMode - manages thumbnail rendering mode (tiles vs legacy)
 *
 * Tiles mode: Netflix-style 10x10 grid sprites (better for long videos)
 * Legacy mode: Single sprite strip per scale (simpler, works with older videos)
 */

const STORAGE_KEY = 'thumbs-mode';
const MODE_TILES = 'tiles';
const MODE_LEGACY = 'legacy';

let currentMode = MODE_TILES;

// Load saved preference
const saved = localStorage.getItem(STORAGE_KEY);

if (saved === MODE_LEGACY || saved === MODE_TILES) {
  currentMode = saved;
}

// ============================================================================
// Public API
// ============================================================================

export function isTilesModeEnabled() {
  return currentMode === MODE_TILES;
}

export function setTilesModeEnabled(enabled) {
  currentMode = enabled ? MODE_TILES : MODE_LEGACY;
  localStorage.setItem(STORAGE_KEY, currentMode);
}

export function getThumbsMode() {
  return currentMode;
}

export { MODE_TILES, MODE_LEGACY };
