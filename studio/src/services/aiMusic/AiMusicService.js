import { EVENT } from '../../config/constants';
import { aiMusicStore } from '../../store';
import ErrorHandler from '../ErrorHandler';
import * as EventService from '../EventService';
import * as JobTrackerService from '../JobTrackerService';
import { MurekaAdapter } from './adapters';

const adapters = {
  mureka: MurekaAdapter
};

let currentAdapter = MurekaAdapter;

class AiMusicService {
  getAvailableProviders() {
    return Object.values(adapters)
      .filter(adapter => adapter.isConfigured())
      .map(adapter => ({
        id: adapter.id,
        name: adapter.name,
        supportsLyrics: adapter.supportsLyrics(),
        supportsInstrumental: adapter.supportsInstrumental()
      }));
  }

  getActiveProvider() {
    return {
      id: currentAdapter.id,
      name: currentAdapter.name
    };
  }

  setProvider(providerId) {
    if (adapters[providerId]) {
      currentAdapter = adapters[providerId];

      return true;
    }

    return false;
  }

  isConfigured() {
    return currentAdapter.isConfigured();
  }

  getModels() {
    return currentAdapter.getModels();
  }

  supportsLyrics() {
    return currentAdapter.supportsLyrics();
  }

  supportsInstrumental() {
    return currentAdapter.supportsInstrumental();
  }

  supportsLyricsGeneration() {
    return currentAdapter.supportsLyricsGeneration?.() || false;
  }

  async getMoodsAndGenres() {
    if (!currentAdapter.isConfigured()) {
      throw new Error('Provider not configured');
    }

    if (!currentAdapter.getMoodsAndGenres) {
      throw new Error('Provider does not support moods and genres');
    }

    return currentAdapter.getMoodsAndGenres();
  }

  async generateLyrics(prompt = '') {
    if (!currentAdapter.isConfigured()) {
      throw new Error('Provider not configured');
    }

    if (!currentAdapter.generateLyrics) {
      throw new Error('Provider does not support lyrics generation');
    }

    return currentAdapter.generateLyrics(prompt);
  }

  async generate(options) {
    if (!currentAdapter.isConfigured()) {
      aiMusicStore.actions.setError('Provider not configured');

      return null;
    }

    try {
      aiMusicStore.actions.setGenerating({
        provider: currentAdapter.id,
        jobId: null
      });

      EventService.emitLocal(EVENT.AI_MUSIC_GENERATING, {
        title: options.title || null,
        trackCount: 2
      });

      const result = await currentAdapter.generate(options);

      if (!result.jobId) {
        throw new Error('Generation did not return a job id');
      }

      aiMusicStore.actions.setGenerating({
        provider: currentAdapter.id,
        jobId: result.jobId
      });

      JobTrackerService.track(result.jobId, {
        type: 'ai-music',
        audioId: '',
        filename: options.title || 'AI Music',
        title: options.title || null
      });

      return null;
    } catch (error) {
      ErrorHandler.handle(error, currentAdapter.getErrorContext().generate);
      aiMusicStore.actions.setError(error.message);
      EventService.emitLocal(EVENT.AI_MUSIC_ERROR, { error });

      return null;
    }
  }

  recover() {
    // Migrate legacy localStorage entry to JobTrackerService
    const legacyKey = 'studio:ai-music-job';

    try {
      const stored = localStorage.getItem(legacyKey);

      if (stored) {
        const { jobId, title } = JSON.parse(stored);

        if (jobId && !JobTrackerService.isTracking(jobId)) {
          EventService.emitLocal(EVENT.AI_MUSIC_GENERATING, {
            title: title || null,
            trackCount: 2
          });

          JobTrackerService.track(jobId, {
            type: 'ai-music',
            audioId: '',
            filename: title || 'AI Music',
            title: title || null
          });
        }

        localStorage.removeItem(legacyKey);
      }
    } catch {
      // Ignore
    }
  }

  reset() {
    aiMusicStore.actions.reset();
  }
}

export default new AiMusicService();
