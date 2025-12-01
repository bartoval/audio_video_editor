import { createElement } from '../../../lib';
import { LABEL } from '../../../config/constants';

export function createForm($parent) {
  let handlers = {};

  const $el = createElement('form', {
    className: 'ai-music-form d-flex flex-column gap-3',
    parent: $parent
  });

  const $lyricsSection = createElement('div', {
    className: 'ai-music-section p-3 mb-3',
    parent: $el
  });

  const $lyricsHeader = createElement('div', {
    className: 'ai-music-section-header d-flex align-items-center justify-content-between mb-1',
    parent: $lyricsSection
  });

  createElement('span', {
    className: 'text-accent fw-semibold small ai-music-section-label mb-2 d-inline-block',
    text: LABEL.AI_MUSIC_LYRICS_LABEL,
    parent: $lyricsHeader
  });

  const $toggleLabel = createElement('label', {
    className: 'ai-music-toggle d-inline-flex align-items-center gap-2',
    parent: $lyricsHeader
  });

  const $instrumentalToggle = createElement('input', {
    attributes: { type: 'checkbox' },
    parent: $toggleLabel
  });

  createElement('span', {
    className: 'ai-music-toggle-slider',
    parent: $toggleLabel
  });

  createElement('span', {
    className: 'ai-music-toggle-label',
    text: LABEL.AI_MUSIC_TYPE_INSTRUMENTAL,
    parent: $toggleLabel
  });

  const $lyricsContent = createElement('div', {
    className: 'ai-music-lyrics-content d-flex flex-column gap-2',
    parent: $lyricsSection
  });

  const $lyricsTextarea = createElement('textarea', {
    className: 'form-control ai-music-textarea',
    attributes: {
      rows: '7',
      maxlength: LABEL.AI_MUSIC_MAX_LYRICS,
      placeholder: LABEL.AI_MUSIC_LYRICS_PLACEHOLDER
    },
    parent: $lyricsContent
  });

  const $lyricsActions = createElement('div', {
    className: 'ai-music-lyrics-actions d-flex justify-content-end',
    parent: $lyricsContent
  });

  const $generateLyricsBtn = createElement('button', {
    className: 'btn btn-sm btn-outline-secondary',
    attributes: { type: 'button' },
    html: `<i class="bi bi-stars me-1"></i>${LABEL.AI_MUSIC_GENERATE_LYRICS}`,
    parent: $lyricsActions
  });

  const $styleSection = createElement('div', {
    className: 'ai-music-section p-3 mb-3',
    parent: $el
  });

  const $styleHeader = createElement('div', {
    className: 'ai-music-section-header d-flex align-items-center justify-content-between mb-1',
    parent: $styleSection
  });

  createElement('span', {
    className: 'text-accent fw-semibold small ai-music-section-label mb-2 d-inline-block',
    text: LABEL.AI_MUSIC_DESC_LABEL,
    parent: $styleHeader
  });

  const $styleTextarea = createElement('textarea', {
    className: 'form-control ai-music-textarea',
    attributes: {
      rows: '4',
      maxlength: LABEL.AI_MUSIC_MAX_DESC,
      placeholder: LABEL.AI_MUSIC_DESC_PLACEHOLDER
    },
    parent: $styleSection
  });

  const $styleTagsRow = createElement('div', {
    className: 'ai-music-style-tags-row d-flex align-items-center gap-2 mt-2',
    parent: $styleSection
  });

  const $refreshStylesBtn = createElement('button', {
    className: 'btn btn-sm btn-outline-secondary rounded-circle',
    attributes: { type: 'button', title: LABEL.AI_MUSIC_REFRESH_STYLES },
    html: '<i class="bi bi-arrow-clockwise"></i>',
    parent: $styleTagsRow
  });

  const $styleTags = createElement('div', {
    className: 'ai-music-style-tags d-flex flex-wrap gap-2 flex-grow-1',
    parent: $styleTagsRow
  });

  const $vocalGenderSection = createElement('div', {
    className:
      'ai-music-section p-3 mb-3 ai-music-vocal-gender-section d-flex align-items-center justify-content-between',
    parent: $el
  });

  createElement('span', {
    className: 'text-accent fw-semibold small ai-music-section-label mb-2 d-inline-block',
    text: LABEL.AI_MUSIC_VOCAL_GENDER,
    parent: $vocalGenderSection
  });

  const $genderButtons = createElement('div', {
    className: 'ai-music-gender-buttons d-flex gap-2',
    parent: $vocalGenderSection
  });

  const $femaleBtn = createElement('button', {
    className: 'btn btn-sm btn-outline-light ai-music-gender-btn',
    attributes: { type: 'button', 'data-gender': 'female' },
    text: LABEL.AI_MUSIC_VOCAL_FEMALE,
    parent: $genderButtons
  });

  const $maleBtn = createElement('button', {
    className: 'btn btn-sm btn-outline-light ai-music-gender-btn',
    attributes: { type: 'button', 'data-gender': 'male' },
    text: LABEL.AI_MUSIC_VOCAL_MALE,
    parent: $genderButtons
  });

  const $titleSection = createElement('div', {
    className: 'ai-music-section p-3 mb-3',
    parent: $el
  });

  createElement('span', {
    className: 'text-accent fw-semibold small ai-music-section-label mb-2 d-inline-block',
    text: LABEL.AI_MUSIC_SONG_TITLE,
    parent: $titleSection
  });

  const $titleWrapper = createElement('div', {
    className: 'ai-music-title-input-wrapper position-relative',
    parent: $titleSection
  });

  const $titleInput = createElement('input', {
    className: 'form-control',
    attributes: {
      type: 'text',
      maxlength: LABEL.AI_MUSIC_MAX_TITLE,
      placeholder: LABEL.AI_MUSIC_SONG_TITLE_PLACEHOLDER
    },
    parent: $titleWrapper
  });

  const $titleCounter = createElement('span', {
    className: 'ai-music-title-counter',
    text: `0/${LABEL.AI_MUSIC_MAX_TITLE}`,
    parent: $titleWrapper
  });

  const $createBtn = createElement('button', {
    className: 'btn ai-music-create-btn w-100 mt-2 rounded-pill',
    attributes: { type: 'button' },
    html: `<i class="bi bi-music-note-beamed me-2"></i>${LABEL.AI_MUSIC_GENERATE}`,
    parent: $el
  });

  $instrumentalToggle.addEventListener('change', () =>
    handlers.onToggleInstrumental?.($instrumentalToggle.checked)
  );
  $generateLyricsBtn.addEventListener('click', () => handlers.onGenerateLyrics?.());
  $refreshStylesBtn.addEventListener('click', () => handlers.onRefreshStyles?.());
  $femaleBtn.addEventListener('click', () => handlers.onGenderSelect?.('female'));
  $maleBtn.addEventListener('click', () => handlers.onGenderSelect?.('male'));
  $titleInput.addEventListener('input', () => handlers.onTitleInput?.($titleInput.value));
  $createBtn.addEventListener('click', () => handlers.onGenerate?.());

  $styleTags.addEventListener('click', event => {
    const tagBtn = event.target.closest('[data-tag]');

    if (tagBtn) {
      handlers.onTagClick?.(tagBtn.dataset.tag);
    }
  });

  return {
    el: $el,

    bind(newHandlers) {
      handlers = newHandlers;
    },

    getValues() {
      return {
        lyrics: $lyricsTextarea.value.trim(),
        style: $styleTextarea.value.trim(),
        title: $titleInput.value.trim()
      };
    },

    setLyrics(text) {
      $lyricsTextarea.value = text;
    },

    appendStyle(tag) {
      const current = $styleTextarea.value.trim();
      const tags = current ? current.split(',').map(item => item.trim()) : [];

      if (!tags.includes(tag)) {
        tags.push(tag);
        $styleTextarea.value = tags.join(', ');
      }
    },

    setState({ isInstrumental, vocalGender, titleLength, isGenerating, isGeneratingLyrics }) {
      $lyricsContent.classList.toggle('d-none', isInstrumental);
      $vocalGenderSection.classList.toggle('d-none', isInstrumental);

      $femaleBtn.classList.toggle('active', vocalGender === 'female');
      $maleBtn.classList.toggle('active', vocalGender === 'male');

      if (titleLength !== undefined) {
        $titleCounter.textContent = `${titleLength}/${LABEL.AI_MUSIC_MAX_TITLE}`;
      }

      if (isGenerating !== undefined) {
        $createBtn.disabled = isGenerating;
      }

      if (isGeneratingLyrics !== undefined) {
        $generateLyricsBtn.disabled = isGeneratingLyrics;
        $generateLyricsBtn.innerHTML = isGeneratingLyrics
          ? `<span class="spinner-border spinner-border-sm me-1"></span>${LABEL.AI_MUSIC_GENERATING_LYRICS}`
          : `<i class="bi bi-stars me-1"></i>${LABEL.AI_MUSIC_GENERATE_LYRICS}`;
      }
    },

    renderTags(tags) {
      $styleTags.replaceChildren();

      tags.forEach(tag => {
        createElement('button', {
          className: 'btn btn-sm btn-outline-secondary ai-music-tag',
          attributes: { type: 'button', 'data-tag': tag },
          html: `<i class="bi bi-plus"></i> ${tag}`,
          parent: $styleTags
        });
      });
    },

    reset() {
      $lyricsTextarea.value = '';
      $styleTextarea.value = '';
      $titleInput.value = '';
      $titleCounter.textContent = `0/${LABEL.AI_MUSIC_MAX_TITLE}`;
      $instrumentalToggle.checked = false;
      $lyricsContent.classList.remove('d-none');
      $vocalGenderSection.classList.remove('d-none');
      $femaleBtn.classList.remove('active');
      $maleBtn.classList.remove('active');
    },

    showNotConfigured() {
      $el.innerHTML = `
        <div class="alert alert-warning">
          <i class="bi bi-exclamation-triangle me-2"></i>
          ${LABEL.AI_MUSIC_NO_API_KEY}
        </div>
      `;
      $createBtn.disabled = true;
    },

    focusLyrics() {
      $lyricsTextarea.focus();
    },

    focusStyle() {
      $styleTextarea.focus();
    }
  };
}
