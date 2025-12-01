import { describe, it, expect, beforeEach, vi } from 'vitest';
import uiStore from '../uiStore.js';

describe('uiStore', () => {
  beforeEach(() => {
    // Reset store state
    uiStore.actions.clearAllTasks();
    uiStore.actions.clearAllToasts();
  });

  describe('initial state', () => {
    it('has empty tasks object', () => {
      const state = uiStore.getState();

      expect(state.tasks).toEqual({});
    });

    it('has empty toasts array', () => {
      const state = uiStore.getState();

      expect(state.toasts).toEqual([]);
    });
  });

  describe('setTaskStatus', () => {
    it('sets a new task status', () => {
      uiStore.actions.setTaskStatus('upload', { status: 'Uploading...' });

      const state = uiStore.getState();

      expect(state.tasks.upload).toEqual({ status: 'Uploading...' });
    });

    it('sets task with progress', () => {
      uiStore.actions.setTaskStatus('upload', { status: 'Uploading...', progress: 50 });

      const state = uiStore.getState();

      expect(state.tasks.upload.progress).toBe(50);
    });

    it('sets task with type', () => {
      uiStore.actions.setTaskStatus('upload', { status: 'Error', type: 'error' });

      const state = uiStore.getState();

      expect(state.tasks.upload.type).toBe('error');
    });

    it('updates existing task', () => {
      uiStore.actions.setTaskStatus('upload', { status: 'Starting...', progress: 0 });
      uiStore.actions.setTaskStatus('upload', { status: 'In progress...', progress: 50 });

      const state = uiStore.getState();

      expect(state.tasks.upload.status).toBe('In progress...');
      expect(state.tasks.upload.progress).toBe(50);
    });

    it('handles multiple tasks', () => {
      uiStore.actions.setTaskStatus('task1', { status: 'Task 1' });
      uiStore.actions.setTaskStatus('task2', { status: 'Task 2' });

      const state = uiStore.getState();

      expect(Object.keys(state.tasks)).toHaveLength(2);
      expect(state.tasks.task1.status).toBe('Task 1');
      expect(state.tasks.task2.status).toBe('Task 2');
    });

    it('does not include undefined optional fields', () => {
      uiStore.actions.setTaskStatus('upload', { status: 'Test' });

      const state = uiStore.getState();

      expect(state.tasks.upload).not.toHaveProperty('progress');
      expect(state.tasks.upload).not.toHaveProperty('type');
    });
  });

  describe('clearTaskStatus', () => {
    it('removes a task by id', () => {
      uiStore.actions.setTaskStatus('task1', { status: 'Task 1' });
      uiStore.actions.setTaskStatus('task2', { status: 'Task 2' });
      uiStore.actions.clearTaskStatus('task1');

      const state = uiStore.getState();

      expect(state.tasks.task1).toBeUndefined();
      expect(state.tasks.task2).toBeDefined();
    });

    it('handles clearing non-existent task', () => {
      uiStore.actions.clearTaskStatus('nonexistent');

      const state = uiStore.getState();

      expect(state.tasks).toEqual({});
    });
  });

  describe('clearAllTasks', () => {
    it('removes all tasks', () => {
      uiStore.actions.setTaskStatus('task1', { status: 'Task 1' });
      uiStore.actions.setTaskStatus('task2', { status: 'Task 2' });
      uiStore.actions.clearAllTasks();

      const state = uiStore.getState();

      expect(state.tasks).toEqual({});
    });
  });

  describe('pushToast', () => {
    it('adds a toast with auto-generated id', () => {
      uiStore.actions.pushToast({ type: 'success', msg: 'Saved!' });

      const state = uiStore.getState();

      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].id).toMatch(/^toast-\d+$/);
    });

    it('adds toast with type and message', () => {
      uiStore.actions.pushToast({ type: 'error', msg: 'Failed to save' });

      const state = uiStore.getState();
      const toast = state.toasts[0];

      expect(toast.type).toBe('error');
      expect(toast.msg).toBe('Failed to save');
    });

    it('defaults type to info', () => {
      uiStore.actions.pushToast({ msg: 'Info message' });

      const state = uiStore.getState();

      expect(state.toasts[0].type).toBe('info');
    });

    it('includes optional details', () => {
      uiStore.actions.pushToast({ type: 'error', msg: 'Error', details: 'Stack trace...' });

      const state = uiStore.getState();

      expect(state.toasts[0].details).toBe('Stack trace...');
    });

    it('includes optional timeHide', () => {
      uiStore.actions.pushToast({ type: 'success', msg: 'Saved', timeHide: 3000 });

      const state = uiStore.getState();

      expect(state.toasts[0].timeHide).toBe(3000);
    });

    it('adds multiple toasts in order', () => {
      uiStore.actions.pushToast({ type: 'info', msg: 'First' });
      uiStore.actions.pushToast({ type: 'info', msg: 'Second' });
      uiStore.actions.pushToast({ type: 'info', msg: 'Third' });

      const state = uiStore.getState();

      expect(state.toasts).toHaveLength(3);
      expect(state.toasts[0].msg).toBe('First');
      expect(state.toasts[1].msg).toBe('Second');
      expect(state.toasts[2].msg).toBe('Third');
    });

    it('generates unique ids for each toast', () => {
      uiStore.actions.pushToast({ msg: 'Toast 1' });
      uiStore.actions.pushToast({ msg: 'Toast 2' });

      const state = uiStore.getState();

      expect(state.toasts[0].id).not.toBe(state.toasts[1].id);
    });
  });

  describe('removeToast', () => {
    it('removes a toast by id', () => {
      uiStore.actions.pushToast({ msg: 'First' });
      uiStore.actions.pushToast({ msg: 'Second' });

      const state = uiStore.getState();
      const firstToastId = state.toasts[0].id;

      uiStore.actions.removeToast(firstToastId);

      const newState = uiStore.getState();

      expect(newState.toasts).toHaveLength(1);
      expect(newState.toasts[0].msg).toBe('Second');
    });

    it('handles removing non-existent toast', () => {
      uiStore.actions.pushToast({ msg: 'First' });
      uiStore.actions.removeToast('nonexistent-id');

      const state = uiStore.getState();

      expect(state.toasts).toHaveLength(1);
    });
  });

  describe('clearAllToasts', () => {
    it('removes all toasts', () => {
      uiStore.actions.pushToast({ msg: 'First' });
      uiStore.actions.pushToast({ msg: 'Second' });
      uiStore.actions.clearAllToasts();

      const state = uiStore.getState();

      expect(state.toasts).toEqual([]);
    });
  });

  describe('refreshInspector', () => {
    it('sets inspectorRefresh to current timestamp', () => {
      const before = Date.now();
      uiStore.actions.refreshInspector();
      const after = Date.now();

      const state = uiStore.getState();

      expect(state.inspectorRefresh).toBeGreaterThanOrEqual(before);
      expect(state.inspectorRefresh).toBeLessThanOrEqual(after);
    });
  });

  describe('subscription', () => {
    it('notifies subscribers on state change', () => {
      const callback = vi.fn();
      const unsubscribe = uiStore.subscribe(callback);

      uiStore.actions.pushToast({ msg: 'Test' });

      expect(callback).toHaveBeenCalled();

      unsubscribe();
    });

    it('stops notifying after unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = uiStore.subscribe(callback);

      unsubscribe();
      uiStore.actions.pushToast({ msg: 'Test' });

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
