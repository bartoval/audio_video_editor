import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import PreviewModal from '../PreviewModal';
import { LABEL } from '../../../config/constants';

describe('PreviewModal error state', () => {
  let modal;

  beforeEach(() => {
    document.body.innerHTML = '';
    modal = new PreviewModal();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const text = selector => document.querySelector(selector)?.textContent;

  it('falls back to a generic message when there is no detail', () => {
    modal.showError();

    expect(text('.preview-error-text')).toBe(LABEL.EXPORT_FAILED);
    expect(text('.preview-error-subtext')).toBe(LABEL.TRY_AGAIN);
  });

  it('shows why the export failed, so the user knows what to do', () => {
    modal.showError(LABEL.EXPORT_FAILED, 'Use Sync server first.');

    expect(text('.preview-error-text')).toBe(LABEL.EXPORT_FAILED);
    expect(text('.preview-error-subtext')).toBe('Use Sync server first.');
  });

  it('escapes the detail, which can come from a server error', () => {
    modal.showError(LABEL.EXPORT_FAILED, '<img src=x onerror=alert(1)>');

    expect(document.querySelector('.preview-error-subtext img')).toBeNull();
    expect(text('.preview-error-subtext')).toBe('<img src=x onerror=alert(1)>');
  });
});
