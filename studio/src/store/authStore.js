// @ts-check
import { createStore } from './createStore';
import authService from '../services/auth';

/** @type {import('@types').AuthState} */
const initialState = {
  status: 'idle',
  user: null,
  error: null
};

const actions = {
  /**
   * Set loading state
   * @param {import('@types').AuthState} state
   * @returns {Partial<import('@types').AuthState>}
   */
  setLoading(_state) {
    return { status: 'loading', error: null };
  },

  /**
   * Set authenticated state with user info
   * @param {import('@types').AuthState} state
   * @param {import('@types').UserInfo} user
   * @returns {Partial<import('@types').AuthState>}
   */
  setAuthenticated(state, user) {
    return { status: 'authenticated', user, error: null };
  },

  /**
   * Set unauthenticated state
   * @param {import('@types').AuthState} state
   * @param {string} [error]
   * @returns {Partial<import('@types').AuthState>}
   */
  setUnauthenticated(state, error = null) {
    return { status: 'unauthenticated', user: null, error };
  },

  /**
   * Clear error
   * @param {import('@types').AuthState} state
   * @returns {Partial<import('@types').AuthState>}
   */
  clearError(_state) {
    return { error: null };
  }
};

const authStore = createStore(initialState, { actions });

/**
 * Initialize authentication state
 * Checks for existing session and refreshes token if needed
 * @returns {Promise<boolean>}
 */
export async function initAuth() {
  authStore.actions.setLoading();

  try {
    const isAuthenticated = await authService.init();

    if (isAuthenticated) {
      const user = authService.getUserInfo();
      if (user) {
        authStore.actions.setAuthenticated(user);

        return true;
      }
    }

    authStore.actions.setUnauthenticated();

    return false;
  } catch (err) {
    console.error('Auth initialization failed', err);
    authStore.actions.setUnauthenticated(err.message);

    return false;
  }
}

/**
 * Handle OAuth callback
 * @param {string} code - Authorization code
 * @returns {Promise<boolean>}
 */
export async function handleAuthCallback(code) {
  authStore.actions.setLoading();

  try {
    const success = await authService.handleCallback(code);

    if (success) {
      const user = authService.getUserInfo();
      if (user) {
        authStore.actions.setAuthenticated(user);

        return true;
      }
    }

    authStore.actions.setUnauthenticated('Authentication failed');

    return false;
  } catch (err) {
    console.error('Auth callback failed', err);
    authStore.actions.setUnauthenticated(err.message);

    return false;
  }
}

/**
 * Initiate login
 * @param {string} [redirectPath]
 */
export function login(redirectPath) {
  return authService.login(redirectPath);
}

/**
 * Logout user
 * @param {string} [redirectPath]
 */
export function logout(redirectPath) {
  authStore.actions.setUnauthenticated();
  authService.logout(redirectPath);
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
  return authStore.getState().status === 'authenticated';
}

/**
 * Get current user
 * @returns {import('@types').UserInfo|null}
 */
export function getUser() {
  return authStore.getState().user;
}

export default authStore;
