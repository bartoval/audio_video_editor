const config = require('../config');

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const currentLevel = config.env === 'production' ? LOG_LEVELS.info : LOG_LEVELS.debug;

function formatMessage(level, context, message, data) {
  const timestamp = new Date().toISOString();
  const base = { timestamp, level, context, message };

  if (data) {
    return JSON.stringify({ ...base, data });
  }

  return JSON.stringify(base);
}

function createLogger(context) {
  return {
    error(message, data) {
      if (currentLevel >= LOG_LEVELS.error) {
        console.error(formatMessage('error', context, message, data));
      }
    },

    warn(message, data) {
      if (currentLevel >= LOG_LEVELS.warn) {
        console.warn(formatMessage('warn', context, message, data));
      }
    },

    info(message, data) {
      if (currentLevel >= LOG_LEVELS.info) {
        console.log(formatMessage('info', context, message, data));
      }
    },

    debug(message, data) {
      if (currentLevel >= LOG_LEVELS.debug) {
        console.log(formatMessage('debug', context, message, data));
      }
    }
  };
}

module.exports = { createLogger };
