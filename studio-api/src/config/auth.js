// @ts-check

/**
 * Keycloak Authentication Configuration
 * @typedef {Object} AuthConfig
 * @property {string} keycloakUrl - Keycloak server URL
 * @property {string} realm - Keycloak realm name
 * @property {string} clientId - API client ID
 * @property {string} jwksUri - JWKS endpoint for token validation
 * @property {string} issuer - Token issuer URL
 * @property {number} tokenCacheTtl - Public key cache TTL in seconds
 */

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8180';
const REALM = process.env.KEYCLOAK_REALM || 'studio';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'studio-api';

/** @type {AuthConfig} */
const authConfig = {
  keycloakUrl: KEYCLOAK_URL,
  realm: REALM,
  clientId: CLIENT_ID,
  jwksUri: `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/certs`,
  issuer: `${KEYCLOAK_URL}/realms/${REALM}`,
  tokenCacheTtl: 3600
};

module.exports = authConfig;
