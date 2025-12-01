import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ErrorHandler from '../ErrorHandler.js';
import { uiStore } from '../../store/index.js';
import { NOTIFY_TYPE } from '../../config/constants.js';

vi.mock('../../store/index.js', () => ({
  uiStore: {
    actions: {
      pushToast: vi.fn()
    }
  }
}));

describe('ErrorHandler', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('handle method', () => {
    it('logs error to console', () => {
      const error = new Error('Test error');
      ErrorHandler.handle(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ErrorHandler]', 'API Error', error);
    });

    it('logs error with context', () => {
      const error = new Error('Test error');
      const context = 'Upload failed';

      ErrorHandler.handle(error, context);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ErrorHandler]', context, error);
    });

    it('pushes toast notification', () => {
      const error = new Error('Test error');
      ErrorHandler.handle(error);

      expect(uiStore.actions.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NOTIFY_TYPE.ERROR,
          msg: expect.any(String),
          timeHide: 15000
        })
      );
    });

    it('includes context in toast message', () => {
      const error = new Error('Network failed');
      ErrorHandler.handle(error, 'Download');

      expect(uiStore.actions.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: expect.stringContaining('Download')
        })
      );
    });

    it('handles null/undefined error gracefully', () => {
      ErrorHandler.handle(null);

      expect(uiStore.actions.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'An error occurred.'
        })
      );
    });

    it('handles AbortError as timeout', () => {
      const error = new Error('Request aborted');
      error.name = 'AbortError';

      ErrorHandler.handle(error);

      expect(uiStore.actions.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: expect.stringContaining('timed out')
        })
      );
    });

    it('handles TypeError as network error', () => {
      const error = new TypeError('NetworkError');
      ErrorHandler.handle(error);

      expect(uiStore.actions.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: expect.stringContaining('Network error')
        })
      );
    });

    it('extracts HTTP status from message', () => {
      const error = new Error('HTTP 404: Not found');
      ErrorHandler.handle(error);

      expect(uiStore.actions.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: expect.stringContaining('not found')
        })
      );
    });

    it('handles 400 validation error', () => {
      const error = new Error('HTTP 400: Bad request');
      ErrorHandler.handle(error);

      expect(uiStore.actions.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: expect.stringContaining('Invalid request')
        })
      );
    });

    it('handles 401 unauthorized error', () => {
      const error = new Error('HTTP 401: Unauthorized');
      ErrorHandler.handle(error);

      expect(uiStore.actions.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: expect.stringContaining('Unauthorized')
        })
      );
    });

    it('handles 403 forbidden error', () => {
      const error = new Error('HTTP 403: Forbidden');
      ErrorHandler.handle(error);

      expect(uiStore.actions.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: expect.stringContaining('Unauthorized')
        })
      );
    });

    it('handles 500 server error', () => {
      const error = new Error('HTTP 500: Internal error');
      ErrorHandler.handle(error);

      expect(uiStore.actions.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: expect.stringContaining('Server error')
        })
      );
    });

    it('includes technical details in toast', () => {
      const error = new Error('Something broke');
      error.code = 'ERR_123';

      ErrorHandler.handle(error);

      expect(uiStore.actions.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.stringContaining('ERR_123')
        })
      );
    });

    it('includes error cause in details', () => {
      const causeError = new Error('Root cause');
      const error = new Error('Wrapper error');
      error.cause = causeError;

      ErrorHandler.handle(error);

      expect(uiStore.actions.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.stringContaining('Root cause')
        })
      );
    });

    it('includes stack trace in details', () => {
      const error = new Error('Test error');
      ErrorHandler.handle(error);

      const call = uiStore.actions.pushToast.mock.calls[0][0];
      expect(call.details).toBeTruthy();
    });

    it('handles error without message', () => {
      const error = { code: 'UNKNOWN' };
      ErrorHandler.handle(error);

      expect(uiStore.actions.pushToast).toHaveBeenCalled();
    });
  });

  describe('show method', () => {
    it('displays custom message', () => {
      const message = 'Upload successful';
      ErrorHandler.show(message, NOTIFY_TYPE.SUCCESS);

      expect(uiStore.actions.pushToast).toHaveBeenCalledWith({
        type: NOTIFY_TYPE.SUCCESS,
        msg: message,
        timeHide: 4000
      });
    });

    it('defaults to ERROR type', () => {
      ErrorHandler.show('Something went wrong');

      expect(uiStore.actions.pushToast).toHaveBeenCalledWith({
        type: NOTIFY_TYPE.ERROR,
        msg: 'Something went wrong',
        timeHide: 4000
      });
    });

    it('supports INFO type', () => {
      ErrorHandler.show('Processing...', NOTIFY_TYPE.INFO);

      expect(uiStore.actions.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NOTIFY_TYPE.INFO
        })
      );
    });

    it('supports WARNING type', () => {
      ErrorHandler.show('Low disk space', NOTIFY_TYPE.WARNING);

      expect(uiStore.actions.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NOTIFY_TYPE.WARNING
        })
      );
    });

    it('has shorter timeout than handle', () => {
      ErrorHandler.show('Message');
      const showCall = uiStore.actions.pushToast.mock.calls[0][0];

      uiStore.actions.pushToast.mockClear();

      ErrorHandler.handle(new Error('Error'));
      const handleCall = uiStore.actions.pushToast.mock.calls[0][0];

      expect(showCall.timeHide).toBe(4000);
      expect(handleCall.timeHide).toBe(15000);
    });
  });

  describe('edge cases', () => {
    it('handles error with timeout in message', () => {
      const error = new Error('Request timeout occurred');
      ErrorHandler.handle(error);

      expect(uiStore.actions.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: expect.stringContaining('timed out')
        })
      );
    });

    it('handles error with NetworkError in message', () => {
      const error = new Error('NetworkError: Failed to fetch');
      ErrorHandler.handle(error);

      expect(uiStore.actions.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: expect.stringContaining('Network error')
        })
      );
    });

    it('does not duplicate cause message', () => {
      const error = new Error('Same message');
      error.cause = new Error('Same message');

      ErrorHandler.handle(error);

      const call = uiStore.actions.pushToast.mock.calls[0][0];
      const causeCount = (call.details.match(/Same message/g) || []).length;
      expect(causeCount).toBeLessThanOrEqual(1);
    });

    it('handles empty context string', () => {
      const error = new Error('Test');
      ErrorHandler.handle(error, '');

      expect(uiStore.actions.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: expect.not.stringContaining(':')
        })
      );
    });

    it('handles multiple calls in sequence', () => {
      ErrorHandler.handle(new Error('Error 1'));
      ErrorHandler.handle(new Error('Error 2'));
      ErrorHandler.show('Message 3');

      expect(uiStore.actions.pushToast).toHaveBeenCalledTimes(3);
    });
  });
});
