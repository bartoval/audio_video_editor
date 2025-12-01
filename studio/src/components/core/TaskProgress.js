/**
 * TaskProgress - displays active tasks with progress indicators
 *
 * Subscribes to uiStore.tasks and renders a floating progress bar
 * for each active task (e.g., offline prefetch progress).
 */
import { View } from '../../lib';
import { uiStore } from '../../store';
import { Z_INDEX } from '../../config/ui';

export default class TaskProgress extends View {
  #unsubscribeStore = null;
  #currentTasks = {};

  constructor($parent) {
    super($parent);
    this.mount();
  }

  template() {
    return `
      <div class="task-progress-container position-fixed bottom-0 start-0 m-3" style="z-index: ${Z_INDEX.toast}; max-width: 300px;">
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);
  }

  onMount() {
    this.#unsubscribeStore = uiStore.subscribe(state => {
      this.#updateTasks(state.tasks);
    });
  }

  onDestroy() {
    if (this.#unsubscribeStore) {
      this.#unsubscribeStore();
    }

    super.onDestroy();
  }

  #updateTasks(tasks) {
    const taskIds = Object.keys(tasks);
    const currentIds = Object.keys(this.#currentTasks);

    for (const taskId of currentIds) {
      if (!tasks[taskId]) {
        this.#removeTask(taskId);
      }
    }

    for (const taskId of taskIds) {
      const task = tasks[taskId];

      if (this.#currentTasks[taskId]) {
        this.#updateTask(taskId, task);
      } else {
        this.#addTask(taskId, task);
      }
    }
  }

  #addTask(taskId, task) {
    const element = document.createElement('div');
    element.className = 'task-progress-item card bg-dark border-secondary mb-2';
    element.dataset.taskId = taskId;
    element.innerHTML = this.#taskTemplate(task);

    this.$node.appendChild(element);
    this.#currentTasks[taskId] = element;
  }

  #updateTask(taskId, task) {
    const element = this.#currentTasks[taskId];

    if (!element) {
      return;
    }

    const statusEl = element.querySelector('.task-status');
    const progressBar = element.querySelector('.progress-bar');

    if (statusEl) {
      statusEl.textContent = task.status;
    }

    if (progressBar && task.progress !== undefined) {
      progressBar.style.width = `${task.progress}%`;
      progressBar.setAttribute('aria-valuenow', task.progress);
    }
  }

  #removeTask(taskId) {
    const element = this.#currentTasks[taskId];

    if (element) {
      element.classList.add('fade-out');
      setTimeout(() => {
        element.remove();
      }, 300);
      delete this.#currentTasks[taskId];
    }
  }

  #taskTemplate(task) {
    const progressValue = task.progress ?? 0;
    const typeClass =
      task.type === 'error' ? 'bg-danger' : task.type === 'warning' ? 'bg-warning' : 'bg-info';

    return `
      <div class="card-body p-2">
        <div class="task-status small text-light mb-1">${task.status}</div>
        <div class="progress" style="height: 4px;">
          <div class="progress-bar ${typeClass}" role="progressbar"
               style="width: ${progressValue}%;"
               aria-valuenow="${progressValue}"
               aria-valuemin="0"
               aria-valuemax="100">
          </div>
        </div>
      </div>
    `;
  }
}
