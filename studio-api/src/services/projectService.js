const { createLogger } = require('../utils/logger');
const { NotFoundError } = require('../utils/errors');
const { projectRepositoryCreator } = require('../repositories');

const logger = createLogger('ProjectService');

function projectServiceCreator() {
  const projectRepo = projectRepositoryCreator();

  async function listProjects() {
    logger.info('Listing all projects');

    return projectRepo.findAll();
  }

  async function getProject(uuid) {
    logger.info('Getting project', { uuid });
    const project = await projectRepo.findByUuid(uuid);

    if (!project) {
      throw new NotFoundError(`Project not found: ${uuid}`);
    }

    return project;
  }

  async function createProject(title) {
    logger.info('Creating project', { title });

    return projectRepo.create(title);
  }

  async function deleteProject(uuid) {
    logger.info('Deleting project', { uuid });
    const deleted = await projectRepo.remove(uuid);

    if (!deleted) {
      throw new NotFoundError(`Project not found: ${uuid}`);
    }

    return { success: true };
  }

  async function getProjectCover(uuid) {
    const coverPath = projectRepo.getCoverPath(uuid);

    return coverPath;
  }

  return {
    listProjects,
    getProject,
    createProject,
    deleteProject,
    getProjectCover
  };
}

module.exports = { projectServiceCreator };
