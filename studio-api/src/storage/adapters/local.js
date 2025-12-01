/**
 * Local Filesystem Storage Adapter
 *
 * Wraps Node.js fs module with the standard storage interface.
 * Used when STORAGE_PROVIDER=local
 */

const fs = require('fs');
const path = require('path');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('LocalStorage');

function createLocalAdapter(basePath) {
  // ============================================================================
  // Directory Operations
  // ============================================================================

  async function ensureDir(dirPath) {
    const fullPath = resolvePath(dirPath);
    await fs.promises.mkdir(fullPath, { recursive: true });

    return fullPath;
  }

  // ============================================================================
  // File Operations
  // ============================================================================

  async function exists(filePath) {
    try {
      await fs.promises.access(resolvePath(filePath));

      return true;
    } catch {
      return false;
    }
  }

  async function read(filePath) {
    const fullPath = resolvePath(filePath);

    return fs.promises.readFile(fullPath);
  }

  async function write(filePath, data) {
    const fullPath = resolvePath(filePath);
    await ensureDir(path.dirname(fullPath));

    await fs.promises.writeFile(fullPath, data);
    logger.debug('Written file', { path: fullPath });

    return fullPath;
  }

  async function remove(filePath) {
    const fullPath = resolvePath(filePath);

    if (await exists(fullPath)) {
      await fs.promises.unlink(fullPath);
      logger.debug('Deleted file', { path: fullPath });

      return true;
    }

    return false;
  }

  async function removeDir(dirPath) {
    const fullPath = resolvePath(dirPath);

    if (await exists(fullPath)) {
      await fs.promises.rm(fullPath, { recursive: true, force: true });
      logger.debug('Deleted directory', { path: fullPath });

      return true;
    }

    return false;
  }

  // ============================================================================
  // JSON Operations
  // ============================================================================

  async function readJson(filePath) {
    try {
      const data = await read(filePath);

      return JSON.parse(data.toString('utf-8'));
    } catch {
      return null;
    }
  }

  async function writeJson(filePath, data) {
    const json = JSON.stringify(data, null, 2);

    return write(filePath, json);
  }

  // ============================================================================
  // Stream Operations
  // ============================================================================

  function createReadStream(filePath, options = {}) {
    const fullPath = resolvePath(filePath);

    return fs.createReadStream(fullPath, options);
  }

  function createWriteStream(filePath) {
    const fullPath = resolvePath(filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });

    return fs.createWriteStream(fullPath);
  }

  // ============================================================================
  // Directory Listing
  // ============================================================================

  async function list(dirPath) {
    const fullPath = resolvePath(dirPath);

    if (!(await exists(fullPath))) {
      return [];
    }

    return fs.promises.readdir(fullPath);
  }

  // ============================================================================
  // File Info
  // ============================================================================

  async function stat(filePath) {
    const fullPath = resolvePath(filePath);

    if (!(await exists(fullPath))) {
      return null;
    }

    return fs.promises.stat(fullPath);
  }

  // ============================================================================
  // Copy Operations
  // ============================================================================

  async function copy(srcPath, destPath) {
    const fullSrc = resolvePath(srcPath);
    const fullDest = resolvePath(destPath);
    await ensureDir(path.dirname(fullDest));

    await fs.promises.copyFile(fullSrc, fullDest);
    logger.debug('Copied file', { from: fullSrc, to: fullDest });

    return fullDest;
  }

  // ============================================================================
  // URL Generation (for serving files)
  // ============================================================================

  function getUrl(filePath) {
    // For local storage, return relative path for Express static serving
    return `/${filePath}`;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  function resolvePath(filePath) {
    // If already absolute, return as-is
    if (path.isAbsolute(filePath)) {
      return filePath;
    }

    // Otherwise resolve relative to basePath
    return path.join(basePath, filePath);
  }

  function getBasePath() {
    return basePath;
  }

  // ============================================================================
  // Export Interface
  // ============================================================================

  return {
    // Info
    type: 'local',
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
    getUrl
  };
}

module.exports = { createLocalAdapter };
