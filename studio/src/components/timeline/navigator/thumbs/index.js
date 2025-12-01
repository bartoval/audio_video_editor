/** Thumbs - public API */
import TiledThumbsView from './TiledThumbsView';

/** Factory to create thumbs view (tiles mode only) */
export function createThumbsView($parent) {
  return new TiledThumbsView($parent);
}

export { TiledThumbsView };
