const { fileRepositoryCreator } = require('./fileRepository');
const { projectRepositoryCreator } = require('./projectRepository');
const { mediaRepositoryCreator } = require('./mediaRepository');
const { chunkRepositoryCreator } = require('./chunkRepository');

module.exports = {
  fileRepositoryCreator,
  projectRepositoryCreator,
  mediaRepositoryCreator,
  chunkRepositoryCreator
};
