import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../services/EventService', () => {
  const listeners = new Map();
  return {
    on: vi.fn((event, callback) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event).add(callback);
      return () => listeners.get(event)?.delete(callback);
    }),
    emitLocal: vi.fn((event, data) => {
      listeners.get(event)?.forEach(callback => callback(data));
    }),
    _clear: () => listeners.clear()
  };
});

import * as EventService from '../../../services/EventService';
import { EVENT } from '../../../config/constants';
import SidePanel from '../SidePanel';

describe('SidePanel', () => {
  let $aside;
  let panel;

  const tab = id => $aside.querySelector(`.side-panel__tab[data-tab="${id}"]`);
  const pane = id => $aside.querySelector(`.side-panel__pane--${id}`);

  beforeEach(() => {
    EventService._clear();
    vi.clearAllMocks();
    document.body.innerHTML = '<aside class="studio-library"><div class="library"></div></aside>';
    $aside = document.querySelector('aside');
    panel = new SidePanel($aside);
  });

  afterEach(() => {
    panel.destroy();
    document.body.innerHTML = '';
  });

  it('renders the tabs before the library and starts on Library', () => {
    expect($aside.firstElementChild.classList.contains('side-panel__tabs')).toBe(true);
    expect(tab('library').getAttribute('aria-selected')).toBe('true');
    expect(pane('library').hidden).toBe(false);
    expect(pane('inspector').hidden).toBe(true);
    expect(panel.getActive()).toBe('library');
  });

  it('marks Assistant as coming soon and ignores clicks on it', () => {
    expect(tab('assistant').disabled).toBe(true);

    tab('assistant').click();

    expect(panel.getActive()).toBe('library');
    expect(EventService.emitLocal).not.toHaveBeenCalled();
  });

  it('switches pane and announces the choice when a tab is clicked', () => {
    tab('inspector').click();

    expect(pane('inspector').hidden).toBe(false);
    expect(pane('library').hidden).toBe(true);
    expect(tab('inspector').getAttribute('aria-selected')).toBe('true');
    expect(EventService.emitLocal).toHaveBeenCalledWith(EVENT.SIDE_PANEL_TAB, { tab: 'inspector' });
  });

  it('follows the Inspector when it is toggled elsewhere (shortcut, toolbar)', () => {
    EventService.emitLocal(EVENT.INSPECTOR_VISIBILITY, { isOpen: true });
    expect(panel.getActive()).toBe('inspector');

    EventService.emitLocal(EVENT.INSPECTOR_VISIBILITY, { isOpen: false });
    expect(panel.getActive()).toBe('library');
  });

  it('select() does not emit, so state decided elsewhere cannot loop back', () => {
    panel.select('inspector');

    expect(EventService.emitLocal).not.toHaveBeenCalled();
    expect(pane('inspector').hidden).toBe(false);
  });

  it('stops listening and removes its tabs on destroy', () => {
    panel.destroy();
    EventService.emitLocal(EVENT.INSPECTOR_VISIBILITY, { isOpen: true });

    expect(panel.getActive()).toBe('library');
    expect($aside.querySelector('.side-panel__tabs')).toBeNull();
  });
});
