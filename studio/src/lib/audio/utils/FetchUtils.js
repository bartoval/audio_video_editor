import { AudioError } from '../errors/AudioError';
import { decode } from './BufferUtils';
import { TIMING } from '../../../config/constants';
import { NETWORK } from '../../../config/ui';
import ErrorHandler from '../../../services/ErrorHandler';

const { DEFAULT_TIMEOUT, MAX_RETRIES } = NETWORK;
const { RETRY_DELAY } = TIMING;

/** @type {(error: Error) => void} */
const defaultOnError = error => ErrorHandler.handle(error);

/** Fetch with timeout. Pass onError to override default ErrorHandler toast. */
export const fetchWithTimeout = async (
  url,
  options = {},
  timeout = DEFAULT_TIMEOUT,
  { onError = defaultOnError } = {}
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await window.fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      const error = AudioError.network(url, new Error(`HTTP ${response.status}: ${errorText}`));
      onError(error);

      throw error;
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      const timeoutError = AudioError.network(url, new Error('Request timeout'));
      onError(timeoutError);

      throw timeoutError;
    }

    if (error instanceof AudioError) {
      throw error;
    }

    const networkError = AudioError.network(url, error);
    onError(networkError);

    throw networkError;
  }
};

/** Fetch with retry logic */
export const fetchWithRetry = async (url, options = {}, retries = MAX_RETRIES) => {
  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fetchWithTimeout(url, options);
    } catch (error) {
      lastError = error;

      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, RETRY_DELAY * (attempt + 1)));
      }
    }
  }

  throw lastError;
};

/** Fetch audio and decode to AudioBuffer */
export const fetchAudio = async (url, { retry = false } = {}) => {
  const fetcher = retry ? fetchWithRetry : fetchWithTimeout;
  const response = await fetcher(url);
  const arrayBuffer = await response.arrayBuffer();

  return decode(arrayBuffer);
};

export default { fetchWithTimeout, fetchWithRetry, fetchAudio };
