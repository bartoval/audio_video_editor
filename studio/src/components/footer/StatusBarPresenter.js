/** StatusBar presenter - orchestrates view and manages state from services/stores */
import { isOnline } from '../../lib';
import { EVENT } from '../../config/constants';
import {
  isWasmEnabled,
  isWasmSupported,
  setWasmEnabled,
  isWorkerEnabled,
  isWorkerSupported,
  setWorkerEnabled,
  isParallelStretchEnabled,
  setParallelStretchEnabled
} from '../../lib/audio/wasm';
import { ServiceWorker } from '../../services/offline';
import * as EventService from '../../services/EventService';
import * as JobTrackerService from '../../services/JobTrackerService';
import { uiStore } from '../../store';
import { createStatusBarView } from './view';

export default class StatusBarPresenter {
  #view = null;
  #unsubscribeConnection = null;
  #unsubscribeUIStore = null;
  #unsubscribeJobCount = null;

  constructor($parent) {
    this.#initView($parent);
    this.#initState();
    this.#subscribeEvents();
  }

  #initView($parent) {
    this.#view = createStatusBarView($parent);
    this.#view.bind({
      onWasmToggle: enabled => this.#handleWasmToggle(enabled),
      onWorkerToggle: enabled => this.#handleWorkerToggle(enabled),
      onParallelStretchToggle: enabled => this.#handleParallelStretchToggle(enabled),
      onOfflineToggle: enabled => this.#handleOfflineToggle(enabled),
      onPendingOpsClick: () => this.#toggleJobPanel(),
      onJobDismiss: jobId => this.#handleJobDismiss(jobId)
    });
  }

  #initState() {
    const wasmSupported = isWasmSupported();
    const workerSupported = isWorkerSupported();
    const wasmEnabled = isWasmEnabled();

    this.#view.setState({
      online: isOnline(),
      wasmEnabled,
      wasmSupported,
      workerEnabled: isWorkerEnabled(),
      workerDisabled: !wasmSupported || !workerSupported || !wasmEnabled,
      parallelStretchEnabled: isParallelStretchEnabled(),
      parallelStretchDisabled: !wasmSupported || !workerSupported || !wasmEnabled,
      offlineEnabled: ServiceWorker.isEnabled(),
      offlineSupported: ServiceWorker.isSupported(),
      tasks: uiStore.getState().tasks,
      pendingOpsCount: JobTrackerService.getJobCount(),
      jobs: JobTrackerService.getJobs()
    });
  }

  #subscribeEvents() {
    this.#unsubscribeConnection = EventService.on(EVENT.CONNECTION, ({ online }) => {
      this.#view.setState({ online });
    });

    this.#unsubscribeUIStore = uiStore.subscribe(state => {
      this.#view.setState({ tasks: state.tasks });
    });

    this.#unsubscribeJobCount = EventService.on(EVENT.JOB_COUNT_CHANGED, ({ count, jobs }) => {
      this.#view.setState({ pendingOpsCount: count, jobs });

      if (count === 0) {
        this.#view.hideJobPanel();
      }
    });
  }

  #toggleJobPanel() {
    if (this.#view.isJobPanelVisible()) {
      this.#view.hideJobPanel();
    } else if (JobTrackerService.getJobCount() > 0) {
      this.#view.showJobPanel();
    }
  }

  #handleJobDismiss(jobId) {
    JobTrackerService.untrack(jobId);
  }

  #handleWasmToggle(enabled) {
    setWasmEnabled(enabled);

    const workerSupported = isWorkerSupported();
    const dependentDisabled = !enabled || !workerSupported;

    if (!enabled) {
      setWorkerEnabled(false);
      setParallelStretchEnabled(false);
    }

    this.#view.setState({
      wasmEnabled: enabled,
      workerEnabled: enabled ? isWorkerEnabled() : false,
      workerDisabled: dependentDisabled,
      parallelStretchEnabled: enabled ? isParallelStretchEnabled() : false,
      parallelStretchDisabled: dependentDisabled
    });
  }

  #handleWorkerToggle(enabled) {
    setWorkerEnabled(enabled);
    this.#view.setState({ workerEnabled: enabled });
  }

  #handleParallelStretchToggle(enabled) {
    setParallelStretchEnabled(enabled);
    this.#view.setState({ parallelStretchEnabled: enabled });
  }

  async #handleOfflineToggle(enabled) {
    try {
      await ServiceWorker.setEnabled(enabled);
      this.#view.setState({ offlineEnabled: enabled });
    } catch (error) {
      console.error('[StatusBarPresenter] Failed to toggle offline mode:', error);
      this.#view.setState({ offlineEnabled: ServiceWorker.isEnabled() });
    }
  }

  isOnline() {
    return isOnline();
  }

  destroy() {
    this.#unsubscribeConnection?.();
    this.#unsubscribeUIStore?.();
    this.#unsubscribeJobCount?.();
    this.#view?.destroy();
  }
}
