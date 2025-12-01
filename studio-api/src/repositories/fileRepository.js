const fs = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');

const logger = createLogger('FileRepository');

function fileRepositoryCreator(basePath) {
  function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.debug('Created directory', { path: dirPath });
    }

    return dirPath;
  }

  function exists(filePath) {
    return fs.existsSync(filePath);
  }

  function readJson(filePath) {
    if (!exists(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      return JSON.parse(content);
    } catch (err) {
      logger.error('Failed to read JSON', { path: filePath, error: err.message });

      return null;
    }
  }

  function writeJson(filePath, data) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    logger.debug('Written JSON file', { path: filePath });
  }

  function deleteFile(filePath) {
    if (exists(filePath)) {
      fs.unlinkSync(filePath);
      logger.debug('Deleted file', { path: filePath });

      return true;
    }

    return false;
  }

  function deleteDir(dirPath) {
    if (exists(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      logger.debug('Deleted directory', { path: dirPath });

      return true;
    }

    return false;
  }

  function listDir(dirPath) {
    if (!exists(dirPath)) {
      return [];
    }

    return fs.readdirSync(dirPath);
  }

  function getStats(filePath) {
    if (!exists(filePath)) {
      return null;
    }

    return fs.statSync(filePath);
  }

  function createReadStream(filePath, options) {
    return fs.createReadStream(filePath, options);
  }

  function createWriteStream(filePath) {
    ensureDir(path.dirname(filePath));

    return fs.createWriteStream(filePath);
  }

  function copyFile(src, dest) {
    ensureDir(path.dirname(dest));

    return new Promise((resolve, reject) => {
      fs.copyFile(src, dest, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
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
    copyFile
  };
}

module.exports = { fileRepositoryCreator };
