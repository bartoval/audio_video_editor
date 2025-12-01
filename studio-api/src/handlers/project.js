const { projectServiceCreator } = require('../services');

const projectService = projectServiceCreator();

async function listProjects(req, res, next) {
  try {
    const projects = await projectService.listProjects();

    res.json(projects);
  } catch (err) {
    next(err);
  }
}

async function createProject(req, res, next) {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const project = await projectService.createProject(title);

    res.status(201).json({ success: true, uuid: project.uuid, title: project.title });
  } catch (err) {
    next(err);
  }
}

async function deleteProject(req, res, next) {
  try {
    const { uuid } = req.params;
    await projectService.deleteProject(uuid);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProjects,
  createProject,
  deleteProject
};
