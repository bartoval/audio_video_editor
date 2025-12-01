/**
 * Oracle Cloud Infrastructure (OCI) Object Storage Adapter
 *
 * Uses OCI SDK for Object Storage operations.
 * Used when STORAGE_PROVIDER=oracle
 *
 * Requires: npm install oci-objectstorage oci-common
 * Docs: https://docs.oracle.com/en-us/iaas/Content/Object/Concepts/objectstorageoverview.htm
 */

const path = require('path');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('OracleStorage');

// Lazy load OCI SDK (only when oracle provider is used)
let objectStorageClient = null;
let commonSdk = null;

function getOciSdk() {
  if (!commonSdk) {
    try {
      commonSdk = require('oci-common');
    } catch {
      throw new Error('OCI SDK not installed. Run: npm install oci-common oci-objectstorage');
    }
  }

  return commonSdk;
}

function getObjectStorageClient(config) {
  if (!objectStorageClient) {
    const oci = getOciSdk();
    const objectStorage = require('oci-objectstorage');

    // Create authentication provider
    const provider = new oci.ConfigFileAuthenticationDetailsProvider(
      config.auth.privateKeyPath,
      'DEFAULT'
    );

    objectStorageClient = new objectStorage.ObjectStorageClient({
      authenticationDetailsProvider: provider
    });

    objectStorageClient.region = config.region;
    logger.info('OCI ObjectStorage client initialized', { region: config.region });
  }

  return objectStorageClient;
}

function createOracleAdapter(config) {
  const { namespace, bucket } = config;

  function getClient() {
    return getObjectStorageClient(config);
  }

  // ============================================================================
  // Directory Operations (virtual in object storage)
  // ============================================================================

  function ensureDir() {
    // Object storage doesn't have real directories - they're virtual
    // No-op for compatibility
    return true;
  }

  // ============================================================================
  // File Operations
  // ============================================================================

  async function exists(objectName) {
    try {
      const client = getClient();

      await client.headObject({
        namespaceName: namespace,
        bucketName: bucket,
        objectName: normalizeKey(objectName)
      });

      return true;
    } catch (err) {
      if (err.statusCode === 404) {
        return false;
      }

      throw err;
    }
  }

  async function read(objectName) {
    const client = getClient();

    const response = await client.getObject({
      namespaceName: namespace,
      bucketName: bucket,
      objectName: normalizeKey(objectName)
    });

    // Convert stream to buffer
    const chunks = [];

    for await (const chunk of response.value) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  async function write(objectName, data) {
    const client = getClient();
    const key = normalizeKey(objectName);
    const contentLength = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);

    await client.putObject({
      namespaceName: namespace,
      bucketName: bucket,
      objectName: key,
      contentLength,
      putObjectBody: data
    });

    logger.debug('Uploaded object', { key, size: contentLength });

    return key;
  }

  async function remove(objectName) {
    try {
      const client = getClient();

      await client.deleteObject({
        namespaceName: namespace,
        bucketName: bucket,
        objectName: normalizeKey(objectName)
      });

      logger.debug('Deleted object', { key: objectName });

      return true;
    } catch (err) {
      if (err.statusCode === 404) {
        return false;
      }

      throw err;
    }
  }

  async function removeDir(prefix) {
    // Delete all objects with prefix
    const objects = await list(prefix);

    for (const obj of objects) {
      await remove(`${prefix}/${obj}`);
    }

    logger.debug('Deleted prefix', { prefix, count: objects.length });

    return true;
  }

  // ============================================================================
  // JSON Operations
  // ============================================================================

  async function readJson(objectName) {
    try {
      const data = await read(objectName);

      return JSON.parse(data.toString('utf-8'));
    } catch {
      return null;
    }
  }

  async function writeJson(objectName, data) {
    const json = JSON.stringify(data, null, 2);

    return write(objectName, json);
  }

  // ============================================================================
  // Stream Operations
  // ============================================================================

  async function createReadStream(objectName, options = {}) {
    const client = getClient();
    const key = normalizeKey(objectName);

    const requestOptions = {
      namespaceName: namespace,
      bucketName: bucket,
      objectName: key
    };

    // Handle range requests for video streaming
    if (options.start !== undefined || options.end !== undefined) {
      const start = options.start || 0;
      const end = options.end || '';
      requestOptions.range = `bytes=${start}-${end}`;
    }

    const response = await client.getObject(requestOptions);

    return response.value;
  }

  function createWriteStream(objectName) {
    // For streaming uploads, create a passthrough stream
    // and upload when complete
    const { PassThrough } = require('stream');
    const passThrough = new PassThrough();
    const chunks = [];

    passThrough.on('data', chunk => chunks.push(chunk));
    passThrough.on('end', async () => {
      const buffer = Buffer.concat(chunks);
      await write(objectName, buffer);
    });

    return passThrough;
  }

  // ============================================================================
  // Directory Listing
  // ============================================================================

  async function list(prefix = '') {
    const client = getClient();
    const normalizedPrefix = normalizeKey(prefix);

    const response = await client.listObjects({
      namespaceName: namespace,
      bucketName: bucket,
      prefix: normalizedPrefix,
      delimiter: '/'
    });

    const objects = response.listObjects.objects || [];

    return objects.map(obj => path.basename(obj.name));
  }

  // ============================================================================
  // File Info
  // ============================================================================

  async function stat(objectName) {
    try {
      const client = getClient();

      const response = await client.headObject({
        namespaceName: namespace,
        bucketName: bucket,
        objectName: normalizeKey(objectName)
      });

      return {
        size: parseInt(response.contentLength, 10),
        mtime: new Date(response.lastModified),
        isFile: () => true,
        isDirectory: () => false
      };
    } catch {
      return null;
    }
  }

  // ============================================================================
  // Copy Operations
  // ============================================================================

  async function copy(srcKey, destKey) {
    const client = getClient();

    await client.copyObject({
      namespaceName: namespace,
      bucketName: bucket,
      copyObjectDetails: {
        sourceObjectName: normalizeKey(srcKey),
        destinationRegion: config.region,
        destinationNamespace: namespace,
        destinationBucket: bucket,
        destinationObjectName: normalizeKey(destKey)
      }
    });

    logger.debug('Copied object', { from: srcKey, to: destKey });

    return destKey;
  }

  // ============================================================================
  // URL Generation
  // ============================================================================

  function getUrl(objectName) {
    // Generate pre-authenticated request URL or public URL
    // For now return the object path - implement PAR later if needed
    return `https://objectstorage.${config.region}.oraclecloud.com/n/${namespace}/b/${bucket}/o/${normalizeKey(objectName)}`;
  }

  async function getSignedUrl(objectName, expirationSeconds = 3600) {
    const client = getClient();
    const key = normalizeKey(objectName);

    const response = await client.createPreauthenticatedRequest({
      namespaceName: namespace,
      bucketName: bucket,
      createPreauthenticatedRequestDetails: {
        name: `par-${Date.now()}`,
        objectName: key,
        accessType: 'ObjectRead',
        timeExpires: new Date(Date.now() + expirationSeconds * 1000)
      }
    });

    return `https://objectstorage.${config.region}.oraclecloud.com${response.preauthenticatedRequest.accessUri}`;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  function normalizeKey(key) {
    // Remove leading slash, normalize path separators
    return key.replace(/^\/+/, '').replace(/\\/g, '/');
  }

  function getBasePath() {
    return `${namespace}/${bucket}`;
  }

  function resolvePath(filePath) {
    return normalizeKey(filePath);
  }

  // ============================================================================
  // Export Interface
  // ============================================================================

  return {
    // Info
    type: 'oracle',
    getBasePath,
    resolvePath,

    // Directory
    ensureDir,

    // Files
    exists,
    read,
    write,
    remove,
    removeDir,

    // JSON
    readJson,
    writeJson,

    // Streams
    createReadStream,
    createWriteStream,

    // Listing
    list,
    stat,

    // Copy
    copy,

    // URLs
    getUrl,
    getSignedUrl
  };
}

module.exports = { createOracleAdapter };
