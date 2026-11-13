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
 */

function projectRepositoryCreator(deps = {}) {
  const fileRepo = deps.fileRepo || fileRepositoryCreator(config.projectsPath);
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

    return (data?.projects || []).map(({ uuid, title, isVideoLoaded }) => ({
      uuid,
      title,
      isVideoLoaded
    }));
  }

  async function findByUuid(uuid) {
    const projects = await findAll();

    return projects.find(p => p.uuid === uuid) || null;
  }

  /**
   * Create a new project
   * @param {string} title - Project title
   * @param {string} [customUuid] - Custom UUID (optional)
   * @returns {Promise<Project>}
   */
  async function create(title, customUuid = null) {
    const projects = await findAll();
    const newProject = {
      uuid: customUuid || uuidv4(),
      title,
      isVideoLoaded: false
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

  return {
    findAll,
    findByUuid,
    create,
    remove,
    updateVideoLoaded,
    getProjectPath,
    getCoverPath
  };
}

module.exports = { projectRepositoryCreator };
