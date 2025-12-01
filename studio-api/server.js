const express = require('express');
const path = require('path');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan');

const config = require('./src/config');
const routes = require('./src/routes');
const { errorHandler, notFoundHandler, corsHeaders } = require('./src/middleware');
const { createLogger } = require('./src/utils/logger');
const { projectRepositoryCreator } = require('./src/repositories');

const logger = createLogger('Server');
const app = express();

// ============================================================================
// Middleware
// ============================================================================

app.use(cors());
app.use(corsHeaders);
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ============================================================================
// Static Files
// ============================================================================

app.use(express.static(config.publicPath));

// ============================================================================
// API Routes
// ============================================================================

app.use('/api', routes);

// ============================================================================
// SPA Fallback
// ============================================================================

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }

  res.sendFile(path.join(config.publicPath, 'index.html'));
});

// ============================================================================
// Error Handling
// ============================================================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================================
// Server Start
// ============================================================================

const server = app.listen(config.port, '0.0.0.0', async () => {
  logger.info(`Server started at http://localhost:${config.port}`);

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
