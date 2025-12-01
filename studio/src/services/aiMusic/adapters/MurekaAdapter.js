import { ERROR_CONTEXT } from '../../../config/constants';
import { AI_MUSIC } from '../../../config/routes';
import { getUuid } from '../../workspace';

class MurekaAdapter {
  #configured = null;
  #models = [];
  #defaultModel = null;

  get id() {
    return 'mureka';
  }

  get name() {
    return 'Mureka';
  }

  isConfigured() {
    // Until config is fetched, assume true to keep UI usable
    return this.#configured !== false;
  }

  async #ensureConfigured() {
    if (this.#configured !== null) {
      if (this.#configured === false) {
        throw new Error(ERROR_CONTEXT.AI_MUSIC_API_KEY);
      }

      return;
    }

    try {
      const response = await fetch(AI_MUSIC.config);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      this.#configured = !!data.configured;
      this.#models = data.models || [];
      this.#defaultModel = data.defaultModel || null;
    } catch (error) {
      this.#configured = false;
      throw new Error(ERROR_CONTEXT.AI_MUSIC_API_KEY, { cause: error });
    }

    if (!this.#configured) {
      throw new Error(ERROR_CONTEXT.AI_MUSIC_API_KEY);
    }
  }

  getModels() {
    return this.#models.map(model => ({
      ...model,
      name: model.id === this.#defaultModel ? `${model.name} (Default)` : model.name
    }));
  }

  supportsLyrics() {
    return true;
  }

  supportsInstrumental() {
    return true;
  }

  supportsLyricsGeneration() {
    return true;
  }

  async getMoodsAndGenres() {
    await this.#ensureConfigured();

    const response = await fetch(AI_MUSIC.moodsAndGenres);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      genres: data.genres || [],
      moods: data.moods || []
    };
  }

  async generateLyrics(prompt = '') {
    await this.#ensureConfigured();

    const body = prompt ? { prompt } : {};

    const response = await fetch(AI_MUSIC.lyrics, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    return data.lyrics || '';
  }

  async generate(options) {
    const { type, prompt, title, lyrics, description, model, vocalGender } = options;
    await this.#ensureConfigured();

    const isInstrumental = type === 'instrumental';
    const uuid = getUuid();
    const body = { type, uuid };

    if (model) body.model = model;

    if (title) body.title = title;

    if (isInstrumental) {
      if (prompt) body.description = prompt;
      if (description && !body.description) body.description = description;
    } else {
      if (!lyrics) {
        throw new Error(ERROR_CONTEXT.AI_MUSIC_LYRICS_REQUIRED);
      }

      body.lyrics = lyrics;
      if (description) body.description = description;
      if (vocalGender) body.vocalGender = vocalGender;
    }

    const response = await fetch(AI_MUSIC.generate, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    return {
      complete: false,
      jobId: data.jobId
    };
  }

  getErrorContext() {
    return {
      generate: ERROR_CONTEXT.AI_MUSIC_GENERATE
    };
  }
}

export default new MurekaAdapter();
