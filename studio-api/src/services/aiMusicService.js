const https = require('https');
const { createLogger } = require('../utils/logger');
const config = require('../config');

const logger = createLogger('AiMusicService');

// Mureka API configuration
const MUREKA_API = 'https://api.useapi.net/v1/mureka';
const JOB_TTL_MS = 10 * 60 * 1000;

// Track job state for recovery
const jobs = new Map();

function getApiKey() {
  return process.env.AI_MUSIC_API_KEY || '';
}

function buildHeaders() {
  const apiKey = getApiKey();

  if (!apiKey) {
    return null;
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };
}

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = https.request(reqOptions, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Invalid JSON response'));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

function normalizeTracks(songs, userTitle) {
  return songs.map(song => ({
    id: song.song_id,
    title: userTitle || song.title || 'Untitled',
    url: song.mp3_url,
    duration: song.duration_milliseconds,
    genres: song.genres || [],
    moods: song.moods || []
  }));
}

function scheduleCleanup(jobId) {
  setTimeout(() => jobs.delete(jobId), JOB_TTL_MS);
}

function aiMusicServiceCreator() {
  /**
   * Check if AI Music is configured
   */
  function isConfigured() {
    return !!getApiKey();
  }

  /**
   * Get moods and genres from Mureka API
   */
  async function getMoodsAndGenres() {
    const headers = buildHeaders();

    if (!headers) {
      throw new Error('API not configured');
    }

    const data = await fetchJson(`${MUREKA_API}/music/moods-and-genres`, { headers });

    return {
      genres: data.genres || [],
      moods: data.moods || []
    };
  }

  /**
   * Generate lyrics from Mureka API
   */
  async function generateLyrics(prompt = '') {
    const headers = buildHeaders();

    if (!headers) {
      throw new Error('API not configured');
    }

    const body = {};

    if (prompt) {
      body.prompt = prompt;
    }

    const data = await fetchJson(`${MUREKA_API}/music/lyrics-generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    return data.lyrics || '';
  }

  /**
   * Delete a song from Mureka
   */
  async function deleteSong(songId) {
    const headers = buildHeaders();

    if (!headers) {
      throw new Error('API not configured');
    }

    logger.info('Deleting Mureka song', { songId });

    await fetchJson(`${MUREKA_API}/music/${songId}`, {
      method: 'DELETE',
      headers
    });

    return { status: 'deleted', songId };
  }

  /**
   * Generate music (blocking call to Mureka)
   */
  async function generate(options) {
    const {
      type,
      title,
      lyrics,
      description,
      model = config.aiMusic.defaultModel,
      vocalGender
    } = options;
    const headers = buildHeaders();

    if (!headers) {
      throw new Error('API not configured');
    }

    const isInstrumental = type === 'instrumental';
    const endpoint = isInstrumental
      ? `${MUREKA_API}/music/create-instrumental`
      : `${MUREKA_API}/music/create-advanced`;

    const body = { model };

    if (title) {
      body.title = title;
    }

    if (isInstrumental) {
      if (description) body.prompt = description;
    } else {
      if (!lyrics) {
        throw new Error('Lyrics required for vocal tracks');
      }

      body.lyrics = lyrics;
      if (description) body.desc = description;
      if (vocalGender) body.vocal_gender = vocalGender;
    }

    logger.info('Starting AI music generation', { type, title, model });

    const data = await fetchJson(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!data.songs || data.songs.length === 0) {
      throw new Error('Generation returned no songs');
    }

    return normalizeTracks(data.songs, title);
  }

  /**
   * Fire-and-forget generation: return jobId immediately, run Mureka call in background.
   * The caller provides onComplete/onError callbacks for orchestrating side-effects
   * (saving tracks, emitting SSE) — keeping this service focused on the Mureka API.
   *
   * @param {Object} options - Generation options (type, title, lyrics, etc.)
   * @param {{ onComplete: (jobId: string, tracks: Array) => Promise<Array>, onError: (jobId: string, errorMessage: string) => void }} callbacks
   */
  function startJob(options, { onComplete, onError }) {
    const jobId = `ai-music-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const title = options.title || null;

    jobs.set(jobId, {
      jobId,
      status: 'generating',
      title,
      createdAt: Date.now()
    });

    setImmediate(async () => {
      try {
        const tracks = await generate(options);
        const savedTracks = await onComplete(jobId, tracks);

        jobs.set(jobId, {
          jobId,
          status: 'complete',
          tracks,
          savedTracks: savedTracks || [],
          title,
          createdAt: Date.now()
        });

        scheduleCleanup(jobId);
      } catch (error) {
        logger.error('Background generation failed', { jobId, error: error.message });

        jobs.set(jobId, {
          jobId,
          status: 'error',
          error: error.message,
          title,
          createdAt: Date.now()
        });

        onError(jobId, error.message);
        scheduleCleanup(jobId);
      }
    });

    return { jobId };
  }

  /**
   * Get current job status
   */
  function getJobStatus(jobId) {
    return jobs.get(jobId) || null;
  }

  return {
    isConfigured,
    getMoodsAndGenres,
    generateLyrics,
    generate,
    startJob,
    getJobStatus,
    deleteSong
  };
}

// Singleton instance
const aiMusicService = aiMusicServiceCreator();

module.exports = { aiMusicServiceCreator: () => aiMusicService };
