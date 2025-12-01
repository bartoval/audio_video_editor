const { createLogger } = require('../utils/logger');

const logger = createLogger('MediaUtils');

function assertFiniteNumber(value, paramName) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `Invalid parameter "${paramName}": expected finite number, got ${typeof value} (${value})`
    );
  }
}

function createSafeExec(execFileFn) {
  return function safeExec(executable, args) {
    return new Promise((resolve, reject) => {
      logger.debug('Executing command', { executable, args: args.slice(0, 10) });
      execFileFn(executable, args, (error, stdout, stderr) => {
        if (error) {
          logger.error('Command failed', { executable, error: error.message });
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  };
}

module.exports = { assertFiniteNumber, createSafeExec };
