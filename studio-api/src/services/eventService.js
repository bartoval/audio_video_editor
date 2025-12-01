const { createLogger } = require('../utils/logger');

const logger = createLogger('EventService');

// Track active SSE connections per workspace
const connections = new Map();

// Track last thumbnail status per workspace (for late-joining clients)
const thumbnailStatus = new Map();

function eventServiceCreator() {
  /**
   * Subscribe to workspace events (called when client opens SSE connection)
   */
  function subscribe(uuid, res) {
    if (!connections.has(uuid)) {
      connections.set(uuid, new Set());
    }

    connections.get(uuid).add(res);
    logger.debug('SSE client connected', { uuid, clients: connections.get(uuid).size });

    // Send current thumbnail status to new client (if any)
    const currentStatus = thumbnailStatus.get(uuid);

    if (currentStatus) {
      const data = {
        type: 'thumbnails',
        payload: currentStatus,
        timestamp: Date.now()
      };

      const message = `event: message\ndata: ${JSON.stringify(data)}\n\n`;
      res.write(message);
      logger.debug('Sent current thumbnail status to new client', {
        uuid,
        status: currentStatus.status
      });
    }

    // Cleanup on disconnect
    res.on('close', () => {
      connections.get(uuid)?.delete(res);
      logger.debug('SSE client disconnected', { uuid, clients: connections.get(uuid)?.size || 0 });
    });
  }

  /**
   * Send event to all clients subscribed to a workspace
   * Uses unified schema: event: message, data: { type, payload, timestamp }
   */
  function emit(uuid, type, payload) {
    const clients = connections.get(uuid);

    if (!clients || clients.size === 0) {
      return;
    }

    const data = {
      type,
      payload,
      timestamp: Date.now()
    };

    const message = `event: message\ndata: ${JSON.stringify(data)}\n\n`;

    for (const client of clients) {
      client.write(message);

      if (typeof client.flush === 'function') {
        client.flush();
      }
    }

    logger.debug('SSE event sent', { uuid, type, clients: clients.size });
  }

  /**
   * Send thumbnail status update and store for late-joining clients
   */
  function emitThumbnailStatus(uuid, status, progress = null, extra = {}) {
    const payload = { status, progress, ...extra };

    thumbnailStatus.set(uuid, payload);

    emit(uuid, 'thumbnails', payload);
  }

  /**
   * Get number of connected clients for a workspace
   */
  function getClientCount(uuid) {
    return connections.get(uuid)?.size || 0;
  }

  return {
    subscribe,
    emit,
    emitThumbnailStatus,
    getClientCount
  };
}

// Singleton instance
const eventService = eventServiceCreator();

module.exports = { eventServiceCreator: () => eventService };
