// @ts-check

/**
 * Keycloak Authentication Service with PKCE
 * Handles OAuth2 Authorization Code Flow with PKCE for secure SPA authentication
 */

const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180';
const REALM = import.meta.env.VITE_KEYCLOAK_REALM || 'studio';
const CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'studio-app';
const DEV_DIRECT_LOGIN = import.meta.env.DEV && import.meta.env.VITE_DEV_LOGIN_ENABLED === 'true';
const DEV_USERNAME = import.meta.env.VITE_DEV_LOGIN_USERNAME;
const DEV_PASSWORD = import.meta.env.VITE_DEV_LOGIN_PASSWORD;
const DEV_CLIENT_SECRET = import.meta.env.VITE_DEV_LOGIN_CLIENT_SECRET;

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  TOKEN_EXPIRY: 'auth_token_expiry',
  CODE_VERIFIER: 'auth_code_verifier',
  REDIRECT_PATH: 'auth_redirect_path',
  USER_INFO: 'auth_user_info'
};

/**
 * Generate a cryptographically random code verifier for PKCE
 * @returns {string}
 */
function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);

  return base64UrlEncode(array);
}

/**
 * Generate code challenge from verifier using SHA-256
 * @param {string} verifier
 * @returns {Promise<string>}
 */
async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);

  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Base64 URL encode a byte array
 * @param {Uint8Array} buffer
 * @returns {string}
 */
function base64UrlEncode(buffer) {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Get the Keycloak endpoints
 */
function getEndpoints() {
  const baseUrl = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect`;

  return {
    authorize: `${baseUrl}/auth`,
    token: `${baseUrl}/token`,
    logout: `${baseUrl}/logout`,
    userinfo: `${baseUrl}/userinfo`
  };
}

/**
 * Initiate login flow - redirects to Keycloak
 * @param {string} [redirectPath] - Path to redirect to after login
 */
async function login(redirectPath = '/') {
  if (DEV_DIRECT_LOGIN && DEV_USERNAME && DEV_PASSWORD) {
    const ok = await loginWithPasswordGrant(DEV_USERNAME, DEV_PASSWORD);

    if (ok) {
      localStorage.setItem(STORAGE_KEYS.REDIRECT_PATH, redirectPath);
      await fetchUserInfo();

      return true;
    }
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  localStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, codeVerifier);
  localStorage.setItem(STORAGE_KEYS.REDIRECT_PATH, redirectPath);

  const redirectUri = `${window.location.origin}/callback`;
  const endpoints = getEndpoints();

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email offline_access',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: crypto.randomUUID()
  });

  console.log('[Auth] Starting login flow, redirect:', redirectUri);
  window.location.href = `${endpoints.authorize}?${params.toString()}`;

  return false;
}

/**
 * Handle OAuth callback - exchange code for tokens
 * @param {string} code - Authorization code from callback
 * @returns {Promise<boolean>} - Success status
 */
async function handleCallback(code) {
  console.log('[Auth] Handling callback with code:', code.substring(0, 10) + '...');

  const codeVerifier = localStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);
  if (!codeVerifier) {
    console.error('[Auth] No code verifier found in localStorage');

    return false;
  }

  const endpoints = getEndpoints();
  const redirectUri = `${window.location.origin}/callback`;

  console.log('[Auth] Token endpoint:', endpoints.token);
  console.log('[Auth] Redirect URI:', redirectUri);

  try {
    const response = await fetch(endpoints.token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Auth] Token exchange failed:', response.status, errorText);

      return false;
    }

    /** @type {import('@types').TokenResponse} */
    const tokens = await response.json();
    console.log('[Auth] Token exchange successful');

    storeTokens(tokens);
    localStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);

    await fetchUserInfo();

    return true;
  } catch (err) {
    console.error('[Auth] Token exchange error:', err);

    return false;
  }
}

/**
 * Store tokens in appropriate storage
 * @param {import('@types').TokenResponse} tokens
 */
function storeTokens(tokens) {
  const expiryTime = Date.now() + tokens.expires_in * 1000;

  sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token);
  localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);
  localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());
}

/**
 * Fetch and store user info from Keycloak
 * @returns {Promise<import('@types').UserInfo|null>}
 */
async function fetchUserInfo() {
  const token = getAccessToken();
  if (!token) return null;

  const endpoints = getEndpoints();

  try {
    const response = await fetch(endpoints.userinfo, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) return null;

    /** @type {import('@types').UserInfo} */
    const userInfo = await response.json();
    localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(userInfo));

    return userInfo;
  } catch (err) {
    console.error('Failed to fetch user info', err);

    return null;
  }
}

/**
 * Get stored access token
 * @returns {string|null}
 */
function getAccessToken() {
  return sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

/**
 * Get stored refresh token
 * @returns {string|null}
 */
function getRefreshToken() {
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

/**
 * Get stored user info
 * @returns {import('@types').UserInfo|null}
 */
function getUserInfo() {
  const stored = localStorage.getItem(STORAGE_KEYS.USER_INFO);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
function isAuthenticated() {
  const token = getAccessToken();
  const expiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);

  if (!token || !expiry) return false;

  return Date.now() < parseInt(expiry, 10);
}

/**
 * Check if token needs refresh (within 1 minute of expiry)
 * @returns {boolean}
 */
function needsRefresh() {
  const expiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
  if (!expiry) return false;

  const expiryTime = parseInt(expiry, 10);
  const oneMinuteFromNow = Date.now() + 60000;

  return expiryTime < oneMinuteFromNow;
}

/**
 * Refresh the access token using refresh token
 * @returns {Promise<boolean>}
 */
async function refreshToken() {
  const refreshTokenValue = getRefreshToken();
  if (!refreshTokenValue) return false;

  const endpoints = getEndpoints();

  try {
    const response = await fetch(endpoints.token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: CLIENT_ID,
        refresh_token: refreshTokenValue
      })
    });

    if (!response.ok) {
      console.error('Token refresh failed');
      clearTokens();

      return false;
    }

    /** @type {import('@types').TokenResponse} */
    const tokens = await response.json();
    storeTokens(tokens);

    return true;
  } catch (err) {
    console.error('Token refresh error', err);
    clearTokens();

    return false;
  }
}

/**
 * Clear all stored tokens
 */
function clearTokens() {
  sessionStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
  localStorage.removeItem(STORAGE_KEYS.USER_INFO);
}

/**
 * Logout user - redirects to Keycloak logout
 * @param {string} [redirectPath] - Path to redirect to after logout
 */
function logout(redirectPath = '/') {
  const refreshTokenValue = getRefreshToken();
  const endpoints = getEndpoints();

  clearTokens();

  const redirectUri = `${window.location.origin}${redirectPath}`;
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    post_logout_redirect_uri: redirectUri
  });

  if (refreshTokenValue) {
    params.set('refresh_token', refreshTokenValue);
  }

  window.location.href = `${endpoints.logout}?${params.toString()}`;
}

/**
 * Initialize auth state - check for stored tokens and setup refresh
 * @returns {Promise<boolean>} - Whether user is authenticated
 */
async function init() {
  if (!isAuthenticated()) {
    const refreshed = await refreshToken();
    if (!refreshed) {
      clearTokens();

      return false;
    }
  }

  if (needsRefresh()) {
    await refreshToken();
  }

  setupAutoRefresh();

  return isAuthenticated();
}

/**
 * Login using Resource Owner Password flow (dev only)
 * @param {string} username
 * @param {string} password
 * @returns {Promise<boolean>}
 */
async function loginWithPasswordGrant(username, password) {
  const endpoints = getEndpoints();
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: CLIENT_ID,
    username,
    password,
    scope: 'openid profile email offline_access'
  });

  if (DEV_CLIENT_SECRET) {
    params.set('client_secret', DEV_CLIENT_SECRET);
  }

  try {
    const response = await fetch(endpoints.token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[Auth] Dev password grant failed:', response.status, body);

      return false;
    }

    /** @type {import('@types').TokenResponse} */
    const tokens = await response.json();
    storeTokens(tokens);

    return true;
  } catch (err) {
    console.error('[Auth] Dev password grant error:', err);

    return false;
  }
}

let refreshInterval = null;

/**
 * Setup automatic token refresh
 */
function setupAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }

  refreshInterval = setInterval(async () => {
    if (needsRefresh()) {
      const success = await refreshToken();
      if (!success) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    }
  }, 30000);
}

/**
 * Get redirect path stored before login
 * @returns {string}
 */
function getRedirectPath() {
  const path = localStorage.getItem(STORAGE_KEYS.REDIRECT_PATH);
  localStorage.removeItem(STORAGE_KEYS.REDIRECT_PATH);

  return path || '/';
}

export const authService = {
  login,
  logout,
  handleCallback,
  refreshToken,
  init,
  isAuthenticated,
  getAccessToken,
  getUserInfo,
  getRedirectPath,
  clearTokens
};

export default authService;
