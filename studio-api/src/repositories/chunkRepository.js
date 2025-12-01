const fs = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');
const config = require('../config');

const logger = createLogger('ChunkRepository');

function chunkRepositoryCreator() {
  const tmpDir = config.tmpChunksPath;

  // Ensure tmp directory exists
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  function cleanIdentifier(identifier) {
    return identifier.replace(/[^0-9A-Za-z_-]/g, '');
  }

  function getChunkPath(chunkNumber, identifier) {
    return path.join(tmpDir, `flow-${cleanIdentifier(identifier)}.${chunkNumber}`);
  }

  function chunkExists(chunkNumber, identifier) {
    return fs.existsSync(getChunkPath(chunkNumber, identifier));
  }

  async function saveChunk(file, chunkNumber, identifier) {
    const chunkPath = getChunkPath(chunkNumber, identifier);

    return new Promise((resolve, reject) => {
      fs.copyFile(file.path, chunkPath, err => {
        if (err) {
          reject(err);

          return;
        }

        // Clean up temp file
        fs.unlink(file.path, () => {});
        resolve(chunkPath);
      });
    });
  }

  function allChunksExist(totalChunks, identifier) {
    for (let i = 1; i <= totalChunks; i++) {
      if (!chunkExists(i, identifier)) {
        return false;
      }
    }

    return true;
  }

  function assembleChunks(identifier, totalChunks, outputStream) {
    return new Promise((resolve, reject) => {
      let currentChunk = 1;

      const pipeNext = () => {
        if (currentChunk > totalChunks) {
          outputStream.end();
          resolve();

          return;
        }

        const chunkPath = getChunkPath(currentChunk, identifier);
        const readStream = fs.createReadStream(chunkPath);

        readStream.pipe(outputStream, { end: false });
        readStream.on('end', () => {
          currentChunk++;
          pipeNext();
        });
        readStream.on('error', reject);
      };

      pipeNext();
    });
  }

  function cleanChunks(identifier) {
    let chunkNumber = 1;

    while (true) {
      const chunkPath = getChunkPath(chunkNumber, identifier);

      if (fs.existsSync(chunkPath)) {
        fs.unlinkSync(chunkPath);
        chunkNumber++;
      } else {
        break;
      }
    }

    logger.debug('Cleaned chunks', { identifier, count: chunkNumber - 1 });
  }

  return {
    getChunkPath,
    chunkExists,
    saveChunk,
    allChunksExist,
    assembleChunks,
    cleanChunks
  };
}

module.exports = { chunkRepositoryCreator };
