const projectHandlers = require('./project');
const uploadHandlers = require('./upload');
const editorHandlers = require('./editor');
const eventsHandlers = require('./events');
const configHandlers = require('./config');
const proxyHandlers = require('./proxy');
const aiMusicHandlers = require('./aiMusic');
const mlHandlers = require('./ml');
const healthHandlers = require('./health');

module.exports = {
  project: projectHandlers,
  upload: uploadHandlers,
  editor: editorHandlers,
  events: eventsHandlers,
  config: configHandlers,
  proxy: proxyHandlers,
  aiMusic: aiMusicHandlers,
  ml: mlHandlers,
  health: healthHandlers
};
