const fs = require('fs/promises');
const config = require('../config');

async function getHealth(_req, res) {
  const checks = {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };

  try {
    await fs.access(config.projectsPath);
    checks.storage = 'ok';
  } catch {
    checks.storage = 'unavailable';
    checks.status = 'degraded';
  }

  const statusCode = checks.status === 'ok' ? 200 : 503;

  res.status(statusCode).json(checks);
}

module.exports = { getHealth };
