var projectController = require('./projectController');

exports.init = function(app) {
  app.get('/project/cover/:uuid', projectController.projectCover);
  app.get('/api/projects', projectController.projectListApi);
  app.post('/api/projects', projectController.projectAddApi);
  app.delete('/api/projects/:uuid', projectController.projectDeleteApi);
};
