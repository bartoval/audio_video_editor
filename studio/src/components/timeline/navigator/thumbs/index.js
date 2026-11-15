/** Thumbs - public API */
import TiledThumbsView from './TiledThumbsView';
import LocalThumbsView from './LocalThumbsView';

/** Factory to create thumbs view (local video frames) */
export function createThumbsView($parent) {
  return new LocalThumbsView($parent);
}

export { TiledThumbsView };
