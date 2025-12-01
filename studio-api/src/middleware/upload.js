const multer = require('multer');
const config = require('../config');

const upload = multer({
  dest: config.tmpChunksPath,
  limits: {
    fileSize: config.upload.maxFileSize
  }
});

module.exports = { upload };
