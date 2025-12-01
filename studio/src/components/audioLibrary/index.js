import LibraryPresenter from './LibraryPresenter';

/**
 * Library - main export wrapping the MVP structure
 *
 * Usage:
 *   const library = new Library($element, { api: { list: url } });
 *   library.load();
 */
export default class Library extends LibraryPresenter {
  constructor($parent, config = {}) {
    super($parent, config);
  }
}

export { default as LibraryModel } from './LibraryModel';
export { default as LibraryView } from './LibraryView';
export { default as LibraryPresenter } from './LibraryPresenter';
export { default as LibraryPlayer } from './LibraryPlayer';
