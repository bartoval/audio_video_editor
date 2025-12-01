const multer = require('multer');
const config = require('../config');
const { createLogger } = require('../utils/logger');

const logger = createLogger('UploadMiddleware');

// File filter to validate MIME types for uploaded files
function fileFilter(req, file, callback) {
  const allowedTypes = [...config.upload.allowedVideoTypes, ...config.upload.allowedAudioTypes];

  // Primary validation: check MIME type
  if (allowedTypes.includes(file.mimetype)) {
    logger.debug('File accepted by MIME type', {
      filename: file.originalname,
      mimetype: file.mimetype
    });
    callback(null, true);
    return;
  }

  // Fallback for chunked uploads: validate by file extension when MIME is application/octet-stream
  if (file.mimetype === 'application/octet-stream') {
    const allowedExtensions = [
      'wav',
      'mp3',
      'ogg',
      'flac',
      'aac',
      'm4a',
      'mp4',
      'webm',
      'mov',
      'avi',
      'mkv'
    ];

    const ext = file.originalname.split('.').pop().toLowerCase();

    if (allowedExtensions.includes(ext)) {
      logger.debug('File accepted by extension fallback', {
        filename: file.originalname,
        mimetype: file.mimetype,
        extension: ext
      });
      callback(null, true);
      return;
    }
  }

  // Reject if neither MIME type nor extension match
  logger.warn('File rejected - invalid MIME type and extension', {
    filename: file.originalname,
    mimetype: file.mimetype,
    allowedTypes
  });

  const error = new Error(
    `Invalid file type '${file.mimetype}'. Allowed types: ${allowedTypes.join(', ')}`
  );
  error.code = 'INVALID_FILE_TYPE';
  callback(error, false);
}

const upload = multer({
  dest: config.tmpChunksPath,
  limits: {
    fileSize: config.upload.maxFileSize
  },
  fileFilter
});

module.exports = { upload };
