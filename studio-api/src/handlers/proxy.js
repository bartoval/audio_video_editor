const https = require('https');
const http = require('http');
const { URL } = require('url');
const { createLogger } = require('../utils/logger');

const logger = createLogger('ProxyHandler');

const ALLOWED_DOMAINS = ['cdn.mureka.ai', 'mureka.ai', 'api.useapi.net'];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function isAllowedDomain(hostname) {
  return ALLOWED_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
}

async function downloadFile(req, res, next) {
  try {
    const { url } = req.query;
    const filename = req.query.filename || 'download.mp3';

    if (!url) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    if (!isAllowedDomain(parsedUrl.hostname)) {
      logger.warn('Blocked proxy request to unauthorized domain', { hostname: parsedUrl.hostname });

      return res.status(403).json({ error: 'Domain not allowed' });
    }

    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    logger.info('Proxying download request', { url: parsedUrl.href, filename });

    const proxyReq = protocol.get(parsedUrl, proxyRes => {
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        let redirectUrl;

        try {
          redirectUrl = new URL(proxyRes.headers.location, parsedUrl);
        } catch {
          return res.status(502).json({ error: 'Invalid redirect URL' });
        }

        if (!isAllowedDomain(redirectUrl.hostname)) {
          logger.warn('Blocked redirect to unauthorized domain', {
            hostname: redirectUrl.hostname
          });

          return res.status(403).json({ error: 'Redirect domain not allowed' });
        }

        const redirectProtocol = redirectUrl.protocol === 'https:' ? https : http;

        redirectProtocol
          .get(redirectUrl, finalRes => {
            streamResponse(finalRes, res, filename);
          })
          .on('error', err => {
            logger.error('Redirect request failed', { error: err.message });
            if (!res.headersSent) {
              res.status(502).json({ error: 'Failed to fetch redirected resource' });
            }
          });

        return;
      }

      streamResponse(proxyRes, res, filename);
    });

    proxyReq.on('error', err => {
      logger.error('Proxy request failed', { error: err.message });
      if (!res.headersSent) {
        res.status(502).json({ error: 'Failed to fetch resource' });
      }
    });

    req.on('close', () => {
      proxyReq.destroy();
    });
  } catch (err) {
    next(err);
  }
}

function streamResponse(proxyRes, res, filename) {
  if (proxyRes.statusCode !== 200) {
    return res.status(proxyRes.statusCode).json({
      error: `Remote server returned ${proxyRes.statusCode}`
    });
  }

  const contentLength = parseInt(proxyRes.headers['content-length'], 10);

  if (contentLength && contentLength > MAX_FILE_SIZE) {
    proxyRes.destroy();

    return res.status(413).json({ error: 'File too large' });
  }

  const contentType = proxyRes.headers['content-type'] || 'audio/mpeg';
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

  res.set({
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${safeFilename}"`,
    'Content-Length': proxyRes.headers['content-length'],
    'Cache-Control': 'no-cache'
  });

  proxyRes.pipe(res);
}

module.exports = {
  downloadFile
};
