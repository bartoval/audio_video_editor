/** WASM audio processing is enabled automatically when supported. */

let wasmLoaded = false;

/** Check if SharedArrayBuffer is available */
export const isWasmSupported = () =>
  typeof SharedArrayBuffer !== 'undefined' && window.crossOriginIsolated;

/** Use WASM whenever supported, regardless of former toggle preferences. */
export const isWasmEnabled = () => isWasmSupported();

/** Set WASM loaded state (called by AudioWorker) */
export const setWasmLoaded = value => {
  wasmLoaded = value;
};

/** Check if WASM module is loaded */
export const isWasmLoaded = () => wasmLoaded;

/** Check if Web Workers are supported */
export const isWorkerSupported = () => typeof Worker !== 'undefined';

/** Prefer background processing when WASM and Workers are supported. */
export const isWorkerEnabled = () => isWasmEnabled() && isWorkerSupported();

/** Prefer parallel stretching; AudioWorker handles the single-worker fallback. */
export const isParallelStretchEnabled = () => isWorkerEnabled();

/** Get number of workers for parallel processing */
export const getParallelWorkerCount = () => Math.min(navigator.hardwareConcurrency || 4, 6);

export default {
  isWasmSupported,
  isWasmEnabled,
  setWasmLoaded,
  isWasmLoaded,
  isWorkerSupported,
  isWorkerEnabled,
  isParallelStretchEnabled,
  getParallelWorkerCount
};
