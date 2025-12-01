require('dotenv').config();

const express = require('express');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs/promises');
const path = require('path');

const config = require('./src/config');
const routes = require('./src/routes');
const { errorHandler, notFoundHandler, corsHeaders } = require('./src/middleware');
const { createLogger } = require('./src/utils/logger');
const { projectRepositoryCreator } = require('./src/repositories');

const logger = createLogger('Server');
const app = express();

// ============================================================================
// Temp cleanup utility
// ============================================================================

const TMP_TTL_MINUTES = Number(process.env.TMP_TTL_MINUTES || 30);
const TMP_CLEANUP_INTERVAL_MINUTES = Number(process.env.TMP_CLEANUP_INTERVAL_MINUTES || 60);

async function cleanupTmpChunks(dir, ttlMinutes = TMP_TTL_MINUTES) {
  const now = Date.now();
  const ttlMs = ttlMinutes * 60 * 1000;
  let removed = 0;
  let skipped = 0;

  try {
    const entries = await fs.readdir(dir);
    const groups = new Map(); // identifier -> { files: [], latestMtime }

    for (const entry of entries) {
      const match = entry.match(/^flow-([0-9A-Za-z_-]+)\.(\d+)$/);
      const fullPath = path.join(dir, entry);

      if (!match) {
        // Unknown file: treat individually
        const stat = await fs.stat(fullPath).catch(() => null);
        if (!stat) continue;
        const age = now - stat.mtimeMs;
        if (age >= ttlMs) {
          await fs.rm(fullPath, { recursive: true, force: true }).catch(() => {});
          removed += 1;
        } else {
          skipped += 1;
        }
        continue;
      }

      const identifier = match[1];
      const stat = await fs.stat(fullPath).catch(() => null);
      if (!stat) continue;

      const group = groups.get(identifier) || { files: [], latestMtime: 0 };
      group.files.push(fullPath);
      group.latestMtime = Math.max(group.latestMtime, stat.mtimeMs);
      groups.set(identifier, group);
    }

    // Remove groups only if the newest chunk is older than TTL
    for (const [identifier, group] of groups.entries()) {
      const age = now - group.latestMtime;
      if (age < ttlMs) {
        skipped += group.files.length;
        continue;
      }

      for (const file of group.files) {
        await fs.rm(file, { recursive: true, force: true }).catch(() => {});
        removed += 1;
      }
    }

    logger.info('TMP cleanup complete', { dir, removed, skipped, ttlMinutes });
  } catch (err) {
    logger.warn('TMP cleanup skipped', { dir, error: err.message });
  }
}

// ============================================================================
// Middleware
// ============================================================================

app.use(cors());
app.use(corsHeaders);
app.use(helmet({ crossOriginResourcePolicy: false, crossOriginEmbedderPolicy: false }));

// Skip compression for SSE endpoints (they need real-time streaming)
app.use(
  compression({
    filter: req => !req.path.includes('/events')
  })
);
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================================
// Server Start
// ============================================================================

const server = app.listen(config.port, '0.0.0.0', async () => {
  logger.info(`Server started at http://localhost:${config.port}`);
  logger.info(`Video encoder: ${config.ffmpeg.hwEncoder || 'libx264 (CPU)'}`);

  // Initial temp cleanup
  cleanupTmpChunks(config.tmpChunksPath, TMP_TTL_MINUTES);
  // Scheduled temp cleanup
  setInterval(
    () => {
      cleanupTmpChunks(config.tmpChunksPath, TMP_TTL_MINUTES);
    },
    TMP_CLEANUP_INTERVAL_MINUTES * 60 * 1000
  );

  // Initialize default project if none exists
  try {
    const projectRepo = projectRepositoryCreator();
    const projects = await projectRepo.findAll();

    if (projects.length === 0) {
      const defaultProject = await projectRepo.create('Default', '0');

      logger.info('Created default project', { uuid: defaultProject.uuid });
    }
  } catch (err) {
    logger.error('Failed to initialize default project', { error: err.message });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = app;
