import { THEME } from '../../../../config/ui';
import { View } from '../../../../lib';

const { defaultColor, btnVariant } = THEME;

/** Scenes navigation and editing toolbar */
export default class ScenesToolbar extends View {
  #$sceneSelect = null;
  #$labelInput = null;
  #$colorInput = null;
  #scenesContainer = null;

  constructor($parent) {
    super($parent);
    this.mount();
  }

  template() {
    return `
      <div class="d-flex align-items-center gap-2">
        <div class="input-group">
          <select data-ref="sceneSelect" class="form-select" style="width: 120px" title="Go to scene"></select>
          <button data-action="edit" class="btn btn-${btnVariant.secondary}" title="Edit scene name">
            <i class="bi bi-pencil"></i>
          </button>
          <input data-ref="labelInput" type="text" class="form-control d-none" style="width: 100px" placeholder="Name...">
          <input data-ref="colorInput" type="color" class="form-control form-control-color" title="Color">
        </div>
        <div class="btn-group">
          <button data-action="back" class="btn btn-${btnVariant.primary}" title="Previous" disabled>
            <i class="bi bi-chevron-left"></i>
          </button>
          <button data-action="forward" class="btn btn-${btnVariant.primary}" title="Next" disabled>
            <i class="bi bi-chevron-right"></i>
          </button>
        </div>
        <button data-action="add" class="btn btn-${btnVariant.primary}" title="Add Scene">
          <i class="bi bi-plus-circle"></i>
        </button>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);

    this.#$sceneSelect = this.$node.querySelector('[data-ref="sceneSelect"]');
    this.#$labelInput = this.$node.querySelector('[data-ref="labelInput"]');
    this.#$colorInput = this.$node.querySelector('[data-ref="colorInput"]');
  }

  onMount() {
    this.$node.addEventListener('click', this.#handleClick);
    this.#$sceneSelect.addEventListener('change', this.#handleSelectChange);
    this.#$labelInput.addEventListener('keyup', this.#handleLabelKeyup);
    this.#$labelInput.addEventListener('blur', this.#handleLabelBlur);
    this.#$colorInput.addEventListener('input', this.#handleColorInput);
  }

  setScenes(scenes) {
    this.#scenesContainer = scenes;
  }

  update() {
    this.#updateValues();
  }

  // ============================================================================
  // Private
  // ============================================================================

  #handleClick = e => {
    const $target = e.target.closest('[data-action]');

    if (!$target) {
      return;
    }

    e.stopPropagation();
    e.preventDefault();

    const { action } = $target.dataset;

    if (action === 'edit') {
      const hidden = this.#$labelInput.classList.contains('d-none');
      this.#$labelInput.classList.toggle('d-none', !hidden);

      if (hidden) {
        this.#$labelInput.focus();
        this.#$labelInput.select();
      }

      return;
    }

    if (!this.#scenesContainer) {
      return;
    }

    if (action === 'add') {
      this.#scenesContainer.addNew();
    } else if (action === 'back') {
      this.#scenesContainer.back();
      this.#updateValues();
    } else if (action === 'forward') {
      this.#scenesContainer.forward();
      this.#updateValues();
    }
  };

  #handleSelectChange = e => {
    if (!this.#scenesContainer) {
      return;
    }

    this.#scenesContainer.select(e.target.value);
    this.#updateValues();
  };

  #handleLabelKeyup = e => {
    const scene = this.#scenesContainer?.getSelected();

    if (scene) {
      this.#scenesContainer.edit(scene, {
        label: e.target.value,
        color: this.#$colorInput.value,
        description: ''
      });
      this.#updateSelect();
    }

    if (e.key === 'Enter') {
      this.#$labelInput.classList.add('d-none');
    }
  };

  #handleLabelBlur = () => {
    this.#$labelInput.classList.add('d-none');
  };

  #handleColorInput = e => {
    const scene = this.#scenesContainer?.getSelected();

    if (scene) {
      this.#scenesContainer.edit(scene, {
        label: this.#$labelInput.value,
        color: e.target.value,
        description: ''
      });
      this.#$colorInput.style.backgroundColor = e.target.value;
    }
  };

  #updateValues() {
    if (!this.#scenesContainer) {
      return;
    }

    const scene = this.#scenesContainer.getSelected();

    if (!scene) {
      this.#$labelInput.value = '';
      this.#$colorInput.value = defaultColor;
      this.#$colorInput.style.backgroundColor = defaultColor;
      this.#updateSelect();

      return;
    }

    this.#$labelInput.value = scene.getLabel() || '';
    const color = scene.getColor() || defaultColor;
    this.#$colorInput.value = color;
    this.#$colorInput.style.backgroundColor = color;
    this.#updateSelect();
  }

  #updateSelect() {
    if (!this.#$sceneSelect || !this.#scenesContainer) {
      return;
    }

    const scenes = this.#scenesContainer.items.all();
    const selected = this.#scenesContainer.getSelected();
    const selectedId = selected?.getId() || null;

    this.#$sceneSelect.innerHTML = '';
    scenes.forEach((scene, i) => {
      const $opt = document.createElement('option');
      $opt.value = scene.getId();
      $opt.textContent = scene.getLabel() || `Scene ${i + 1}`;
      $opt.selected = scene.getId() === selectedId;
      this.#$sceneSelect.appendChild($opt);
    });

    this.#$sceneSelect.disabled = scenes.length === 0;

    const navDisabled = scenes.length <= 1;
    this.$node.querySelectorAll('[data-action="back"], [data-action="forward"]').forEach($btn => {
      $btn.disabled = navDisabled;
    });
  }
}
