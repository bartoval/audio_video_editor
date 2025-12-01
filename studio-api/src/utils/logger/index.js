const { createFileTransport } = require('./file-transport');

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CONSOLE_METHODS = { error: 'error', warn: 'warn', info: 'log', debug: 'log' };

const env = process.env.NODE_ENV || 'development';
const currentLevel = env === 'production' ? LOG_LEVELS.info : LOG_LEVELS.debug;

const logFile = process.env.LOG_FILE || 'logs/app.log';
const maxSize = parseInt(process.env.LOG_MAX_SIZE, 10) || 10 * 1024 * 1024;
const maxFiles = parseInt(process.env.LOG_MAX_FILES, 10) || 5;

const fileTransport = createFileTransport({ path: logFile, maxSize, maxFiles });

function formatMessage(level, context, message, data) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    context,
    message
  };

  if (data) {
    if (data.stack) {
      entry.stack = data.stack;
      const rest = { ...data };
      delete rest.stack;
      if (Object.keys(rest).length > 0) entry.data = rest;
    } else {
      entry.data = data;
    }
  }

  return JSON.stringify(entry);
}

function createLogger(context) {
  const logger = {};

  for (const [level, priority] of Object.entries(LOG_LEVELS)) {
    logger[level] = (message, data) => {
      if (currentLevel < priority) return;

      const line = formatMessage(level, context, message, data);
      console[CONSOLE_METHODS[level]](line);
      fileTransport.write(line);
    };
  }

  return logger;
}

module.exports = { createLogger };
