/**
 * ThumbnailMapper - Maps continuous render scale to discrete thumbnail scale
 *
 * Thumbnails are pre-generated at discrete scales (0.01, 0.02, 0.05, 0.1).
 * Maps continuous zoom values to the best discrete scale.
 * Strategy: smallest thumbnail scale >= renderScale (sharp, not stretched).
 */

class ThumbnailMapper {
  #availableScales = [];

  setAvailableScales(scales) {
    this.#availableScales = [...scales].sort((a, b) => a - b);
  }

  getAvailableScales() {
    return [...this.#availableScales];
  }

  isScaleAvailable(scale) {
    const numScale = parseFloat(scale);

    return this.#availableScales.includes(numScale);
  }

  getThumbScaleForRenderScale(renderScale) {
    if (this.#availableScales.length === 0) {
      return String(renderScale);
    }

    for (const scale of this.#availableScales) {
      if (scale >= renderScale) {
        return String(scale);
      }
    }

    return String(this.#availableScales[this.#availableScales.length - 1]);
  }

  reset() {
    this.#availableScales = [];
  }
}

const thumbnailMapper = new ThumbnailMapper();

export default thumbnailMapper;
