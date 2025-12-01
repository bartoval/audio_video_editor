const { aiMusicServiceCreator } = require('../services/aiMusicService');
const { uploadServiceCreator } = require('../services/uploadService');
const { eventServiceCreator } = require('../services/eventService');
const { createLogger } = require('../utils/logger');
const config = require('../config');

const logger = createLogger('AiMusicHandler');
const aiMusicService = aiMusicServiceCreator();
const uploadService = uploadServiceCreator();
const eventService = eventServiceCreator();

/**
 * Check if AI Music is configured
 * GET /api/v1/ai-music/config
 */
function getConfig(req, res) {
  const { defaultModel, models } = config.aiMusic;

  res.json({
    configured: aiMusicService.isConfigured(),
    defaultModel,
    models
  });
}

/**
 * Get moods and genres
 * GET /api/v1/ai-music/moods-genres
 */
async function getMoodsAndGenres(req, res, next) {
  try {
    const data = await aiMusicService.getMoodsAndGenres();

    res.json(data);
  } catch (error) {
    logger.error('Failed to get moods and genres', { error: error.message });
    next(error);
  }
}

/**
 * Generate lyrics
 * POST /api/v1/ai-music/lyrics
 */
async function generateLyrics(req, res, next) {
  try {
    const { prompt } = req.body;
    const lyrics = await aiMusicService.generateLyrics(prompt);

    res.json({ lyrics });
  } catch (error) {
    logger.error('Failed to generate lyrics', { error: error.message });
    next(error);
  }
}

/**
 * Start music generation
 * POST /api/v1/ai-music/generate
 */
async function generate(req, res, next) {
  try {
    const { type, title, lyrics, description, model, vocalGender, uuid } = req.body;

    if (!uuid) {
      return res.status(400).json({ error: 'Missing uuid' });
    }

    const { jobId } = aiMusicService.startJob(
      { type, title, lyrics, description, model, vocalGender },
      {
        onComplete: async (completedJobId, tracks) => {
          const savedTracks = [];

          for (const track of tracks) {
            const filename = `${track.title || 'ai-music'}.mp3`;

            try {
              const result = await uploadService.saveAudioFromUrl(track.url, filename, uuid, {
                provider: 'mureka',
                source: 'ai-music',
                providerId: track.id
              });

              savedTracks.push({
                id: result.file,
                metadata: result.metadata,
                status: result.status
              });
            } catch (saveError) {
              logger.error('Failed to save track to library', {
                jobId: completedJobId,
                trackId: track.id,
                error: saveError.message
              });
            }
          }

          eventService.emit(uuid, 'job:completed', {
            type: 'ai-music',
            jobId: completedJobId,
            status: 'completed',
            title,
            tracks: savedTracks
          });

          return savedTracks;
        },

        onError: (failedJobId, errorMessage) => {
          eventService.emit(uuid, 'job:completed', {
            type: 'ai-music',
            jobId: failedJobId,
            status: 'failed',
            error: errorMessage
          });
        }
      }
    );

    logger.info('Generation started', { jobId, uuid });

    res.json({ jobId });
  } catch (error) {
    logger.error('Failed to start generation', { error: error.message });
    next(error);
  }
}

/**
 * Get current job status (for recovery)
 * GET /api/v1/ai-music/job/:jobId
 */
function getJobStatus(req, res) {
  const { jobId } = req.params;
  const status = aiMusicService.getJobStatus(jobId);

  if (!status) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(status);
}

/**
 * Save completed job tracks to project library
 * POST /api/v1/ai-music/job/:jobId/save
 */
async function saveJobTracks(req, res, next) {
  try {
    const { jobId } = req.params;
    const { uuid } = req.body;

    if (!uuid) {
      return res.status(400).json({ error: 'Missing uuid in request body' });
    }

    const job = aiMusicService.getJobStatus(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'complete') {
      return res.status(409).json({ error: 'Job not complete', status: job.status });
    }

    const savedTracks = [];

    for (const track of job.tracks) {
      const filename = `${track.title || 'ai-music'}.mp3`;

      const result = await uploadService.saveAudioFromUrl(track.url, filename, uuid, {
        provider: 'mureka',
        source: 'ai-music',
        providerId: track.id
      });

      savedTracks.push({
        id: result.file,
        metadata: result.metadata,
        status: result.status
      });
    }

    logger.info('Job tracks saved to library', { jobId, uuid, count: savedTracks.length });

    res.json({ tracks: savedTracks });
  } catch (error) {
    logger.error('Failed to save job tracks', { error: error.message });
    next(error);
  }
}

module.exports = {
  getConfig,
  getMoodsAndGenres,
  generateLyrics,
  generate,
  getJobStatus,
  saveJobTracks
};
