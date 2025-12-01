const fs = require('fs');
const path = require('path');

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_MAX_FILES = 5;

function createFileTransport(options = {}) {
  const logPath = options.path || path.resolve(process.cwd(), 'logs', 'app.log');
  const maxSize = options.maxSize || DEFAULT_MAX_SIZE;
  const maxFiles = options.maxFiles || DEFAULT_MAX_FILES;

  const logDir = path.dirname(logPath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  let stream = fs.createWriteStream(logPath, { flags: 'a' });
  let currentSize = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;

  function rotate() {
    stream.end();

    for (let idx = maxFiles - 1; idx >= 1; idx--) {
      const older = `${logPath}.${idx}`;
      const newer = idx === 1 ? logPath : `${logPath}.${idx - 1}`;

      if (fs.existsSync(newer)) {
        fs.renameSync(newer, older);
      }
    }

    stream = fs.createWriteStream(logPath, { flags: 'w' });
    currentSize = 0;
  }

  function write(line) {
    const data = line + '\n';
    stream.write(data);
    currentSize += Buffer.byteLength(data);

    if (currentSize >= maxSize) {
      rotate();
    }
  }

  function destroy() {
    stream.end();
  }

  return { write, destroy };
}

module.exports = { createFileTransport };
