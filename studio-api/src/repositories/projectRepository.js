const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('../utils/logger');
const { fileRepositoryCreator } = require('./fileRepository');
const config = require('../config');

const logger = createLogger('ProjectRepository');

// Destructure path constants
const { dirs, files } = config.paths;

/**
 * @typedef {Object} Project
 * @property {string} uuid - Project unique identifier
 * @property {string} title - Project title
 * @property {boolean} isVideoLoaded - Whether video is loaded
 * @property {string} [ownerId] - Owner user ID (Keycloak sub claim)
 * @property {Array<{userId: string, permission: 'view' | 'edit'}>} [sharedWith] - Users with access
 * @property {boolean} [isPublic] - Whether project is public
 */

function projectRepositoryCreator() {
  const fileRepo = fileRepositoryCreator(config.projectsPath);
  const projectsFile = path.join(config.projectsPath, files.projects);

  function getProjectPath(uuid) {
    return path.join(config.projectsPath, uuid);
  }

  async function createProjectFolders(uuid) {
    const projectPath = getProjectPath(uuid);

    await fileRepo.ensureDir(path.join(projectPath, dirs.videoTracks));
    await fileRepo.ensureDir(path.join(projectPath, dirs.audioTracks));
    await fileRepo.ensureDir(path.join(projectPath, dirs.thumbs));
    await fileRepo.ensureDir(path.join(projectPath, dirs.library));
    await fileRepo.ensureDir(path.join(projectPath, dirs.saved));
    await fileRepo.ensureDir(path.join(projectPath, dirs.published));

    const trackListPath = path.join(projectPath, files.trackList);

    await fileRepo.writeJson(trackListPath, {
      tracks: {},
      filter: { name: '', sort: { duration: 'desc', name: 'desc' }, page: 1 }
    });
  }

  async function findAll() {
    const data = await fileRepo.readJson(projectsFile);

    return data?.projects || [];
  }

  /**
   * Find all projects for a specific user (owned + shared + public)
   * @param {string} userId - User ID (Keycloak sub claim)
   * @returns {Promise<Project[]>}
   */
  async function findByUser(userId) {
    const projects = await findAll();

    return projects.filter(project => {
      // User owns the project
      if (project.ownerId === userId) return true;

      // Project is shared with user
      if (project.sharedWith?.some(share => share.userId === userId)) return true;

      // Project is public
      if (project.isPublic) return true;

      // Legacy projects without owner (accessible to all for backward compatibility)
      if (!project.ownerId) return true;

      return false;
    });
  }

  async function findByUuid(uuid) {
    const projects = await findAll();

    return projects.find(p => p.uuid === uuid) || null;
  }

  /**
   * Check if user has access to a project
   * @param {string} uuid - Project UUID
   * @param {string} userId - User ID
   * @param {'view' | 'edit'} [requiredPermission='view'] - Required permission level
   * @returns {Promise<boolean>}
   */
  async function hasAccess(uuid, userId, requiredPermission = 'view') {
    const project = await findByUuid(uuid);
    if (!project) return false;

    // Owner has full access
    if (project.ownerId === userId) return true;

    // Public projects have view access
    if (project.isPublic && requiredPermission === 'view') return true;

    // Legacy projects without owner (accessible to all)
    if (!project.ownerId) return true;

    // Check shared access
    const share = project.sharedWith?.find(share => share.userId === userId);
    if (!share) return false;

    // 'edit' permission includes 'view'
    if (requiredPermission === 'view') return true;

    return share.permission === 'edit';
  }

  /**
   * Create a new project
   * @param {string} title - Project title
   * @param {string} [customUuid] - Custom UUID (optional)
   * @param {string} [ownerId] - Owner user ID (optional, for multi-tenancy)
   * @returns {Promise<Project>}
   */
  async function create(title, customUuid = null, ownerId = null) {
    const projects = await findAll();
    const newProject = {
      uuid: customUuid || uuidv4(),
      title,
      isVideoLoaded: false,
      ownerId: ownerId || null,
      sharedWith: [],
      isPublic: false
    };

    projects.push(newProject);
    await save(projects);
    await createProjectFolders(newProject.uuid);

    logger.info('Created project', { uuid: newProject.uuid, title });

    return newProject;
  }

  async function remove(uuid) {
    const projects = await findAll();
    const index = projects.findIndex(p => p.uuid === uuid);

    if (index === -1) {
      return false;
    }

    projects.splice(index, 1);
    await save(projects);

    // Delete project directory
    const projectPath = getProjectPath(uuid);
    await fileRepo.deleteDir(projectPath);

    logger.info('Deleted project', { uuid });

    return true;
  }

  async function updateVideoLoaded(uuid, isLoaded) {
    const projects = await findAll();
    const project = projects.find(p => p.uuid === uuid);

    if (!project) {
      return null;
    }

    project.isVideoLoaded = isLoaded;
    await save(projects);

    return project;
  }

  async function save(projects) {
    await fileRepo.writeJson(projectsFile, { projects });
  }

  function getCoverPath(uuid) {
    return path.join(getProjectPath(uuid), dirs.thumbs, files.coverThumb);
  }

  /**
   * Share a project with another user
   * @param {string} uuid - Project UUID
   * @param {string} userId - User ID to share with
   * @param {'view' | 'edit'} permission - Permission level
   * @returns {Promise<Project|null>}
   */
  async function share(uuid, userId, permission = 'view') {
    const projects = await findAll();
    const project = projects.find(p => p.uuid === uuid);

    if (!project) return null;

    // Initialize sharedWith if not exists
    if (!project.sharedWith) {
      project.sharedWith = [];
    }

    // Remove existing share for this user
    project.sharedWith = project.sharedWith.filter(share => share.userId !== userId);

    // Add new share
    project.sharedWith.push({ userId, permission });

    await save(projects);
    logger.info('Shared project', { uuid, userId, permission });

    return project;
  }

  /**
   * Remove sharing for a user
   * @param {string} uuid - Project UUID
   * @param {string} userId - User ID to remove
   * @returns {Promise<boolean>}
   */
  async function unshare(uuid, userId) {
    const projects = await findAll();
    const project = projects.find(p => p.uuid === uuid);

    if (!project || !project.sharedWith) return false;

    const before = project.sharedWith.length;
    project.sharedWith = project.sharedWith.filter(share => share.userId !== userId);

    if (project.sharedWith.length === before) return false;

    await save(projects);
    logger.info('Unshared project', { uuid, userId });

    return true;
  }

  /**
   * Set project public/private status
   * @param {string} uuid - Project UUID
   * @param {boolean} isPublic - Public status
   * @returns {Promise<Project|null>}
   */
  async function setPublic(uuid, isPublic) {
    const projects = await findAll();
    const project = projects.find(p => p.uuid === uuid);

    if (!project) return null;

    project.isPublic = isPublic;
    await save(projects);

    logger.info('Set project visibility', { uuid, isPublic });

    return project;
  }

  return {
    findAll,
    findByUser,
    findByUuid,
    hasAccess,
    create,
    remove,
    updateVideoLoaded,
    share,
    unshare,
    setPublic,
    getProjectPath,
    getCoverPath
  };
}

module.exports = { projectRepositoryCreator };
