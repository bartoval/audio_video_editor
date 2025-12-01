/** WASM audio processing configuration */

const WASM_STORAGE_KEY = 'audio-sync-wasm-enabled';
const WORKER_STORAGE_KEY = 'audio-sync-worker-enabled';
const PARALLEL_STRETCH_STORAGE_KEY = 'audio-sync-parallel-stretch-enabled';

// Load saved WASM preference (default: true)
const savedWasm = localStorage.getItem(WASM_STORAGE_KEY);
let wasmEnabled = savedWasm === null ? true : savedWasm === 'true';
let wasmLoaded = false;

/** Check if SharedArrayBuffer is available */
export const isWasmSupported = () =>
  typeof SharedArrayBuffer !== 'undefined' && window.crossOriginIsolated;

/** Check if WASM is enabled and supported */
export const isWasmEnabled = () => wasmEnabled && isWasmSupported();

/** Enable/disable WASM processing */
export const setWasmEnabled = value => {
  wasmEnabled = value;
  localStorage.setItem(WASM_STORAGE_KEY, String(value));
};

/** Set WASM loaded state (called by AudioWorker) */
export const setWasmLoaded = value => {
  wasmLoaded = value;
};

/** Check if WASM module is loaded */
export const isWasmLoaded = () => wasmLoaded;

// ============================================================================
// Worker configuration
// ============================================================================

// Load saved Worker preference (default: true)
const savedWorker = localStorage.getItem(WORKER_STORAGE_KEY);
let workerEnabled = savedWorker === null ? true : savedWorker === 'true';

/** Check if Web Workers are supported */
export const isWorkerSupported = () => typeof Worker !== 'undefined';

/** Check if Worker is enabled and supported */
export const isWorkerEnabled = () => workerEnabled && isWorkerSupported();

/** Enable/disable Worker processing */
export const setWorkerEnabled = value => {
  workerEnabled = value;
  localStorage.setItem(WORKER_STORAGE_KEY, String(value));
};

// ============================================================================
// Parallel Stretch configuration
// ============================================================================

// Load saved Parallel Stretch preference (default: false - single worker is default)
const savedParallelStretch = localStorage.getItem(PARALLEL_STRETCH_STORAGE_KEY);
let parallelStretchEnabled =
  savedParallelStretch === null ? false : savedParallelStretch === 'true';

/** Check if Parallel Stretch is enabled and supported */
export const isParallelStretchEnabled = () => parallelStretchEnabled && isWorkerSupported();

/** Enable/disable Parallel Stretch processing */
export const setParallelStretchEnabled = value => {
  parallelStretchEnabled = value;
  localStorage.setItem(PARALLEL_STRETCH_STORAGE_KEY, String(value));
};

/** Get number of workers for parallel processing */
export const getParallelWorkerCount = () => Math.min(navigator.hardwareConcurrency || 4, 6);

export default {
  isWasmSupported,
  isWasmEnabled,
  setWasmEnabled,
  setWasmLoaded,
  isWasmLoaded,
  isWorkerSupported,
  isWorkerEnabled,
  setWorkerEnabled,
  isParallelStretchEnabled,
  setParallelStretchEnabled,
  getParallelWorkerCount
};
