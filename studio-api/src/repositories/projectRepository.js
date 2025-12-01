const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('../utils/logger');
const { fileRepositoryCreator } = require('./fileRepository');
const config = require('../config');

const logger = createLogger('ProjectRepository');

// Destructure path constants
const { dirs, files } = config.paths;

function projectRepositoryCreator() {
  const fileRepo = fileRepositoryCreator(config.projectsPath);
  const projectsFile = path.join(config.projectsPath, files.projects);

  function getProjectPath(uuid) {
    return path.join(config.projectsPath, uuid);
  }

  function createProjectFolders(uuid) {
    const projectPath = getProjectPath(uuid);

    fileRepo.ensureDir(path.join(projectPath, dirs.videoTracks));
    fileRepo.ensureDir(path.join(projectPath, dirs.audioTracks));
    fileRepo.ensureDir(path.join(projectPath, dirs.thumbs));
    fileRepo.ensureDir(path.join(projectPath, dirs.library));
    fileRepo.ensureDir(path.join(projectPath, dirs.saved));
    fileRepo.ensureDir(path.join(projectPath, dirs.published));

    const trackListPath = path.join(projectPath, files.trackList);

    fileRepo.writeJson(trackListPath, {
      tracks: {},
      filter: { name: '', sort: { duration: 'desc', name: 'desc' }, page: 1 }
    });
  }

  async function findAll() {
    const data = fileRepo.readJson(projectsFile);

    return data?.projects || [];
  }

  async function findByUuid(uuid) {
    const projects = await findAll();

    return projects.find(p => p.uuid === uuid) || null;
  }

  async function create(title, customUuid = null) {
    const projects = await findAll();
    const newProject = {
      uuid: customUuid || uuidv4(),
      title,
      isVideoLoaded: false
    };

    projects.push(newProject);
    await save(projects);
    createProjectFolders(newProject.uuid);

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
    fileRepo.deleteDir(projectPath);

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
    fileRepo.writeJson(projectsFile, { projects });
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
