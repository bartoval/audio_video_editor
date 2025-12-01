var multipart = require('connect-multiparty');
var multipartMiddleware = multipart();
var uploadController = require('./uploadController');

exports.init = app => {
  // Video upload routes
  app.post('/upload', multipartMiddleware, uploadController.upload);
  app.options('/upload', uploadController.uploadOptions);
  app.get('/download/:identifier', uploadController.download);
  app.get('/video/:uuid/:noc', uploadController.video);
  app.get('/audio/:uuid', uploadController.audio);
  app.post('/convertVideo/:uuid', uploadController.convertVideo);
  app.get('/isVideoConverted/:uuid', uploadController.isVideoConverted);
  app.get('/conversionStream/:uuid', uploadController.conversionStream);

  // Audio library upload routes
  app.post('/uploadAudio', multipartMiddleware, uploadController.uploadAudio);
  app.get('/libraryAudio/:uuid/:filename', uploadController.libraryAudio);
  app.delete('/deleteAudio/:uuid/:filename', uploadController.deleteAudio);
};