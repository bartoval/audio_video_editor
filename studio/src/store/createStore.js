// @ts-check

/**
 * Minimal store implementation with immutable updates and subscriptions
 *
 * @template T - State shape
 * @param {T} initialState - Initial state object
 * @param {{ actions?: Record<string, Function> }} [options={}] - Store options with action creators
 */
export function createStore(initialState, options = {}) {
  let state = { ...initialState };
  const subscribers = new Set();
  const { actions: actionCreators = {} } = options;

  function getState() {
    return state;
  }

  function setState(updater) {
    const newState = typeof updater === 'function' ? updater(state) : updater;

    if (newState === state) {
      return;
    }

    state = { ...state, ...newState };
    notify();
  }

  function subscribe(callback) {
    subscribers.add(callback);

    return () => subscribers.delete(callback);
  }

  function notify() {
    subscribers.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error('[Store] Subscriber error:', error);
      }
    });
  }

  const actions = {};

  Object.keys(actionCreators).forEach(actionName => {
    actions[actionName] = (...args) => {
      const result = actionCreators[actionName](state, ...args);

      if (result !== undefined) {
        setState(result);
      }
    };
  });

  return {
    getState,
    setState,
    subscribe,
    actions
  };
}
