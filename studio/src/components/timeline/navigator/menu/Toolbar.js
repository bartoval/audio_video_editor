import Config from 'Config';

const { defaultColor, btnVariant } = Config.getUI();

/** Debounce helper */
const debounce = (fn, delay) => {
  let timeoutId;

  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

export default class Toolbar {
  constructor($parent) {
    this.$node = null;
    this.$tracksToolbar = null;
    this.$scenesToolbar = null;
    this.$sceneSelect = null;
    this.$labelInput = null;
    this.$colorInput = null;
    this.$pitchInput = null;
    this.zones = null;
    this.zone = null;
    this.type = null;
    this.commands = {};
    this.cmdEnabled = '';
    this._debouncedPitch = debounce(value => {
      if (this.zone) {
        this.zone.setPitch(value);
      }
    }, 400);

    this.render($parent);
  }

  set(zones, type) {
    const zoneSelected = zones ? zones.getSelected() : null;

    // Only deselect tracks, never scenes (scenes should always have a selection)
    if (this.zone !== null && this.zone.$node !== null && type !== this.type && this.zones !== null && this.type === 'tracks') {
      this.zone.deselect();
      this.zones.setSelected(null);
    }

    if (zoneSelected && this.zone !== zoneSelected) {
      this.clean();
      this.zones = zones;
      this.zone = zoneSelected;
      this.type = type;
      this.commands = zoneSelected.getCommands();
      this.cmdEnabled = '';
      this._updateUI();

      return true;
    }

    if (!zoneSelected) {
      this.clean();
      this._updateUI();
    }

    return true;
  }

  clean() {
    this.zone = null;
    this.cmdEnabled = '';

    for (const key in this.commands) {
      if (this.commands.hasOwnProperty(key) && key !== '') {
        this.commands[key] = false;
      }
    }

    return true;
  }

  enableCmd(cmd) {
    this.commands[this.cmdEnabled] = !this.commands[this.cmdEnabled];
    this.commands[cmd] = this.cmdEnabled !== cmd;
    this.cmdEnabled = this.cmdEnabled !== cmd ? cmd : '';
    this._updateUI();

    return this.commands[cmd];
  }

  _updateUI() {
    const hasSelection = this.zone !== null;
    const isTrackMode = this.type !== 'scenes';

    // Only disable track toolbar based on track selection
    this.$tracksToolbar.querySelectorAll('button, input').forEach($el => {
      $el.disabled = !hasSelection || !isTrackMode;
    });

    if (!hasSelection) {
      if (this.$pitchInput) {
        this.$pitchInput.value = 0;
        const $pitchValue = this.$pitchInput.nextElementSibling;

        if ($pitchValue) {
          $pitchValue.textContent = '0';
        }
      }

      // Always update scene toolbar values
      this._updateSceneToolbarValues();

      return;
    }

    const $toolbar = isTrackMode ? this.$tracksToolbar : this.$scenesToolbar;

    $toolbar.querySelectorAll('[data-action]').forEach($btn => {
      const action = $btn.dataset.action;
      const isEnabled = this.commands[action];
      $btn.classList.toggle('active', isEnabled);
    });

    if (isTrackMode) {
      if (this.$pitchInput) {
        this.$pitchInput.value = this.zone.getPitch ? this.zone.getPitch() : 0;
        const $pitchValue = this.$pitchInput.nextElementSibling;

        if ($pitchValue) {
          $pitchValue.textContent = this.$pitchInput.value;
        }
      }
    }

    // Always update scene toolbar with current scene data
    this._updateSceneToolbarValues();
  }

  _updateSceneToolbarValues() {
    if (!this.scenesContainer) {
      return;
    }

    const currentScene = this.scenesContainer.getSelected();

    if (!currentScene) {
      if (this.$labelInput) {
        this.$labelInput.value = '';
      }

      if (this.$colorInput) {
        this.$colorInput.value = defaultColor;
        this.$colorInput.style.backgroundColor = defaultColor;
      }

      this._updateSceneSelect();

      return;
    }

    if (this.$labelInput) {
      this.$labelInput.value = currentScene.getLabel() || '';
    }

    if (this.$colorInput) {
      const color = currentScene.getColor() || defaultColor;
      this.$colorInput.value = color;
      this.$colorInput.style.backgroundColor = color;
    }

    this._updateSceneSelect();
  }

  _updateSceneSelect() {
    if (!this.$sceneSelect || !this.scenesContainer) {
      return;
    }

    const scenes = this.scenesContainer.getAllChildren();
    const currentScene = this.scenesContainer.getSelected();
    const selectedId = currentScene ? currentScene.getId() : null;

    this.$sceneSelect.innerHTML = '';

    scenes.forEach((scene, index) => {
      const $option = document.createElement('option');
      $option.value = scene.getId();
      $option.textContent = scene.getLabel() || `Scene ${index + 1}`;
      $option.selected = scene.getId() === selectedId;
      this.$sceneSelect.appendChild($option);
    });

    this.$sceneSelect.disabled = scenes.length === 0;

    // Enable nav buttons only if more than one scene
    const hasMultipleScenes = scenes.length > 1;

    this.$sceneNavButtons.forEach($btn => {
      $btn.disabled = !hasMultipleScenes;
    });
  }

  _createButton(icon, title, action, variant = btnVariant.primary) {
    const $btn = document.createElement('button');
    $btn.className = `btn btn-sm btn-${variant}`;
    $btn.title = title;
    $btn.dataset.action = action;
    $btn.innerHTML = `<i class="bi bi-${icon}"></i>`;
    $btn.disabled = true; // Start disabled until selection

    return $btn;
  }

  setScenes(scenes) {
    this.scenesContainer = scenes;
  }

  updateSceneToolbar() {
    this._updateSceneToolbarValues();
  }

  render($parent) {
    this.$node = document.createElement('div');
    this.$node.className = 'd-flex align-items-center gap-2 flex-grow-1';
    $parent.appendChild(this.$node);

    this._renderTracksToolbar();
    this._renderScenesToolbar();

    // Add Scene button - always visible, timeline-level action
    this.$addSceneBtn = document.createElement('button');
    this.$addSceneBtn.className = `btn btn-sm btn-${btnVariant.primary}`;
    this.$addSceneBtn.title = 'Add Scene';
    this.$addSceneBtn.innerHTML = '<i class="bi bi-plus-circle"></i>';
    this.$addSceneBtn.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();

      if (this.scenesContainer) {
        this.scenesContainer.addNew();
      }
    });
    this.$node.appendChild(this.$addSceneBtn);
  }

  _renderTracksToolbar() {
    this.$tracksToolbar = document.createElement('div');
    this.$tracksToolbar.className = 'd-flex align-items-center gap-2';
    this.$node.appendChild(this.$tracksToolbar);

    const $btnGroup = document.createElement('div');
    $btnGroup.className = 'btn-group btn-group-sm';
    this.$tracksToolbar.appendChild($btnGroup);

    const trackActions = [
      { icon: 'scissors', title: 'Cut', action: 'cut' },
      { icon: 'copy', title: 'Copy', action: 'copy' },
      { icon: 'trash', title: 'Delete', action: 'remove' }
    ];

    trackActions.forEach(({ icon, title, action }) => {
      const $btn = this._createButton(icon, title, action);
      $btn.addEventListener('click', e => this._handleTrackAction(e, action));
      $btnGroup.appendChild($btn);
    });

    const $audioGroup = document.createElement('div');
    $audioGroup.className = 'btn-group btn-group-sm ms-2';
    this.$tracksToolbar.appendChild($audioGroup);

    const audioActions = [
      { icon: 'volume-up', title: 'Volume envelope', action: 'volume' },
      { icon: 'arrows-expand', title: 'Pan envelope', action: 'pan' }
    ];

    audioActions.forEach(({ icon, title, action }) => {
      const $btn = this._createButton(icon, title, action);
      $btn.addEventListener('click', e => this._handleTrackAction(e, action));
      $audioGroup.appendChild($btn);
    });

    const $pitchContainer = document.createElement('div');
    $pitchContainer.className = 'd-flex align-items-center gap-2 ms-3';
    this.$tracksToolbar.appendChild($pitchContainer);

    const $pitchLabel = document.createElement('small');
    $pitchLabel.className = 'text-body-tertiary';
    $pitchLabel.textContent = 'Pitch';
    $pitchContainer.appendChild($pitchLabel);

    this.$pitchInput = document.createElement('input');
    this.$pitchInput.type = 'range';
    this.$pitchInput.className = 'form-range';
    this.$pitchInput.style.width = '80px';
    this.$pitchInput.min = '-12';
    this.$pitchInput.max = '12';
    this.$pitchInput.value = '0';
    this.$pitchInput.dataset.action = 'pitch';
    this.$pitchInput.disabled = true; // Start disabled until selection
    this.$pitchInput.addEventListener('input', e => {
      this._debouncedPitch(e.target.value);
    });
    $pitchContainer.appendChild(this.$pitchInput);

    const $pitchValue = document.createElement('small');
    $pitchValue.className = 'text-body-secondary font-monospace';
    $pitchValue.style.width = '2rem';
    $pitchValue.textContent = '0';
    this.$pitchInput.addEventListener('input', () => {
      $pitchValue.textContent = this.$pitchInput.value;
    });
    $pitchContainer.appendChild($pitchValue);
  }

  _renderScenesToolbar() {
    this.$scenesToolbar = document.createElement('div');
    this.$scenesToolbar.className = 'd-flex align-items-center gap-2';
    this.$node.appendChild(this.$scenesToolbar);

    const $sceneGroup = document.createElement('div');
    $sceneGroup.className = 'input-group input-group-sm';
    this.$scenesToolbar.appendChild($sceneGroup);

    this.$sceneSelect = document.createElement('select');
    this.$sceneSelect.className = 'form-select';
    this.$sceneSelect.style.width = '120px';
    this.$sceneSelect.title = 'Go to scene';
    this.$sceneSelect.addEventListener('change', e => {
      if (this.scenesContainer) {
        this.scenesContainer.select(e.target.value);
        this._updateSceneToolbarValues();
      }
    });
    $sceneGroup.appendChild(this.$sceneSelect);

    // Edit button to toggle label input
    this.$editSceneBtn = document.createElement('button');
    this.$editSceneBtn.className = `btn btn-sm btn-${btnVariant.secondary}`;
    this.$editSceneBtn.title = 'Edit scene name';
    this.$editSceneBtn.innerHTML = '<i class="bi bi-pencil"></i>';
    this.$editSceneBtn.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      const isHidden = this.$labelInput.classList.contains('d-none');
      this.$labelInput.classList.toggle('d-none', !isHidden);

      if (isHidden) {
        this.$labelInput.focus();
        this.$labelInput.select();
      }
    });
    $sceneGroup.appendChild(this.$editSceneBtn);

    this.$labelInput = document.createElement('input');
    this.$labelInput.type = 'text';
    this.$labelInput.className = 'form-control d-none';
    this.$labelInput.style.width = '100px';
    this.$labelInput.placeholder = 'Name...';
    this.$labelInput.dataset.action = 'label';
    this.$labelInput.addEventListener('keyup', e => {
      const currentScene = this.scenesContainer?.getSelected();

      if (currentScene && this.scenesContainer) {
        this.scenesContainer.edit(currentScene, { label: e.target.value, color: this.$colorInput.value, description: '' });
        this._updateSceneSelect();
      }

      if (e.key === 'Enter') {
        this.$labelInput.classList.add('d-none');
      }
    });
    this.$labelInput.addEventListener('blur', () => {
      this.$labelInput.classList.add('d-none');
    });
    $sceneGroup.appendChild(this.$labelInput);

    this.$colorInput = document.createElement('input');
    this.$colorInput.type = 'color';
    this.$colorInput.className = 'form-control form-control-color';
    this.$colorInput.title = 'Color';
    this.$colorInput.dataset.action = 'color';
    this.$colorInput.addEventListener('input', e => {
      const currentScene = this.scenesContainer?.getSelected();

      if (currentScene && this.scenesContainer) {
        this.scenesContainer.edit(currentScene, { label: this.$labelInput.value, color: e.target.value, description: '' });
        this.$colorInput.style.backgroundColor = e.target.value;
      }
    });
    $sceneGroup.appendChild(this.$colorInput);

    const $navGroup = document.createElement('div');
    $navGroup.className = 'btn-group btn-group-sm';
    this.$scenesToolbar.appendChild($navGroup);

    this.$sceneNavButtons = [];
    [
      { icon: 'chevron-left', title: 'Previous', action: 'back' },
      { icon: 'chevron-right', title: 'Next', action: 'forward' }
    ].forEach(({ icon, title, action }) => {
      const $btn = document.createElement('button');
      $btn.className = `btn btn-sm btn-${btnVariant.primary}`;
      $btn.title = title;
      $btn.innerHTML = `<i class="bi bi-${icon}"></i>`;
      $btn.disabled = true;
      $btn.addEventListener('click', e => this._handleSceneAction(e, action));
      this.$sceneNavButtons.push($btn);
      $navGroup.appendChild($btn);
    });
  }

  _handleTrackAction(e, action) {
    e.stopPropagation();
    e.preventDefault();

    if (!this.zone) {
      return;
    }

    switch (action) {
      case 'back':
        this.zones.back();
        break;
      case 'forward':
        this.zones.forward();
        break;
      case 'cut':
        this.zones.cut();
        break;
      case 'copy':
        this.zones.clone();
        break;
      case 'remove':
        this.clean();
        this._updateUI();
        this.zones.remove();
        break;
      case 'volume':
        this.enableCmd(action) ? this.zone.volumeShow() : this.zone.volumeHide();
        break;
      case 'pan':
        this.enableCmd(action) ? this.zone.panShow() : this.zone.panHide();
        break;
    }
  }

  _handleSceneAction(e, action) {
    e.stopPropagation();
    e.preventDefault();

    if (!this.scenesContainer) {
      return;
    }

    switch (action) {
      case 'back':
        this.scenesContainer.back();
        this._updateSceneToolbarValues();
        break;
      case 'forward':
        this.scenesContainer.forward();
        this._updateSceneToolbarValues();
        break;
    }
  }
}
