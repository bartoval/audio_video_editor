const config = require('../config');

const { thumbScales, ext } = config.paths;
const { thumbTiles, defaultScale } = config;

/**
 * GET /api/v1/config
 * Returns application configuration
 */
function getConfig(req, res) {
  const scales = thumbScales.map(({ scale }) => ({
    scale,
    isPriority: scale === defaultScale
  }));

  res.json({
    thumbs: {
      scales,
      defaultScale,
      tiles: {
        cols: thumbTiles.cols,
        rows: thumbTiles.rows
      },
      extension: ext.thumb
    }
  });
}

module.exports = {
  getConfig
};
