import { ERROR_CONTEXT } from '../../config/constants';
import { AiMusicService } from '../../services/aiMusic';
import ErrorHandler from '../../services/ErrorHandler';
import { aiMusicStore } from '../../store';
import { AI_MUSIC_STATUS } from '../../store/aiMusicStore';

export default class AiMusicPresenter {
  #view = null;
  #unsubscribe = null;
  #onGenerateCallback = null;
  #moodsAndGenres = { genres: [], moods: [] };

  #state = {
    isInstrumental: false,
    vocalGender: null,
    titleLength: 0,
    isGenerating: false,
    isGeneratingLyrics: false,
    styleTags: [],
    isConfigured: true
  };

  constructor(view) {
    this.#view = view;
    this.#view.setPresenter(this);
  }

  async init() {
    this.#view.mount();
    this.#view.ready();

    this.#subscribeToStore();

    this.#state.isConfigured = AiMusicService.isConfigured();
    this.#syncViewState();

    if (this.#state.isConfigured) {
      await this.#loadMoodsAndGenres();
    }
  }

  setOnGenerate(callback) {
    this.#onGenerateCallback = callback;
  }

  onViewEvent(eventName, data) {
    const handlers = {
      toggleInstrumental: () => this.#onToggleInstrumental(data.isInstrumental),
      generateLyrics: () => this.#onGenerateLyrics(),
      refreshStyles: () => this.#refreshStyleTags(),
      genderSelect: () => this.#onGenderSelect(data.gender),
      titleInput: () => this.#onTitleInput(data.value),
      tagClick: () => this.#onTagClick(data.tag),
      generate: () => this.#onGenerate(data)
    };

    if (handlers[eventName]) {
      handlers[eventName]();
    }
  }

  reset() {
    AiMusicService.reset();

    this.#state = {
      ...this.#state,
      isInstrumental: false,
      vocalGender: null,
      titleLength: 0,
      isGenerating: false,
      isGeneratingLyrics: false
    };

    this.#syncViewState();
    this.#view.reset();
  }

  dispose() {
    if (this.#unsubscribe) {
      this.#unsubscribe();
      this.#unsubscribe = null;
    }

    this.#view.destroy();
  }

  #subscribeToStore() {
    this.#unsubscribe = aiMusicStore.subscribe(state => {
      this.#onStoreChange(state);
    });
  }

  #onStoreChange(storeState) {
    const { status } = storeState;
    const isGenerating = status === AI_MUSIC_STATUS.GENERATING;

    this.#state.isGenerating = isGenerating;
    this.#syncViewState();
  }

  async #loadMoodsAndGenres() {
    try {
      this.#moodsAndGenres = await AiMusicService.getMoodsAndGenres();
      this.#refreshStyleTags();
    } catch (error) {
      if (error.message === ERROR_CONTEXT.AI_MUSIC_API_KEY) {
        this.#state.isConfigured = false;
        this.#syncViewState();
        this.#view.showNotConfigured();
        return;
      }

      ErrorHandler.handle(error, ERROR_CONTEXT.AI_MUSIC_GENERATE);
    }
  }

  #refreshStyleTags() {
    const { genres, moods } = this.#moodsAndGenres;
    const allTags = [...genres.map(genre => genre.tag), ...moods.map(mood => mood.tag)];

    if (allTags.length === 0) {
      this.#state.styleTags = [];
      this.#syncViewState();

      return;
    }

    const shuffled = allTags.sort(() => Math.random() - 0.5);
    this.#state.styleTags = shuffled.slice(0, 5);
    this.#syncViewState();
  }

  #onToggleInstrumental(isInstrumental) {
    this.#state.isInstrumental = isInstrumental;
    this.#syncViewState();
  }

  #onGenderSelect(gender) {
    this.#state.vocalGender = this.#state.vocalGender === gender ? null : gender;
    this.#syncViewState();
  }

  #onTitleInput(value) {
    this.#state.titleLength = value.length;
    this.#syncViewState();
  }

  #onTagClick(tag) {
    this.#view.appendStyle(tag);
  }

  async #onGenerateLyrics() {
    this.#state.isGeneratingLyrics = true;
    this.#syncViewState();

    try {
      const lyrics = await AiMusicService.generateLyrics();
      this.#view.setLyrics(lyrics);
    } catch (error) {
      ErrorHandler.handle(error, ERROR_CONTEXT.AI_MUSIC_GENERATE);
    } finally {
      this.#state.isGeneratingLyrics = false;
      this.#syncViewState();
    }
  }

  async #onGenerate(formValues) {
    const { lyrics, style, title } = formValues;
    const type = this.#state.isInstrumental ? 'instrumental' : 'vocal';

    const options = { type, title, description: style };

    if (!style) {
      this.#view.focusStyle();

      return;
    }

    if (this.#state.isInstrumental) {
      options.prompt = style;
    } else {
      if (!lyrics) {
        this.#view.focusLyrics();

        return;
      }

      options.lyrics = lyrics;

      if (this.#state.vocalGender) {
        options.vocalGender = this.#state.vocalGender;
      }
    }

    this.#onGenerateCallback?.();

    // Fire and forget: errors are handled without blocking the UI/modal
    AiMusicService.generate(options).catch(error =>
      ErrorHandler.handle(error, ERROR_CONTEXT.AI_MUSIC_GENERATE)
    );
  }

  #syncViewState() {
    this.#view.update(this.#state);
  }
}
