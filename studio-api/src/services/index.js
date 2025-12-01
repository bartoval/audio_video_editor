const { projectServiceCreator } = require('./projectService');
const { uploadServiceCreator } = require('./uploadService');
const { editorServiceCreator } = require('./editorService');
const { streamServiceCreator } = require('./streamService');

module.exports = {
  projectServiceCreator,
  uploadServiceCreator,
  editorServiceCreator,
  streamServiceCreator
};
