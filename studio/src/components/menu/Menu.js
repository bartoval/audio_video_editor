import Mediator from 'Mediator';
import Project from 'Project/Main';
import Signals from 'signals';
import Config from 'Config';
import ProjectSelector from './ProjectSelector';
import PreviewModal from './PreviewModal';

export default class Menu {
  constructor($parent) {
    this.$node = null;
    this.isExporting = false;
    this.services = new Project();
    this.onGetData = new Signals.Signal();
    this.previewModal = new PreviewModal();

    this.onGetData.add(() => Mediator.getData());
    this.render($parent);
  }

  _renderWasmToggle($parent) {
    const $container = document.createElement('div');
    $container.className = 'd-flex align-items-center gap-2 me-3';

    const $label = document.createElement('label');
    $label.className = 'd-flex align-items-center gap-2 small text-secondary mb-0';
    $label.style.cursor = 'pointer';

    const $checkbox = document.createElement('input');
    $checkbox.type = 'checkbox';
    $checkbox.className = 'form-check-input mt-0';
    $checkbox.id = 'wasm-toggle';
    $checkbox.checked = Config.isWasmEnabled();
    $checkbox.disabled = !Config.isWasmSupported();

    const $text = document.createElement('span');
    $text.textContent = 'WASM';
    $text.title = Config.isWasmSupported()
      ? 'FFmpeg WASM enabled - processing in browser'
      : 'SharedArrayBuffer not available - server fallback';

    $checkbox.addEventListener('change', e => {
      Config.setWasmEnabled(e.target.checked);
      console.log('[Config] WASM:', e.target.checked ? 'enabled' : 'disabled');
    });

    $label.appendChild($checkbox);
    $label.appendChild($text);
    $container.appendChild($label);
    $parent.appendChild($container);
  }

  render($parent) {
    const _load = e => {
        e.stopPropagation();
        e.preventDefault();

        this.services.load()
        .then(response => {
          let isEmpty = Object.keys(response).length === 0;
          isEmpty === false && Mediator.onLoadVideo(response.video, response) && Mediator.onMessage({
            type: 'success',
            msg: 'Project loaded',
            timeHide: 2000
          });
        })
        .catch(err => {
          console.log(err);
          Mediator.onMessage({type: 'error', timeHide: 2000});
        });
      },
      _backup = e => {
        e.stopPropagation();
        e.preventDefault();
        let data = Mediator.getData();

        this.services.backup(data)
        .then(() => {
          Mediator.onMessage({type: 'success', timeHide: 2000});
        })
        .catch(err => {
          console.log(err);
          Mediator.onMessage({type: 'error', timeHide: 2000});
        });
      },
      _publish = e => {
        e.stopPropagation();
        e.preventDefault();

        if (this.isExporting) {
          return;
        }

        this.isExporting = true;
        this.previewModal.showLoading();

        const data = Mediator.getData();

        this.services.publish(data)
          .then(response => {
            this.isExporting = false;
            this.previewModal.showVideo(response.res);
          })
          .catch(err => {
            console.log(err);
            this.isExporting = false;
            this.previewModal.showError('Export failed');
          });
      };

    // Project Selector (navbar-brand area)
    new ProjectSelector($parent);

    // Right side navbar items
    const $navRight = document.createElement('ul');
    $navRight.className = 'navbar-nav ms-auto flex-row align-items-center gap-3';
    $parent.appendChild($navRight);

    // WASM Toggle
    const $wasmItem = document.createElement('li');
    $wasmItem.className = 'nav-item';
    this._renderWasmToggle($wasmItem);
    $navRight.appendChild($wasmItem);

    const actions = [
      { title: 'Load', icon: 'download', handler: _load },
      { title: 'Save', icon: 'save', handler: _backup },
      { title: 'Preview', icon: 'play-circle', handler: _publish }
    ];

    actions.forEach(({ title, icon, handler }) => {
      const $item = document.createElement('li');
      $item.className = 'nav-item';

      const $btn = document.createElement('button');
      $btn.className = 'btn btn-sm btn-outline-info d-flex align-items-center gap-1';
      $btn.title = title;
      $btn.innerHTML = `<i class="bi bi-${icon}"></i><span class="d-none d-md-inline">${title}</span>`;
      $btn.addEventListener('click', handler);

      $item.appendChild($btn);
      $navRight.appendChild($item);
    });
  }
}
