const { projectServiceCreator } = require('../services');
const { AppError } = require('../utils/errors');

const projectService = projectServiceCreator();

async function listProjects(req, res, next) {
  try {
    const userId = req.user?.sub;
    const projects = await projectService.listProjects(userId);

    res.json(projects);
  } catch (err) {
    next(err);
  }
}

async function createProject(req, res, next) {
  try {
    const { title } = req.body;
    const ownerId = req.user?.sub;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const project = await projectService.createProject(title, ownerId);

    res.status(201).json({ success: true, uuid: project.uuid, title: project.title });
  } catch (err) {
    next(err);
  }
}

async function deleteProject(req, res, next) {
  try {
    const { uuid } = req.params;
    const userId = req.user?.sub;

    const hasAccess = await projectService.hasAccess(uuid, userId, 'edit');
    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    await projectService.deleteProject(uuid);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function shareProject(req, res, next) {
  try {
    const { uuid } = req.params;
    const { userId, permission = 'view' } = req.body;
    const ownerId = req.user?.sub;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const hasAccess = await projectService.hasAccess(uuid, ownerId, 'edit');
    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    const project = await projectService.shareProject(uuid, userId, permission);

    res.json({ success: true, project });
  } catch (err) {
    next(err);
  }
}

async function unshareProject(req, res, next) {
  try {
    const { uuid, userId } = req.params;
    const ownerId = req.user?.sub;

    const hasAccess = await projectService.hasAccess(uuid, ownerId, 'edit');
    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    await projectService.unshareProject(uuid, userId);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProjects,
  createProject,
  deleteProject,
  shareProject,
  unshareProject
};
