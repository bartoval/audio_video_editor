import ProjectSelector from './ProjectSelector';
import HeaderActions from './HeaderActions';

/**
 * Header controller - orchestrates header components
 */
export default class Header {
  #projectSelector = null;
  #headerActions = null;

  constructor($parent) {
    this.#projectSelector = new ProjectSelector($parent);
    this.#headerActions = new HeaderActions($parent);
  }

  destroy() {
    this.#projectSelector?.destroy();
    this.#headerActions?.destroy();
  }
}
