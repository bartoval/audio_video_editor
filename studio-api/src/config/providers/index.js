/**
 * Storage Provider Configuration Loader
 *
 * Loads the appropriate provider config based on STORAGE_PROVIDER env var.
 * Supports: local, oracle (add more as needed)
 *
 * Usage:
 *   STORAGE_PROVIDER=local  → filesystem storage
 *   STORAGE_PROVIDER=oracle → Oracle Object Storage
 */

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'local';

const providers = {
  local: () => require('./local'),
  oracle: () => require('./oracle')
  // Add more providers here: aws, gcp, hetzner, etc.
};

function loadProvider(name) {
  const loader = providers[name];

  if (!loader) {
    throw new Error(
      `Unknown storage provider: ${name}. Available: ${Object.keys(providers).join(', ')}`
    );
  }

  return loader();
}

module.exports = {
  current: STORAGE_PROVIDER,
  config: loadProvider(STORAGE_PROVIDER),
  available: Object.keys(providers)
};
