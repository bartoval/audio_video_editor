/**
 * File Repository
 *
 * Provides async file operations using the configured storage adapter.
 * Supports multi-cloud storage (local, Oracle, AWS, GCP, Hetzner).
 */

const storage = require('../storage');

function fileRepositoryCreator(_basePath) {
  // ============================================================================
  // Directory Operations
  // ============================================================================

  async function ensureDir(dirPath) {
    await storage.ensureDir(dirPath);

    return dirPath;
  }

  // ============================================================================
  // File Existence
  // ============================================================================

  async function exists(filePath) {
    return storage.exists(filePath);
  }

  // ============================================================================
  // JSON Operations
  // ============================================================================

  async function readJson(filePath) {
    return storage.readJson(filePath);
  }

  async function writeJson(filePath, data) {
    return storage.writeJson(filePath, data);
  }

  // ============================================================================
  // File Operations
  // ============================================================================

  async function deleteFile(filePath) {
    return storage.remove(filePath);
  }

  async function deleteDir(dirPath) {
    return storage.removeDir(dirPath);
  }

  // ============================================================================
  // Directory Listing
  // ============================================================================

  async function listDir(dirPath) {
    return storage.list(dirPath);
  }

  // ============================================================================
  // File Stats
  // ============================================================================

  async function getStats(filePath) {
    return storage.stat(filePath);
  }

  // ============================================================================
  // Stream Operations
  // ============================================================================

  function createReadStream(filePath, options) {
    return storage.createReadStream(filePath, options);
  }

  function createWriteStream(filePath) {
    return storage.createWriteStream(filePath);
  }

  // ============================================================================
  // Copy Operations
  // ============================================================================

  async function copyFile(src, dest) {
    return storage.copy(src, dest);
  }

  return {
    ensureDir,
    exists,
    readJson,
    writeJson,
    deleteFile,
    deleteDir,
    listDir,
    getStats,
    createReadStream,
    createWriteStream,
    copyFile,
    getStorageType: () => storage.type
  };
}

module.exports = { fileRepositoryCreator };
