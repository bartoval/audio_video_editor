const projectHandlers = require('./project');
const uploadHandlers = require('./upload');
const editorHandlers = require('./editor');

module.exports = {
  project: projectHandlers,
  upload: uploadHandlers,
  editor: editorHandlers
};
