import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../lib', () => ({
  createElement: vi.fn((tag, options) => {
    const el = document.createElement(tag);
    if (options.className) el.className = options.className;
    if (options.html) el.innerHTML = options.html;
    if (options.parent) options.parent.appendChild(el);
    return el;
  })
}));

vi.mock('../../../config/constants', () => ({
  LABEL: {
    LOAD: 'Load',
    SAVE: 'Save',
    PREVIEW: 'Preview',
    LOAD_OFFLINE: 'Load (offline)',
    SAVE_OFFLINE: 'Save (offline)',
    PREVIEW_OFFLINE: 'Preview (offline)'
  }
}));

import { createHeaderActions } from '../view/createHeaderActions';

describe('createHeaderActions', () => {
  let container;
  let headerActions;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    headerActions?.destroy?.();
    container?.remove();
  });

  describe('initialization', () => {
    it('creates load, save, and preview buttons', () => {
      headerActions = createHeaderActions(container);

      expect(container.querySelector('[data-action="load"]')).toBeTruthy();
      expect(container.querySelector('[data-action="save"]')).toBeTruthy();
      expect(container.querySelector('[data-action="preview"]')).toBeTruthy();
    });

    it('all buttons are disabled after initial setState with no tracks/backup', () => {
      headerActions = createHeaderActions(container);
      headerActions.setState({ hasTracks: false, hasBackup: false });

      const loadBtn = container.querySelector('[data-action="load"]');
      const saveBtn = container.querySelector('[data-action="save"]');
      const previewBtn = container.querySelector('[data-action="preview"]');

      expect(loadBtn.disabled).toBe(true);
      expect(saveBtn.disabled).toBe(true);
      expect(previewBtn.disabled).toBe(true);
    });
  });

  describe('hasTracks state', () => {
    it('enables save and preview when hasTracks is true', () => {
      headerActions = createHeaderActions(container);
      headerActions.setState({ hasTracks: true });

      const saveBtn = container.querySelector('[data-action="save"]');
      const previewBtn = container.querySelector('[data-action="preview"]');

      expect(saveBtn.disabled).toBe(false);
      expect(previewBtn.disabled).toBe(false);
    });

    it('disables save and preview when hasTracks is false', () => {
      headerActions = createHeaderActions(container);
      headerActions.setState({ hasTracks: true });
      headerActions.setState({ hasTracks: false });

      const saveBtn = container.querySelector('[data-action="save"]');
      const previewBtn = container.querySelector('[data-action="preview"]');

      expect(saveBtn.disabled).toBe(true);
      expect(previewBtn.disabled).toBe(true);
    });

    it('load button remains disabled without backup even with tracks', () => {
      headerActions = createHeaderActions(container);
      headerActions.setState({ hasTracks: true, hasBackup: false });

      const loadBtn = container.querySelector('[data-action="load"]');

      expect(loadBtn.disabled).toBe(true);
    });
  });

  describe('hasBackup state', () => {
    it('enables load when hasBackup is true', () => {
      headerActions = createHeaderActions(container);
      headerActions.setState({ hasBackup: true });

      const loadBtn = container.querySelector('[data-action="load"]');

      expect(loadBtn.disabled).toBe(false);
    });

    it('disables load when hasBackup is false', () => {
      headerActions = createHeaderActions(container);
      headerActions.setState({ hasBackup: true });
      headerActions.setState({ hasBackup: false });

      const loadBtn = container.querySelector('[data-action="load"]');

      expect(loadBtn.disabled).toBe(true);
    });

    it('allows saving an emptied project while preview remains disabled', () => {
      headerActions = createHeaderActions(container);
      headerActions.setState({ hasBackup: true, hasTracks: false });

      const saveBtn = container.querySelector('[data-action="save"]');
      const previewBtn = container.querySelector('[data-action="preview"]');

      expect(saveBtn.disabled).toBe(false);
      expect(previewBtn.disabled).toBe(true);
    });
  });

  describe('combined states', () => {
    it('all buttons enabled when hasTracks and hasBackup are true', () => {
      headerActions = createHeaderActions(container);
      headerActions.setState({ hasTracks: true, hasBackup: true });

      const loadBtn = container.querySelector('[data-action="load"]');
      const saveBtn = container.querySelector('[data-action="save"]');
      const previewBtn = container.querySelector('[data-action="preview"]');

      expect(loadBtn.disabled).toBe(false);
      expect(saveBtn.disabled).toBe(false);
      expect(previewBtn.disabled).toBe(false);
    });

    it('allows loading a local backup while preview remains disabled offline', () => {
      headerActions = createHeaderActions(container);
      headerActions.setState({ hasTracks: true, hasBackup: true, offline: true });

      const loadBtn = container.querySelector('[data-action="load"]');
      const previewBtn = container.querySelector('[data-action="preview"]');

      expect(loadBtn.disabled).toBe(false);
      expect(previewBtn.disabled).toBe(true);
    });

    it('save remains enabled when offline (for local backup)', () => {
      headerActions = createHeaderActions(container);
      headerActions.setState({ hasTracks: true, offline: true });

      const saveBtn = container.querySelector('[data-action="save"]');

      expect(saveBtn.disabled).toBe(false);
    });
  });

  describe('busy states', () => {
    it('disables all buttons when isLoading is true', () => {
      headerActions = createHeaderActions(container);
      headerActions.setState({ hasTracks: true, hasBackup: true, isLoading: true });

      const loadBtn = container.querySelector('[data-action="load"]');
      const saveBtn = container.querySelector('[data-action="save"]');
      const previewBtn = container.querySelector('[data-action="preview"]');

      expect(loadBtn.disabled).toBe(true);
      expect(saveBtn.disabled).toBe(true);
      expect(previewBtn.disabled).toBe(true);
    });

    it('disables all buttons when isSaving is true', () => {
      headerActions = createHeaderActions(container);
      headerActions.setState({ hasTracks: true, hasBackup: true, isSaving: true });

      const loadBtn = container.querySelector('[data-action="load"]');
      const saveBtn = container.querySelector('[data-action="save"]');
      const previewBtn = container.querySelector('[data-action="preview"]');

      expect(loadBtn.disabled).toBe(true);
      expect(saveBtn.disabled).toBe(true);
      expect(previewBtn.disabled).toBe(true);
    });

    it('disables all buttons when isExporting is true', () => {
      headerActions = createHeaderActions(container);
      headerActions.setState({ hasTracks: true, hasBackup: true, isExporting: true });

      const loadBtn = container.querySelector('[data-action="load"]');
      const saveBtn = container.querySelector('[data-action="save"]');
      const previewBtn = container.querySelector('[data-action="preview"]');

      expect(loadBtn.disabled).toBe(true);
      expect(saveBtn.disabled).toBe(true);
      expect(previewBtn.disabled).toBe(true);
    });
  });

  describe('click handlers', () => {
    it('calls onLoad when load button is clicked', () => {
      const onLoad = vi.fn();
      headerActions = createHeaderActions(container);
      headerActions.bind({ onLoad });
      headerActions.setState({ hasBackup: true });

      const loadBtn = container.querySelector('[data-action="load"]');
      loadBtn.click();

      expect(onLoad).toHaveBeenCalledTimes(1);
    });

    it('calls onSave when save button is clicked', () => {
      const onSave = vi.fn();
      headerActions = createHeaderActions(container);
      headerActions.bind({ onSave });
      headerActions.setState({ hasTracks: true });

      const saveBtn = container.querySelector('[data-action="save"]');
      saveBtn.click();

      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('calls onPreview when preview button is clicked', () => {
      const onPreview = vi.fn();
      headerActions = createHeaderActions(container);
      headerActions.bind({ onPreview });
      headerActions.setState({ hasTracks: true });

      const previewBtn = container.querySelector('[data-action="preview"]');
      previewBtn.click();

      expect(onPreview).toHaveBeenCalledTimes(1);
    });

    it('does not call handler when button is disabled', () => {
      const onLoad = vi.fn();
      headerActions = createHeaderActions(container);
      headerActions.bind({ onLoad });
      headerActions.setState({ hasBackup: false });

      const loadBtn = container.querySelector('[data-action="load"]');
      loadBtn.click();

      expect(onLoad).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('removes element from DOM', () => {
      headerActions = createHeaderActions(container);

      expect(container.children.length).toBe(1);

      headerActions.destroy();

      expect(container.children.length).toBe(0);
    });
  });
});
