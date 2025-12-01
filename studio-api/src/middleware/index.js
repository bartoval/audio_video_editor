const { errorHandler, notFoundHandler } = require('./errorHandler');
const { upload } = require('./upload');
const { corsHeaders } = require('./cors');

module.exports = {
  errorHandler,
  notFoundHandler,
  upload,
  corsHeaders
};
