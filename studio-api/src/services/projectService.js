const { createLogger } = require('../utils/logger');
const { NotFoundError } = require('../utils/errors');
const { projectRepositoryCreator } = require('../repositories');

const logger = createLogger('ProjectService');

function projectServiceCreator(deps = {}) {
  const projectRepo = deps.projectRepo || projectRepositoryCreator();

  /**
   * List projects for a user (owned + shared + public)
   * @param {string} [userId] - User ID for filtering (optional for backward compat)
   */
  async function listProjects(userId = null) {
    if (userId) {
      logger.info('Listing projects for user', { userId });

      return projectRepo.findByUser(userId);
    }

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

  /**
   * Check if user has access to project
   * @param {string} uuid - Project UUID
   * @param {string} userId - User ID
   * @param {'view' | 'edit'} [permission='view']
   */
  async function hasAccess(uuid, userId, permission = 'view') {
    return projectRepo.hasAccess(uuid, userId, permission);
  }

  /**
   * Create project with owner
   * @param {string} title
   * @param {string} [ownerId]
   */
  async function createProject(title, ownerId = null) {
    logger.info('Creating project', { title, ownerId });

    return projectRepo.create(title, null, ownerId);
  }

  async function deleteProject(uuid) {
    logger.info('Deleting project', { uuid });
    const deleted = await projectRepo.remove(uuid);

    if (!deleted) {
      throw new NotFoundError(`Project not found: ${uuid}`);
    }

    return { success: true };
  }

  /**
   * Share project with another user
   */
  async function shareProject(uuid, userId, permission = 'view') {
    logger.info('Sharing project', { uuid, userId, permission });

    return projectRepo.share(uuid, userId, permission);
  }

  /**
   * Remove sharing for a user
   */
  async function unshareProject(uuid, userId) {
    logger.info('Unsharing project', { uuid, userId });

    return projectRepo.unshare(uuid, userId);
  }

  async function getProjectCover(uuid) {
    const coverPath = projectRepo.getCoverPath(uuid);

    return coverPath;
  }

  return {
    listProjects,
    getProject,
    hasAccess,
    createProject,
    deleteProject,
    shareProject,
    unshareProject,
    getProjectCover
  };
}

module.exports = { projectServiceCreator };
