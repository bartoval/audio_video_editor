/**
 * Storage Factory
 *
 * Creates the appropriate storage adapter based on STORAGE_PROVIDER config.
 * Provides a unified interface for file operations across different cloud providers.
 *
 * Usage:
 *   const storage = require('./storage');
 *   await storage.read('path/to/file');
 *   await storage.write('path/to/file', data);
 */

const config = require('../config');
const { createLocalAdapter } = require('./adapters/local');
const { createOracleAdapter } = require('./adapters/oracle');
const { createLogger } = require('../utils/logger');

const logger = createLogger('Storage');

// ============================================================================
// Adapter Factory
// ============================================================================

function createAdapter() {
  const { provider, config: providerConfig } = config.storage;

  switch (provider) {
    case 'local':
      logger.info('Using local filesystem storage', { basePath: config.projectsPath });

      return createLocalAdapter(config.projectsPath);

    case 'oracle':
      logger.info('Using Oracle Object Storage', {
        namespace: providerConfig.namespace,
        bucket: providerConfig.bucket,
        region: providerConfig.region
      });

      return createOracleAdapter(providerConfig);

    default:
      throw new Error(`Unknown storage provider: ${provider}`);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

const storage = createAdapter();

module.exports = storage;
