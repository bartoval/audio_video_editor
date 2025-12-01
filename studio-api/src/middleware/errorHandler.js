const { createLogger } = require('../utils/logger');
const { AppError } = require('../utils/errors');
const config = require('../config');

const logger = createLogger('ErrorHandler');

function errorHandler(err, req, res, next) {
  // Log error
  logger.error(err.message, {
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // If headers already sent (e.g., during streaming), delegate to Express default handler
  if (res.headersSent) {
    return next(err);
  }

  // Operational errors (expected)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message
      }
    });
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'File size exceeds limit'
      }
    });
  }

  if (err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      error: {
        code: 'INVALID_FILE_TYPE',
        message: err.message
      }
    });
  }

  // Unknown errors
  const statusCode = err.statusCode || 500;
  const message = config.env === 'production' ? 'Internal server error' : err.message;

  res.status(statusCode).json({
    error: {
      code: 'INTERNAL_ERROR',
      message
    }
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`
    }
  });
}

module.exports = { errorHandler, notFoundHandler };
