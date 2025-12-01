const http = require('http');
const config = require('../config');
const { createLogger } = require('../utils/logger');

const logger = createLogger('MediaWorkerService');

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const timeout = options.timeout || config.mediaWorker.timeout;

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout
    };

    const req = http.request(reqOptions, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Invalid JSON response from media worker'));
          }
        } else {
          reject(new Error(`Media worker HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', error => {
      reject(new Error(`Media worker connection failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Media worker request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

function mediaWorkerServiceCreator() {
  const baseUrl = config.mediaWorker.url;

  async function healthCheck() {
    try {
      const data = await fetchJson(`${baseUrl}/health`);

      return { available: data.status === 'ok', version: data.version };
    } catch (error) {
      logger.warn('Media worker health check failed', { error: error.message });

      return { available: false, error: error.message };
    }
  }

  async function transcribe(filePath, options = {}) {
    const { language, model, callbackUrl } = options;

    logger.info('Starting transcription job', { filePath, language, model, callbackUrl });

    const body = { file_path: filePath };

    if (language) body.language = language;
    if (model) body.model = model;
    if (callbackUrl) body.callback_url = callbackUrl;

    const data = await fetchJson(`${baseUrl}/transcribe`, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    return {
      jobId: data.job_id,
      status: data.status,
      message: data.message
    };
  }

  async function getTranscribeStatus(jobId) {
    const data = await fetchJson(`${baseUrl}/transcribe/${jobId}`);

    return {
      jobId: data.job_id,
      status: data.status,
      text: data.text || null,
      segments: data.segments || null,
      language: data.language || null,
      duration: data.duration || null,
      error: data.error || null
    };
  }

  async function stems(filePath, options = {}) {
    const { model, twoStems, callbackUrl } = options;

    logger.info('Starting stem separation job', { filePath, model, twoStems, callbackUrl });

    const body = { file_path: filePath };

    if (model) body.model = model;
    if (twoStems) body.two_stems = twoStems;
    if (callbackUrl) body.callback_url = callbackUrl;

    const data = await fetchJson(`${baseUrl}/stems`, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    return {
      jobId: data.job_id,
      status: data.status,
      message: data.message
    };
  }

  async function getStemsStatus(jobId) {
    const data = await fetchJson(`${baseUrl}/stems/${jobId}`);

    return {
      jobId: data.job_id,
      status: data.status,
      stems: data.stems || null,
      model: data.model || null,
      duration: data.duration || null,
      error: data.error || null
    };
  }

  async function sceneDetect(filePath, options = {}) {
    const { threshold, minSceneLen, callbackUrl } = options;

    logger.info('Starting scene detection job', { filePath, threshold, minSceneLen, callbackUrl });

    const body = { file_path: filePath };

    if (threshold != null) body.threshold = threshold;
    if (minSceneLen != null) body.min_scene_len = minSceneLen;
    if (callbackUrl) body.callback_url = callbackUrl;

    const data = await fetchJson(`${baseUrl}/scene-detect`, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    return {
      jobId: data.job_id,
      status: data.status,
      message: data.message
    };
  }

  async function getSceneDetectStatus(jobId) {
    const data = await fetchJson(`${baseUrl}/scene-detect/${jobId}`);

    return {
      jobId: data.job_id,
      status: data.status,
      scenes: data.scenes || null,
      fps: data.fps || null,
      duration: data.duration || null,
      error: data.error || null
    };
  }

  return {
    healthCheck,
    transcribe,
    getTranscribeStatus,
    stems,
    getStemsStatus,
    sceneDetect,
    getSceneDetectStatus
  };
}

const mediaWorkerService = mediaWorkerServiceCreator();

module.exports = { mediaWorkerServiceCreator: () => mediaWorkerService };
