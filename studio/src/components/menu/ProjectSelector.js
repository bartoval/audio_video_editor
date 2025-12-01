import Config from 'Config';

const _fetchProjects = async () => {
  try {
    const response = await fetch(Config.getApiUrl() + 'api/projects');

    return await response.json();
  } catch (err) {
    console.error('Error fetching projects:', err);

    return [];
  }
};

const _createProject = async title => {
  const response = await fetch(Config.getApiUrl() + 'api/projects', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  });

  return await response.json();
};

const _deleteProject = async uuid => {
  const response = await fetch(Config.getApiUrl() + `api/projects/${uuid}`, { method: 'DELETE' });

  return await response.json();
};

export default class ProjectSelector {
  constructor($parent) {
    this.$node = null;
    this.$select = null;
    this.$modal = null;
    this.$backdrop = null;
    this.$modalTitle = null;
    this.$modalBody = null;
    this.$modalConfirm = null;
    this.currentUuid = Config.getUuid();
    this.projects = [];
    this.isDeleteMode = false;

    this.render($parent);
    this.loadProjects();
  }

  async loadProjects() {
    this.projects = await _fetchProjects();
    this._updateDropdown();
  }

  _updateDropdown() {
    if (!this.$select) {
      return;
    }

    this.$select.innerHTML = '';
    this.projects.forEach(({ uuid, title }) => {
      const $option = document.createElement('option');
      $option.value = uuid;
      $option.textContent = title;
      $option.selected = uuid === this.currentUuid;
      this.$select.appendChild($option);
    });
  }

  _navigateToProject(uuid) {
    if (uuid && uuid !== this.currentUuid) {
      window.location.href = `/studio/${uuid}`;
    }
  }

  _showModal(isDelete = false) {
    this.isDeleteMode = isDelete;

    if (isDelete) {
      const project = this.projects.find(p => p.uuid === this.currentUuid);

      if (!project) {
        return;
      }

      this.$modalTitle.textContent = 'Delete Project';
      this.$modalBody.innerHTML = `
        <p class="mb-2">Delete "<strong>${project.title}</strong>"?</p>
        <p class="text-danger small mb-0">This action cannot be undone.</p>
      `;
      this.$modalConfirm.textContent = 'Delete';
      this.$modalConfirm.className = 'btn btn-danger';
    } else {
      this.$modalTitle.textContent = 'New Project';
      this.$modalBody.innerHTML = `
        <input type="text" class="form-control" placeholder="Project title" id="project-title-input">
      `;
      this.$modalConfirm.textContent = 'Create';
      this.$modalConfirm.className = 'btn btn-primary';

      setTimeout(() => {
        const $input = this.$modal.querySelector('#project-title-input');
        $input?.focus();
        $input?.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            this._handleConfirm();
          }
        });
      }, 100);
    }

    this.$backdrop.style.display = 'block';
    this.$backdrop.classList.add('show');
    this.$modal.classList.add('show');
    this.$modal.style.display = 'block';
    document.body.classList.add('modal-open');
  }

  _hideModal() {
    this.$backdrop.classList.remove('show');
    this.$backdrop.style.display = 'none';
    this.$modal.classList.remove('show');
    this.$modal.style.display = 'none';
    document.body.classList.remove('modal-open');
  }

  async _handleConfirm() {
    if (this.isDeleteMode) {
      await this._deleteProject();
    } else {
      await this._createProject();
    }
  }

  async _createProject() {
    const $input = this.$modal.querySelector('#project-title-input');
    const title = $input?.value.trim();

    if (!title) {
      $input?.focus();

      return;
    }

    try {
      const result = await _createProject(title);

      if (result.success) {
        this._hideModal();
        window.location.href = `/studio/${result.uuid}`;
      } else {
        alert('Error: ' + result.error);
      }
    } catch (err) {
      alert('Error: ' + err);
    }
  }

  async _deleteProject() {
    if (!this.currentUuid) {
      return;
    }

    try {
      const result = await _deleteProject(this.currentUuid);

      if (result.success) {
        this._hideModal();
        const remaining = this.projects.filter(p => p.uuid !== this.currentUuid);
        window.location.href = remaining.length > 0 ? `/studio/${remaining[0].uuid}` : '/studio/project/edit';
      } else {
        alert('Error: ' + result.error);
      }
    } catch (err) {
      alert('Error: ' + err);
    }
  }

  _createModal() {
    this.$modal = document.createElement('div');
    this.$modal.className = 'modal fade';
    this.$modal.tabIndex = -1;
    this.$modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"></h5>
            <button type="button" class="btn-close" data-dismiss="modal"></button>
          </div>
          <div class="modal-body"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary modal-confirm"></button>
          </div>
        </div>
      </div>
    `;

    this.$modalTitle = this.$modal.querySelector('.modal-title');
    this.$modalBody = this.$modal.querySelector('.modal-body');
    this.$modalConfirm = this.$modal.querySelector('.modal-confirm');

    this.$modal.querySelectorAll('[data-dismiss="modal"]').forEach($el => {
      $el.addEventListener('click', () => this._hideModal());
    });

    this.$modal.addEventListener('click', e => {
      if (e.target === this.$modal) {
        this._hideModal();
      }
    });

    this.$modalConfirm.addEventListener('click', () => this._handleConfirm());

    this.$backdrop = document.createElement('div');
    this.$backdrop.className = 'modal-backdrop fade';
    this.$backdrop.style.display = 'none';
    this.$backdrop.addEventListener('click', () => this._hideModal());

    document.body.appendChild(this.$backdrop);
    document.body.appendChild(this.$modal);
  }

  render($parent) {
    this._createModal();

    this.$node = document.createElement('div');
    this.$node.className = 'd-flex align-items-center gap-2';

    this.$select = document.createElement('select');
    this.$select.className = 'form-select form-select-sm';
    this.$select.style.width = '200px';
    this.$select.addEventListener('change', e => this._navigateToProject(e.target.value));

    const $newBtn = document.createElement('button');
    $newBtn.className = 'btn btn-sm btn-outline-info';
    $newBtn.title = 'New project';
    $newBtn.innerHTML = '<i class="bi bi-plus"></i>';
    $newBtn.addEventListener('click', () => this._showModal(false));

    const $deleteBtn = document.createElement('button');
    $deleteBtn.className = 'btn btn-sm btn-outline-danger';
    $deleteBtn.title = 'Delete project';
    $deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
    $deleteBtn.addEventListener('click', () => this._showModal(true));

    this.$node.appendChild(this.$select);
    this.$node.appendChild($newBtn);
    this.$node.appendChild($deleteBtn);

    $parent.insertBefore(this.$node, $parent.firstChild);
  }
}
