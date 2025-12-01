const { projectServiceCreator } = require('./projectService');
const { uploadServiceCreator } = require('./uploadService');
const { editorServiceCreator } = require('./editorService');
const { streamServiceCreator } = require('./streamService');
const { eventServiceCreator } = require('./eventService');
const { videoConversionServiceCreator } = require('./videoConversionService');
const { mediaWorkerServiceCreator } = require('./mediaWorkerService');

module.exports = {
  projectServiceCreator,
  uploadServiceCreator,
  editorServiceCreator,
  streamServiceCreator,
  eventServiceCreator,
  videoConversionServiceCreator,
  mediaWorkerServiceCreator
};
