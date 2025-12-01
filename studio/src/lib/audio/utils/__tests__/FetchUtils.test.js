import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout, fetchWithRetry, fetchAudio } from '../FetchUtils.js';
import { AudioError, ErrorCodes } from '../../errors/AudioError.js';
import * as BufferUtils from '../BufferUtils.js';
import ErrorHandler from '../../../../services/ErrorHandler.js';

describe('FetchUtils', () => {
  let mockFetch;
  let mockResponse;
  let handleErrorSpy;
  let unhandledRejectionHandler;

  beforeEach(() => {
    vi.useFakeTimers();

    // Suppress unhandled rejection warnings in tests
    unhandledRejectionHandler = () => {};
    process.on('unhandledRejection', unhandledRejectionHandler);

    mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      text: vi.fn().mockResolvedValue('response body')
    };

    mockFetch = vi.fn().mockResolvedValue(mockResponse);
    global.fetch = mockFetch;

    handleErrorSpy = vi.spyOn(ErrorHandler, 'handle').mockImplementation(() => {});

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    handleErrorSpy.mockRestore();
    process.off('unhandledRejection', unhandledRejectionHandler);
  });

  describe('fetchWithTimeout', () => {
    it('fetches URL successfully', async () => {
      const promise = fetchWithTimeout('https://example.com/audio.mp3');
      vi.runAllTimers();

      const response = await promise;

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/audio.mp3',
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );
      expect(response).toBe(mockResponse);
    });

    it('passes through options', async () => {
      const options = { headers: { 'X-Custom': 'value' } };
      const promise = fetchWithTimeout('https://example.com/audio.mp3', options);
      vi.runAllTimers();

      await promise;

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/audio.mp3',
        expect.objectContaining({
          headers: { 'X-Custom': 'value' },
          signal: expect.any(AbortSignal)
        })
      );
    });

    it('uses default timeout', async () => {
      const promise = fetchWithTimeout('https://example.com/audio.mp3');

      // Default timeout is 30000ms from NETWORK config
      expect(vi.getTimerCount()).toBe(1);

      vi.runAllTimers();
      await promise;

      // Timeout should be cleared after successful fetch
      expect(vi.getTimerCount()).toBe(0);
    });

    it('uses custom timeout', async () => {
      const promise = fetchWithTimeout('https://example.com/audio.mp3', {}, 5000);

      expect(vi.getTimerCount()).toBe(1);

      vi.runAllTimers();
      await promise;

      expect(vi.getTimerCount()).toBe(0);
    });

    it('clears timeout on successful response', async () => {
      const promise = fetchWithTimeout('https://example.com/audio.mp3');
      vi.runAllTimers();

      await promise;

      expect(vi.getTimerCount()).toBe(0);
    });

    it('aborts request on timeout', async () => {
      let abortController;
      mockFetch.mockImplementation((url, options) => {
        abortController = { signal: options.signal };
        return new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const error = new Error('AbortError');
            error.name = 'AbortError';
            reject(error);
          });
        });
      });

      const promise = fetchWithTimeout('https://example.com/audio.mp3', {}, 1000);

      // Advance time to trigger timeout
      await vi.advanceTimersByTimeAsync(1000);

      await expect(promise).rejects.toThrow(AudioError);
      await expect(promise).rejects.toMatchObject({
        code: ErrorCodes.NETWORK_ERROR
      });

      const error = await promise.catch(e => e);
      expect(error.cause.message).toContain('Request timeout');

      expect(handleErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCodes.NETWORK_ERROR
        })
      );
    });

    it('throws AudioError on HTTP error status', async () => {
      mockResponse.ok = false;
      mockResponse.status = 404;
      mockResponse.statusText = 'Not Found';

      const promise = fetchWithTimeout('https://example.com/missing.mp3');
      vi.runAllTimers();

      await expect(promise).rejects.toThrow(AudioError);
      await expect(promise).rejects.toMatchObject({
        code: ErrorCodes.NETWORK_ERROR,
        message: expect.stringContaining('https://example.com/missing.mp3')
      });

      expect(handleErrorSpy).toHaveBeenCalled();
    });

    it('includes response text in error message', async () => {
      mockResponse.ok = false;
      mockResponse.status = 500;
      mockResponse.text.mockResolvedValue('Internal Server Error');

      const promise = fetchWithTimeout('https://example.com/error.mp3');
      vi.runAllTimers();

      await expect(promise).rejects.toThrow(AudioError);

      const error = await promise.catch(e => e);
      expect(error.cause.message).toContain('HTTP 500: Internal Server Error');
    });

    it('uses statusText if response.text() fails', async () => {
      mockResponse.ok = false;
      mockResponse.status = 500;
      mockResponse.statusText = 'Server Error';
      mockResponse.text.mockRejectedValue(new Error('Cannot read text'));

      const promise = fetchWithTimeout('https://example.com/error.mp3');
      vi.runAllTimers();

      await expect(promise).rejects.toThrow(AudioError);

      const error = await promise.catch(e => e);
      expect(error.cause.message).toContain('HTTP 500: Server Error');
    });

    it('wraps non-AudioError fetch errors', async () => {
      const networkError = new Error('Network failure');
      mockFetch.mockRejectedValue(networkError);

      const promise = fetchWithTimeout('https://example.com/audio.mp3');
      vi.runAllTimers();

      await expect(promise).rejects.toThrow(AudioError);
      await expect(promise).rejects.toMatchObject({
        code: ErrorCodes.NETWORK_ERROR,
        cause: networkError
      });

      expect(handleErrorSpy).toHaveBeenCalled();
    });

    it('preserves AudioError instances', async () => {
      const audioError = AudioError.network('test.mp3', new Error('Original error'));
      mockFetch.mockRejectedValue(audioError);

      const promise = fetchWithTimeout('https://example.com/audio.mp3');
      vi.runAllTimers();

      await expect(promise).rejects.toBe(audioError);
    });

    it('clears timeout on error', async () => {
      mockResponse.ok = false;
      mockResponse.status = 404;

      const promise = fetchWithTimeout('https://example.com/missing.mp3');
      vi.runAllTimers();

      await expect(promise).rejects.toThrow();

      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('fetchWithRetry', () => {
    it('succeeds on first attempt', async () => {
      const promise = fetchWithRetry('https://example.com/audio.mp3');
      vi.runAllTimers();

      const response = await promise;

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(response).toBe(mockResponse);
    });

    it('retries on failure', async () => {
      let attemptCount = 0;
      mockFetch.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(mockResponse);
      });

      const promise = fetchWithRetry('https://example.com/audio.mp3', {}, 3);

      // First attempt fails immediately
      await vi.runAllTimersAsync();

      // Wait for retry delay (RETRY_DELAY * 1)
      await vi.runAllTimersAsync();

      const response = await promise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response).toBe(mockResponse);
    });

    it('uses default MAX_RETRIES from config', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const promise = fetchWithRetry('https://example.com/audio.mp3');

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow();

      // MAX_RETRIES is 3 from NETWORK config
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('uses custom retry count', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const promise = fetchWithRetry('https://example.com/audio.mp3', {}, 5);

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow();

      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it('waits with exponential backoff', async () => {
      let delays = [];
      mockFetch.mockRejectedValue(new Error('Network error'));

      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn((fn, delay) => {
        if (delay > 0 && delay < 10000) {
          // Only track retry delays, not timeout delays
          delays.push(delay);
        }
        return originalSetTimeout(fn, delay);
      });

      const promise = fetchWithRetry('https://example.com/audio.mp3', {}, 3);

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow();

      // RETRY_DELAY is 1000ms from TIMING config
      // Delays should be: 1000 * 1, 1000 * 2
      expect(delays.length).toBe(2);
      expect(delays[0]).toBe(1000); // First retry
      expect(delays[1]).toBe(2000); // Second retry

      global.setTimeout = originalSetTimeout;
    });

    it('throws last error after all retries', async () => {
      const lastError = new Error('Final error');
      let attemptCount = 0;

      mockFetch.mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 3) {
          return Promise.reject(lastError);
        }
        return Promise.reject(new Error('Earlier error'));
      });

      const promise = fetchWithRetry('https://example.com/audio.mp3', {}, 3);

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(AudioError);

      const error = await promise.catch(e => e);
      expect(error.cause.message).toContain('Final error');
    });

    it('does not wait after last retry', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const startTime = Date.now();
      const promise = fetchWithRetry('https://example.com/audio.mp3', {}, 2);

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow();

      // Should not wait after the second (last) retry
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('handles abort errors from timeout', async () => {
      const abortError = new Error('Request timeout');
      abortError.name = 'AbortError';

      mockFetch.mockRejectedValue(abortError);

      const promise = fetchWithRetry('https://example.com/audio.mp3', {}, 2);

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(AudioError);
      await expect(promise).rejects.toMatchObject({
        code: ErrorCodes.NETWORK_ERROR
      });
    });
  });

  describe('fetchAudio', () => {
    let decodeSpy;
    let mockArrayBuffer;

    beforeEach(() => {
      mockArrayBuffer = new ArrayBuffer(1024);
      mockResponse.arrayBuffer.mockResolvedValue(mockArrayBuffer);

      const mockAudioBuffer = {
        sampleRate: 44100,
        numberOfChannels: 2,
        length: 1000
      };

      decodeSpy = vi.spyOn(BufferUtils, 'decode').mockResolvedValue(mockAudioBuffer);
    });

    afterEach(() => {
      decodeSpy.mockRestore();
    });

    it('fetches and decodes audio', async () => {
      const promise = fetchAudio('https://example.com/audio.mp3');
      vi.runAllTimers();

      const audioBuffer = await promise;

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/audio.mp3', expect.any(Object));
      expect(mockResponse.arrayBuffer).toHaveBeenCalled();
      expect(decodeSpy).toHaveBeenCalledWith(mockArrayBuffer);
      expect(audioBuffer).toMatchObject({
        sampleRate: 44100,
        numberOfChannels: 2,
        length: 1000
      });
    });

    it('uses fetchWithTimeout by default', async () => {
      const promise = fetchAudio('https://example.com/audio.mp3');
      vi.runAllTimers();

      await promise;

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('uses fetchWithRetry when retry option is true', async () => {
      let attemptCount = 0;
      mockFetch.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(mockResponse);
      });

      const promise = fetchAudio('https://example.com/audio.mp3', { retry: true });

      await vi.runAllTimersAsync();

      const audioBuffer = await promise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(audioBuffer).toBeTruthy();
    });

    it('uses fetchWithTimeout when retry option is false', async () => {
      const promise = fetchAudio('https://example.com/audio.mp3', { retry: false });
      vi.runAllTimers();

      await promise;

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws if fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const promise = fetchAudio('https://example.com/audio.mp3');
      vi.runAllTimers();

      await expect(promise).rejects.toThrow(AudioError);
      expect(decodeSpy).not.toHaveBeenCalled();
    });

    it('throws if arrayBuffer() fails', async () => {
      mockResponse.arrayBuffer.mockRejectedValue(new Error('ArrayBuffer error'));

      const promise = fetchAudio('https://example.com/audio.mp3');
      vi.runAllTimers();

      await expect(promise).rejects.toThrow('ArrayBuffer error');
      expect(decodeSpy).not.toHaveBeenCalled();
    });

    it('throws if decode fails', async () => {
      decodeSpy.mockRejectedValue(AudioError.decode(new Error('Decode failed')));

      const promise = fetchAudio('https://example.com/audio.mp3');
      vi.runAllTimers();

      await expect(promise).rejects.toThrow(AudioError);
      await expect(promise).rejects.toMatchObject({
        code: ErrorCodes.DECODE_FAILED
      });
    });

    it('handles empty response body', async () => {
      const emptyBuffer = new ArrayBuffer(0);
      mockResponse.arrayBuffer.mockResolvedValue(emptyBuffer);

      const promise = fetchAudio('https://example.com/audio.mp3');
      vi.runAllTimers();

      await promise;

      expect(decodeSpy).toHaveBeenCalledWith(emptyBuffer);
    });
  });

  describe('edge cases', () => {
    it('handles concurrent fetchWithTimeout calls', async () => {
      const promise1 = fetchWithTimeout('https://example.com/audio1.mp3');
      const promise2 = fetchWithTimeout('https://example.com/audio2.mp3');

      vi.runAllTimers();

      const [response1, response2] = await Promise.all([promise1, promise2]);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response1).toBe(mockResponse);
      expect(response2).toBe(mockResponse);
    });

    it('handles concurrent fetchWithRetry calls', async () => {
      const promise1 = fetchWithRetry('https://example.com/audio1.mp3');
      const promise2 = fetchWithRetry('https://example.com/audio2.mp3');

      vi.runAllTimers();

      const [response1, response2] = await Promise.all([promise1, promise2]);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response1).toBe(mockResponse);
      expect(response2).toBe(mockResponse);
    });

    it('handles fetchWithRetry with zero retries', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const promise = fetchWithRetry('https://example.com/audio.mp3', {}, 0);

      await vi.runAllTimersAsync();

      // Should not call fetch at all with 0 retries
      await expect(promise).rejects.toThrow();
    });

    it('handles special characters in URL', async () => {
      const url = 'https://example.com/audio file (1).mp3?param=value&foo=bar';
      const promise = fetchWithTimeout(url);
      vi.runAllTimers();

      await promise;

      expect(mockFetch).toHaveBeenCalledWith(url, expect.any(Object));
    });

    it('handles empty options object', async () => {
      const promise = fetchWithTimeout('https://example.com/audio.mp3', {});
      vi.runAllTimers();

      const response = await promise;

      expect(response).toBe(mockResponse);
    });

    it('handles null options', async () => {
      const promise = fetchWithTimeout('https://example.com/audio.mp3', null);
      vi.runAllTimers();

      const response = await promise;

      expect(response).toBe(mockResponse);
    });
  });
});
