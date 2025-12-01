const { eventServiceCreator } = require('../services/eventService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('EventsHandler');
const eventService = eventServiceCreator();

/**
 * SSE endpoint for real-time workspace events
 * GET /api/v1/workspaces/:uuid/events
 */
function subscribe(req, res) {
  const { uuid } = req.params;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow cross-origin SSE
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // Required for COEP
  res.flushHeaders(); // Send headers immediately

  // Send initial connection event (unified schema)
  const connectData = {
    type: 'connected',
    payload: { uuid },
    timestamp: Date.now()
  };

  res.write(`event: message\ndata: ${JSON.stringify(connectData)}\n\n`);
  res.flush?.(); // Flush if available (compression middleware)

  // Subscribe to workspace events
  eventService.subscribe(uuid, res);

  logger.info('SSE connection opened', { uuid });

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 30000);

  // Cleanup on close
  req.on('close', () => {
    clearInterval(heartbeat);
    logger.info('SSE connection closed', { uuid });
  });
}

module.exports = {
  subscribe
};
