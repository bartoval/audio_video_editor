import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store subscribers for emitting state changes
let mockSubscribers = [];

vi.mock('../../../store', () => {
  return {
    uiStore: {
      subscribe: vi.fn(callback => {
        mockSubscribers.push(callback);
        return () => {
          const index = mockSubscribers.indexOf(callback);
          if (index > -1) mockSubscribers.splice(index, 1);
        };
      }),
      getState: vi.fn(() => ({ tasks: {} }))
    }
  };
});

vi.mock('../../../config/ui', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    Z_INDEX: { ...actual.Z_INDEX, toast: 9999 }
  };
});

import TaskProgress from '../TaskProgress';
import { uiStore } from '../../../store';

describe('TaskProgress', () => {
  let container;
  let taskProgress;

  const emitState = tasks => {
    mockSubscribers.forEach(cb => cb({ tasks }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribers = [];
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    taskProgress?.destroy?.();
    container?.remove();
  });

  describe('initialization', () => {
    it('should render container element', () => {
      taskProgress = new TaskProgress(container);

      const progressContainer = container.querySelector('.task-progress-container');
      expect(progressContainer).toBeTruthy();
    });

    it('should subscribe to uiStore', () => {
      taskProgress = new TaskProgress(container);

      expect(uiStore.subscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('task rendering', () => {
    it('should add task item when task is added', () => {
      taskProgress = new TaskProgress(container);

      emitState({
        'task-1': { status: 'Loading...', progress: 50, type: 'info' }
      });

      const taskItem = container.querySelector('[data-task-id="task-1"]');
      expect(taskItem).toBeTruthy();
      expect(taskItem.querySelector('.task-status').textContent).toBe('Loading...');
    });

    it('should update existing task', () => {
      taskProgress = new TaskProgress(container);

      emitState({
        'task-1': { status: 'Loading...', progress: 25, type: 'info' }
      });

      emitState({
        'task-1': { status: 'Almost done...', progress: 75, type: 'info' }
      });

      const taskItem = container.querySelector('[data-task-id="task-1"]');
      expect(taskItem.querySelector('.task-status').textContent).toBe('Almost done...');
      expect(taskItem.querySelector('.progress-bar').style.width).toBe('75%');
    });

    it('should remove task when cleared', () => {
      vi.useFakeTimers();
      taskProgress = new TaskProgress(container);

      emitState({
        'task-1': { status: 'Loading...', progress: 50, type: 'info' }
      });

      expect(container.querySelector('[data-task-id="task-1"]')).toBeTruthy();

      emitState({});

      // Task should have fade-out class
      const taskItem = container.querySelector('[data-task-id="task-1"]');
      expect(taskItem.classList.contains('fade-out')).toBe(true);

      // After timeout, element should be removed
      vi.advanceTimersByTime(300);
      expect(container.querySelector('[data-task-id="task-1"]')).toBeFalsy();

      vi.useRealTimers();
    });

    it('should render multiple tasks', () => {
      taskProgress = new TaskProgress(container);

      emitState({
        'task-1': { status: 'Task 1', progress: 25, type: 'info' },
        'task-2': { status: 'Task 2', progress: 50, type: 'warning' },
        'task-3': { status: 'Task 3', progress: 75, type: 'error' }
      });

      expect(container.querySelectorAll('.task-progress-item').length).toBe(3);
    });

    it('should apply correct color class based on type', () => {
      taskProgress = new TaskProgress(container);

      emitState({
        'info-task': { status: 'Info', progress: 50, type: 'info' },
        'warning-task': { status: 'Warning', progress: 50, type: 'warning' },
        'error-task': { status: 'Error', progress: 50, type: 'error' }
      });

      expect(
        container
          .querySelector('[data-task-id="info-task"] .progress-bar')
          .classList.contains('bg-info')
      ).toBe(true);
      expect(
        container
          .querySelector('[data-task-id="warning-task"] .progress-bar')
          .classList.contains('bg-warning')
      ).toBe(true);
      expect(
        container
          .querySelector('[data-task-id="error-task"] .progress-bar')
          .classList.contains('bg-danger')
      ).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should unsubscribe from store on destroy', () => {
      taskProgress = new TaskProgress(container);

      expect(mockSubscribers.length).toBe(1);

      taskProgress.destroy();

      expect(mockSubscribers.length).toBe(0);
    });
  });
});
