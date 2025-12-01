/** Thumbs - public API */
import { isTilesModeEnabled } from '../../../../services/ThumbsMode';
import ThumbsView from './ThumbsView';
import TiledThumbsView from './TiledThumbsView';

/** Factory to create the appropriate thumbs view based on mode */
export function createThumbsView($parent) {
  if (isTilesModeEnabled()) {
    return new TiledThumbsView($parent);
  }

  return new ThumbsView($parent);
}

export { ThumbsView };
export { TiledThumbsView };
