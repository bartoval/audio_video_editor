/** Audio-specific error codes */
export const ErrorCodes = {
  DECODE_FAILED: 'DECODE_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  WORKER_TIMEOUT: 'WORKER_TIMEOUT',
  WASM_UNAVAILABLE: 'WASM_UNAVAILABLE',
  INVALID_BUFFER: 'INVALID_BUFFER'
};

/** Unified audio error class */
export class AudioError extends Error {
  constructor(message, code, cause = null) {
    super(message);
    this.name = 'AudioError';
    this.code = code;
    this.cause = cause;
  }

  /** Create decode error */
  static decode(cause) {
    return new AudioError(
      `Decoding failed: ${cause?.message || cause}`,
      ErrorCodes.DECODE_FAILED,
      cause
    );
  }

  /** Create network error */
  static network(url, cause) {
    return new AudioError(`Network error fetching ${url}`, ErrorCodes.NETWORK_ERROR, cause);
  }

  /** Create worker timeout error */
  static workerTimeout(path) {
    return new AudioError(`Worker timeout: ${path}`, ErrorCodes.WORKER_TIMEOUT);
  }

  /** Create WASM unavailable error */
  static wasmUnavailable() {
    return new AudioError('WASM processing unavailable', ErrorCodes.WASM_UNAVAILABLE);
  }
}

export default AudioError;
