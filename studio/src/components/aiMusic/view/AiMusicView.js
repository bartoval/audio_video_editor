import { createElement, View } from '../../../lib';

import { createForm } from './createForm';

export default class AiMusicView extends View {
  #form = null;

  render() {
    this.$node = createElement('div', {
      className: 'ai-music-content',
      parent: this.$parent
    });

    this.#form = createForm(this.$node);
  }

  onReady() {
    this.#form.bind({
      onToggleInstrumental: isInstrumental => this.emit('toggleInstrumental', { isInstrumental }),
      onGenerateLyrics: () => this.emit('generateLyrics'),
      onRefreshStyles: () => this.emit('refreshStyles'),
      onGenderSelect: gender => this.emit('genderSelect', { gender }),
      onTitleInput: value => this.emit('titleInput', { value }),
      onTagClick: tag => this.emit('tagClick', { tag }),
      onGenerate: () => this.emit('generate', this.#form.getValues())
    });
  }

  update(state) {
    const {
      isInstrumental,
      vocalGender,
      titleLength,
      isGenerating,
      isGeneratingLyrics,
      styleTags,
      isConfigured
    } = state;

    if (!isConfigured) {
      this.#form.showNotConfigured();

      return;
    }

    this.#form.setState({
      isInstrumental,
      vocalGender,
      titleLength,
      isGenerating,
      isGeneratingLyrics
    });

    if (styleTags) {
      this.#form.renderTags(styleTags);
    }
  }

  showNotConfigured() {
    this.#form.showNotConfigured();
  }

  setLyrics(text) {
    this.#form.setLyrics(text);
  }

  appendStyle(tag) {
    this.#form.appendStyle(tag);
  }

  reset() {
    this.#form.reset();
  }

  focusLyrics() {
    this.#form.focusLyrics();
  }

  focusStyle() {
    this.#form.focusStyle();
  }
}
