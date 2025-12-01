const fs = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');
const config = require('../config');

const logger = createLogger('ChunkRepository');

function chunkRepositoryCreator() {
  const tmpDir = config.tmpChunksPath;
  let initialized = false;

  async function ensureInit() {
    if (!initialized) {
      await fs.promises.mkdir(tmpDir, { recursive: true });
      initialized = true;
    }
  }

  function cleanIdentifier(identifier) {
    return identifier.replace(/[^0-9A-Za-z_-]/g, '');
  }

  function getChunkPath(chunkNumber, identifier) {
    return path.join(tmpDir, `flow-${cleanIdentifier(identifier)}.${chunkNumber}`);
  }

  async function chunkExists(chunkNumber, identifier) {
    try {
      await fs.promises.access(getChunkPath(chunkNumber, identifier));

      return true;
    } catch {
      return false;
    }
  }

  async function saveChunk(file, chunkNumber, identifier) {
    await ensureInit();
    const chunkPath = getChunkPath(chunkNumber, identifier);

    await fs.promises.copyFile(file.path, chunkPath);
    fs.promises.unlink(file.path).catch(() => {});

    return chunkPath;
  }

  async function allChunksExist(totalChunks, identifier) {
    for (let i = 1; i <= totalChunks; i++) {
      if (!(await chunkExists(i, identifier))) {
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

  async function cleanChunks(identifier) {
    let chunkNumber = 1;

    while (true) {
      const chunkPath = getChunkPath(chunkNumber, identifier);

      try {
        await fs.promises.access(chunkPath);
        await fs.promises.unlink(chunkPath);
        chunkNumber++;
      } catch {
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
