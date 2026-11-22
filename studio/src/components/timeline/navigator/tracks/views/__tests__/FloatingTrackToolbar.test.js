import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../../../../services/ToolMode', () => ({
  onModeChange: vi.fn(() => vi.fn())
}));

vi.mock('../../../../../../services/SuperZoomService', () => ({
  onChange: vi.fn(() => vi.fn()),
  toggle: vi.fn()
}));

vi.mock('../../../../../../services/CutService', () => ({
  toggle: vi.fn()
}));

import FloatingTrackToolbar from '../FloatingTrackToolbar';

describe('FloatingTrackToolbar', () => {
  let toolbar;

  afterEach(() => {
    toolbar?.destroy();
    toolbar = null;
    document.body.innerHTML = '';
  });

  describe('with a timeline dock', () => {
    let $dock;
    let $track;

    beforeEach(() => {
      document.body.innerHTML = `
        <div class="timeline">
          <div class="timeline-dock"></div>
          <div class="navigator"><div class="track"></div></div>
        </div>
      `;
      $dock = document.querySelector('.timeline-dock');
      $track = document.querySelector('.track');
      toolbar = new FloatingTrackToolbar($track);
    });

    it('starts inside the track and hidden', () => {
      expect(toolbar.getRoot().parentElement).toBe($track);
      expect(toolbar.getRoot().classList.contains('visible')).toBe(false);
    });

    it('moves into the dock when shown, so it never covers the tracks', () => {
      toolbar.show();

      expect(toolbar.getRoot().parentElement).toBe($dock);
      expect(toolbar.getRoot().classList.contains('docked')).toBe(true);
      expect(toolbar.getRoot().classList.contains('visible')).toBe(true);
    });

    it('stays in the dock across hide and show', () => {
      toolbar.show();
      toolbar.hide();
      toolbar.show();

      expect(toolbar.getRoot().parentElement).toBe($dock);
      expect($dock.querySelectorAll('.floating-track-toolbar')).toHaveLength(1);
    });

    it('does not follow the mouse once docked', () => {
      toolbar.show();
      const $inner = toolbar.getRoot().querySelector('.floating-toolbar-inner');
      const before = $inner.style.transform;

      $track.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, bubbles: true }));

      expect($inner.style.transform).toBe(before);
    });

    it('is removed from the dock on destroy', () => {
      toolbar.show();
      toolbar.destroy();
      toolbar = null;

      expect($dock.querySelector('.floating-track-toolbar')).toBeNull();
    });
  });

  describe('without a timeline dock', () => {
    it('keeps floating inside the track', () => {
      document.body.innerHTML = '<div class="track"></div>';
      const $track = document.querySelector('.track');
      toolbar = new FloatingTrackToolbar($track);

      toolbar.show();

      expect(toolbar.getRoot().parentElement).toBe($track);
      expect(toolbar.getRoot().classList.contains('docked')).toBe(false);
    });
  });

  describe('controls', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div class="track"></div>';
    });

    it('groups modes, actions and options separately', () => {
      toolbar = new FloatingTrackToolbar(document.querySelector('.track'));
      const $root = toolbar.getRoot();
      const actionsIn = group =>
        [...$root.querySelectorAll(`.toolbar-group--${group} [data-action]`)].map(
          $btn => $btn.dataset.action
        );

      expect(actionsIn('modes')).toEqual(['cut', 'volume', 'pan']);
      expect(actionsIn('actions')).toEqual(['copy', 'mute', 'delete']);
      expect(actionsIn('options')).toEqual(['snap', 'superzoom', 'inspector']);
    });

    it('still dispatches actions to the track callbacks', () => {
      const onCopy = vi.fn();
      const onDelete = vi.fn();
      const onVolumeToggle = vi.fn();
      toolbar = new FloatingTrackToolbar(document.querySelector('.track'), {
        onCopy,
        onDelete,
        onVolumeToggle
      });
      const click = action => toolbar.getRoot().querySelector(`[data-action="${action}"]`).click();

      click('copy');
      click('delete');
      click('volume');

      expect(onCopy).toHaveBeenCalledTimes(1);
      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onVolumeToggle).toHaveBeenCalledWith(true);
    });
  });
});
