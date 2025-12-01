let editorController = require('./editorController');

// Middleware for COOP/COEP headers (required for SharedArrayBuffer/WASM)
const wasmHeaders = (req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
};

exports.init = app => {
  editorController.bootstrap();

  // API routes under /api/studio/
  app.get('/api/studio/audio/metaInfo/list/:uuid', editorController.metaInfoAudioList);
  app.get('/api/studio/audio/:uuid/:id', editorController.getAudio);
  app.post('/api/studio/audio/add/:uuid/:id', editorController.addAudio);
  app.post('/api/studio/audio/remove/:uuid/:id', editorController.removeAudio);
  app.get('/api/studio/metaInfoVideo/:uuid', editorController.metaInfoVideo);
  app.get('/api/studio/video/:uuid', editorController.video);
  app.post('/api/studio/stretch/:uuid', editorController.stretch);
  app.get('/api/studio/stretchAck/:uuid/:id', editorController.stretchAck);
  app.get('/api/studio/load/:uuid', editorController.load);
  app.post('/api/studio/backup/:uuid', editorController.backup);
  app.post('/api/studio/export/:uuid', editorController.export);
  app.get('/api/studio/thumbs/:uuid/thumbs/:filename', editorController.thumbs);
  app.get('/api/studio/thumb/:uuid/:time', editorController.thumb);
  app.get('/api/studio/published/:uuid', editorController.published);
  app.delete('/api/studio/deleteVideo/:uuid', editorController.deleteVideo);

  // Main page route
  app.get('/studio/:uuid', wasmHeaders, editorController.index);
};