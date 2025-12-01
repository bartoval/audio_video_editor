const fs = require('fs');
const crypto = require('crypto');

/**
 * Compute SHA1 hash of a file
 * @param {string} filePath
 * @returns {Promise<string>} hex hash
 */
function computeFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(filePath);

    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', err => reject(err));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

module.exports = { computeFileHash };
