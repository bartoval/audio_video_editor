import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../../config/ui', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    RESIZE_BOUNDS: { defaultHeightPercent: 0.4, minHeightPercent: 0.2 },
    UPLOAD: { VIDEO_EXTENSIONS: '.mp4,.webm,.mov' }
  };
});

vi.mock('../../../../config/constants', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    LABEL: { NO_VIDEO: 'No video', IMPORT_VIDEO: 'Import', CHANGE_VIDEO: 'Change' }
  };
});

describe('VideoView', () => {
  let VideoView;
  let $parent;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div class="studio-preview"></div>';
    $parent = document.querySelector('.studio-preview');
    VideoView = (await import('../VideoView.js')).default;
  });

  it('creates empty state visible by default', () => {
    const view = new VideoView($parent);
    view.render();

    const emptyState = $parent.querySelector('.video-empty-state');
    expect(emptyState).not.toBeNull();
    expect(emptyState.classList.contains('hide')).toBe(false);
  });

  it('hides empty state when showVideoActions is called', () => {
    const view = new VideoView($parent);
    view.render();

    view.showVideoActions();

    const emptyState = $parent.querySelector('.video-empty-state');
    expect(emptyState.classList.contains('hide')).toBe(true);
  });

  it('shows empty state when showEmptyState is called', () => {
    const view = new VideoView($parent);
    view.render();
    view.showVideoActions();

    view.showEmptyState();

    const emptyState = $parent.querySelector('.video-empty-state');
    expect(emptyState.classList.contains('hide')).toBe(false);
  });
});
