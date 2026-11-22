// @ts-check

import { EVENT } from '../../config/constants';
import * as EventService from '../../services/EventService';

/**
 * @typedef {'library' | 'inspector' | 'assistant'} SidePanelTab
 */

const TABS = /** @type {const} */ ([
  { id: 'library', label: 'Library' },
  { id: 'inspector', label: 'Inspector' },
  { id: 'assistant', label: 'Assistant', soon: true }
]);

/**
 * SidePanel - tabbed panel to the right of the video: Library | Inspector | Assistant.
 *
 * It owns only the tabs and which pane is visible; the panes keep their own presenters.
 * Choosing a tab emits SIDE_PANEL_TAB (the Inspector opens or closes itself);
 * INSPECTOR_VISIBILITY keeps the tab in sync when the Inspector is toggled elsewhere
 * (shortcut I, clip toolbar).
 */
export default class SidePanel {
  /** @type {HTMLElement} */
  #$root;
  /** @type {HTMLElement} */
  #$tabs;
  /** @type {Map<string, HTMLElement>} */
  #panes = new Map();
  /** @type {SidePanelTab} */
  #active = 'library';
  /** @type {(() => void) | null} */
  #unsubscribe = null;

  /**
   * @param {HTMLElement} $root - the aside that holds the library (.studio-library)
   */
  constructor($root) {
    this.#$root = $root;
    this.#$root.classList.add('side-panel');
    this.#$tabs = this.#renderTabs();
    this.#$root.prepend(this.#$tabs);

    const $library = /** @type {HTMLElement} */ ($root.querySelector('.library'));
    $library.classList.add('side-panel__pane', 'side-panel__pane--library');
    this.#panes.set('library', $library);

    const $inspector = document.createElement('div');
    $inspector.className = 'side-panel__pane side-panel__pane--inspector';
    $inspector.setAttribute('role', 'tabpanel');
    $inspector.hidden = true;
    $root.appendChild($inspector);
    this.#panes.set('inspector', $inspector);

    this.#$tabs.addEventListener('click', this.#handleClick);
    this.#unsubscribe = EventService.on(EVENT.INSPECTOR_VISIBILITY, ({ isOpen }) => {
      this.select(isOpen ? 'inspector' : 'library');
    });
  }

  /** @returns {HTMLElement} */
  #renderTabs() {
    const $tabs = document.createElement('div');
    $tabs.className = 'side-panel__tabs';
    $tabs.setAttribute('role', 'tablist');
    $tabs.innerHTML = TABS.map(
      tab => `
        <button type="button" role="tab" class="side-panel__tab" data-tab="${tab.id}"
          aria-selected="${tab.id === this.#active}" ${tab.soon ? 'disabled' : ''}>
          ${tab.label}${tab.soon ? '<span class="side-panel__soon">Soon</span>' : ''}
        </button>`
    ).join('');

    return $tabs;
  }

  /** @param {MouseEvent} event */
  #handleClick = event => {
    const $tab = /** @type {HTMLElement | null} */ (
      /** @type {HTMLElement} */ (event.target).closest('[data-tab]')
    );

    if (!$tab || $tab.hasAttribute('disabled')) {
      return;
    }

    const tab = /** @type {SidePanelTab} */ ($tab.dataset.tab);
    this.select(tab);
    EventService.emitLocal(EVENT.SIDE_PANEL_TAB, { tab });
  };

  /**
   * Show a pane. Does not emit: use it to reflect state decided elsewhere.
   * @param {SidePanelTab} tab
   */
  select(tab) {
    if (!this.#panes.has(tab)) {
      return;
    }

    this.#active = tab;
    this.#panes.forEach(($pane, id) => {
      $pane.hidden = id !== tab;
    });
    this.#$tabs.querySelectorAll('[data-tab]').forEach($btn => {
      $btn.setAttribute(
        'aria-selected',
        String(/** @type {HTMLElement} */ ($btn).dataset.tab === tab)
      );
    });
  }

  /** @returns {SidePanelTab} */
  getActive() {
    return this.#active;
  }

  destroy() {
    this.#unsubscribe?.();
    this.#$tabs.removeEventListener('click', this.#handleClick);
    this.#$tabs.remove();
  }
}
