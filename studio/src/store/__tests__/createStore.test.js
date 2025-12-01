import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore } from '../createStore.js';

describe('createStore', () => {
  describe('basic store operations', () => {
    let store;

    beforeEach(() => {
      store = createStore({ count: 0, name: 'test' });
    });

    it('creates store with initial state', () => {
      expect(store.getState()).toEqual({ count: 0, name: 'test' });
    });

    it('updates state with object', () => {
      store.setState({ count: 5 });
      expect(store.getState()).toEqual({ count: 5, name: 'test' });
    });

    it('updates state with function', () => {
      store.setState(state => ({ count: state.count + 1 }));
      expect(store.getState()).toEqual({ count: 1, name: 'test' });
    });

    it('merges state shallowly', () => {
      store.setState({ count: 10 });
      expect(store.getState()).toEqual({ count: 10, name: 'test' });
    });

    it('does not notify if state reference unchanged', () => {
      const callback = vi.fn();
      store.subscribe(callback);

      const currentState = store.getState();
      store.setState(currentState);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('subscriptions', () => {
    it('notifies subscribers on state change', () => {
      const store = createStore({ count: 0 });
      const callback = vi.fn();

      store.subscribe(callback);
      store.setState({ count: 1 });

      expect(callback).toHaveBeenCalledWith({ count: 1 });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('supports multiple subscribers', () => {
      const store = createStore({ count: 0 });
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      store.subscribe(callback1);
      store.subscribe(callback2);
      store.setState({ count: 1 });

      expect(callback1).toHaveBeenCalledWith({ count: 1 });
      expect(callback2).toHaveBeenCalledWith({ count: 1 });
    });

    it('unsubscribes correctly', () => {
      const store = createStore({ count: 0 });
      const callback = vi.fn();

      const unsubscribe = store.subscribe(callback);
      unsubscribe();
      store.setState({ count: 1 });

      expect(callback).not.toHaveBeenCalled();
    });

    it('handles subscriber errors gracefully', () => {
      const store = createStore({ count: 0 });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorCallback = vi.fn(() => {
        throw new Error('Subscriber error');
      });
      const goodCallback = vi.fn();

      store.subscribe(errorCallback);
      store.subscribe(goodCallback);
      store.setState({ count: 1 });

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(goodCallback).toHaveBeenCalledWith({ count: 1 });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('actions', () => {
    it('creates action methods from action creators', () => {
      const store = createStore(
        { count: 0 },
        {
          actions: {
            increment: state => ({ count: state.count + 1 }),
            decrement: state => ({ count: state.count - 1 })
          }
        }
      );

      expect(store.actions).toHaveProperty('increment');
      expect(store.actions).toHaveProperty('decrement');
      expect(typeof store.actions.increment).toBe('function');
      expect(typeof store.actions.decrement).toBe('function');
    });

    it('executes actions and updates state', () => {
      const store = createStore(
        { count: 0 },
        {
          actions: {
            increment: state => ({ count: state.count + 1 }),
            setCount: (state, value) => ({ count: value })
          }
        }
      );

      store.actions.increment();
      expect(store.getState().count).toBe(1);

      store.actions.setCount(10);
      expect(store.getState().count).toBe(10);
    });

    it('passes multiple arguments to action creators', () => {
      const store = createStore(
        { sum: 0 },
        {
          actions: {
            add: (state, a, b) => ({ sum: a + b })
          }
        }
      );

      store.actions.add(5, 10);
      expect(store.getState().sum).toBe(15);
    });

    it('does not update state if action returns undefined', () => {
      const callback = vi.fn();
      const store = createStore(
        { count: 0 },
        {
          actions: {
            noOp: state => {
              // returns undefined
            }
          }
        }
      );

      store.subscribe(callback);
      store.actions.noOp();

      expect(callback).not.toHaveBeenCalled();
      expect(store.getState().count).toBe(0);
    });

    it('notifies subscribers when actions update state', () => {
      const callback = vi.fn();
      const store = createStore(
        { count: 0 },
        {
          actions: {
            increment: state => ({ count: state.count + 1 })
          }
        }
      );

      store.subscribe(callback);
      store.actions.increment();

      expect(callback).toHaveBeenCalledWith({ count: 1 });
    });
  });

  describe('immutability', () => {
    it('returns new state object on update', () => {
      const store = createStore({ count: 0 });
      const state1 = store.getState();

      store.setState({ count: 1 });
      const state2 = store.getState();

      expect(state1).not.toBe(state2);
      expect(state1.count).toBe(0);
      expect(state2.count).toBe(1);
    });

    it('does not mutate initial state', () => {
      const initialState = { count: 0, nested: { value: 1 } };
      const store = createStore(initialState);

      store.setState({ count: 5 });

      expect(initialState.count).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles empty initial state', () => {
      const store = createStore({});
      expect(store.getState()).toEqual({});
    });

    it('handles no actions', () => {
      const store = createStore({ count: 0 }, {});
      expect(store.actions).toEqual({});
    });

    it('handles state with null/undefined values', () => {
      const store = createStore({ foo: null, bar: undefined });
      expect(store.getState()).toEqual({ foo: null, bar: undefined });
    });
  });
});
