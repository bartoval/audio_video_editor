const { fileRepositoryCreator } = require('./fileRepository');
const { projectRepositoryCreator } = require('./projectRepository');
const { mediaRepositoryCreator } = require('./mediaRepository');
const { probeRepositoryCreator } = require('./probeRepository');
const { thumbnailRepositoryCreator } = require('./thumbnailRepository');
const { exportRepositoryCreator } = require('./exportRepository');
const { audioProcessingRepositoryCreator } = require('./audioProcessingRepository');
const { chunkRepositoryCreator } = require('./chunkRepository');

module.exports = {
  fileRepositoryCreator,
  projectRepositoryCreator,
  mediaRepositoryCreator,
  probeRepositoryCreator,
  thumbnailRepositoryCreator,
  exportRepositoryCreator,
  audioProcessingRepositoryCreator,
  chunkRepositoryCreator
};
