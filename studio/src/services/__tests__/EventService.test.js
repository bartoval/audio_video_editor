import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock workspace
vi.mock('../workspace.js', () => ({
  getUuid: vi.fn(() => 'test-workspace-uuid')
}));

// Mock routes
vi.mock('../../config/routes.js', () => ({
  buildUrl: vi.fn((endpoint, uuid) => `http://localhost/api/${endpoint}/${uuid}`)
}));

describe('EventService', () => {
  let EventService;
  let mockEventSource;
  let eventSourceInstances = [];

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
    eventSourceInstances = [];

    // Mock EventSource
    global.EventSource = vi.fn(function (url) {
      mockEventSource = {
        url,
        onopen: null,
        onerror: null,
        addEventListener: vi.fn(),
        close: vi.fn(),
        readyState: 0
      };
      eventSourceInstances.push(mockEventSource);
      return mockEventSource;
    });

    // Reset modules to get fresh state
    vi.resetModules();
    EventService = await import('../EventService.js');
  });

  afterEach(() => {
    if (EventService) {
      EventService.disconnect();
    }
    vi.useRealTimers();
  });

  describe('connect', () => {
    it('creates EventSource with correct URL', () => {
      EventService.connect();

      expect(global.EventSource).toHaveBeenCalledWith(
        expect.stringContaining('test-workspace-uuid')
      );
    });

    it('registers message event listener', () => {
      EventService.connect();

      expect(mockEventSource.addEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    it('sets error handler', () => {
      EventService.connect();

      expect(mockEventSource.onerror).toBeTruthy();
    });

    it('closes existing connection before creating new one', () => {
      EventService.connect();
      const firstInstance = mockEventSource;

      EventService.connect();

      expect(firstInstance.close).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('closes EventSource', () => {
      EventService.connect();
      EventService.disconnect();

      expect(mockEventSource.close).toHaveBeenCalled();
    });

    it('clears reconnect timeout', () => {
      EventService.connect();
      mockEventSource.onerror();

      EventService.disconnect();
      vi.advanceTimersByTime(5000);

      expect(global.EventSource).toHaveBeenCalledTimes(1);
    });

    it('handles disconnect when not connected', () => {
      expect(() => EventService.disconnect()).not.toThrow();
    });
  });

  // Helper to get message handler and simulate unified schema message
  const getMessageHandler = () => {
    return mockEventSource.addEventListener.mock.calls.find(call => call[0] === 'message')[1];
  };

  const sendMessage = (type, payload) => {
    const handler = getMessageHandler();
    handler({ data: JSON.stringify({ type, payload, timestamp: Date.now() }) });
  };

  describe('event listeners', () => {
    it('on() registers listener', () => {
      const callback = vi.fn();
      EventService.on('connected', callback);

      EventService.connect();
      sendMessage('connected', { status: 'ok' });

      expect(callback).toHaveBeenCalledWith({ status: 'ok' });
    });

    it('on() returns unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = EventService.on('connected', callback);

      unsubscribe();

      EventService.connect();
      sendMessage('connected', { status: 'ok' });

      expect(callback).not.toHaveBeenCalled();
    });

    it('off() removes listener', () => {
      const callback = vi.fn();
      EventService.on('thumbnails', callback);
      EventService.off('thumbnails', callback);

      EventService.connect();
      sendMessage('thumbnails', { count: 10 });

      expect(callback).not.toHaveBeenCalled();
    });

    it('supports multiple listeners for same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      EventService.on('connected', callback1);
      EventService.on('connected', callback2);

      EventService.connect();
      sendMessage('connected', { status: 'ok' });

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('handles listener errors gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorCallback = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodCallback = vi.fn();

      EventService.on('connected', errorCallback);
      EventService.on('connected', goodCallback);

      EventService.connect();
      sendMessage('connected', { status: 'ok' });

      expect(errorCallback).toHaveBeenCalled();
      expect(goodCallback).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('connected event', () => {
    it('emits connected event with data', () => {
      const callback = vi.fn();
      EventService.on('connected', callback);

      EventService.connect();
      sendMessage('connected', { uuid: 'test-123' });

      expect(callback).toHaveBeenCalledWith({ uuid: 'test-123' });
    });

    it('emits connection event when coming back online', () => {
      const connectionCallback = vi.fn();
      EventService.on('connection', connectionCallback);

      EventService.connect();

      // Simulate going offline
      mockEventSource.onerror();
      vi.advanceTimersByTime(3000);

      // Come back online
      sendMessage('connected', { status: 'ok' });

      expect(connectionCallback).toHaveBeenCalledWith({ online: true });
    });

    it('does not emit connection event on first connect', () => {
      const connectionCallback = vi.fn();
      EventService.on('connection', connectionCallback);

      EventService.connect();
      sendMessage('connected', { status: 'ok' });

      expect(connectionCallback).not.toHaveBeenCalled();
    });
  });

  describe('thumbnails event', () => {
    it('emits thumbnails event with parsed data', () => {
      const callback = vi.fn();
      EventService.on('thumbnails', callback);

      EventService.connect();
      sendMessage('thumbnails', { urls: ['thumb1.jpg'] });

      expect(callback).toHaveBeenCalledWith({ urls: ['thumb1.jpg'] });
    });
  });

  describe('unified message schema', () => {
    it('handles messages with type and payload', () => {
      const callback = vi.fn();
      EventService.on('custom-event', callback);

      EventService.connect();
      sendMessage('custom-event', { data: 'test' });

      expect(callback).toHaveBeenCalledWith({ data: 'test' });
    });

    it('warns on messages missing type', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      EventService.connect();
      const handler = getMessageHandler();
      handler({ data: JSON.stringify({ payload: 'no-type' }) });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[EventService] Message missing type:',
        expect.any(Object)
      );

      consoleWarnSpy.mockRestore();
    });

    it('handles malformed JSON gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      EventService.connect();
      const handler = getMessageHandler();
      handler({ data: 'not-valid-json' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[EventService] Failed to parse message:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('schedules offline notification after error', () => {
      const connectionCallback = vi.fn();
      EventService.on('connection', connectionCallback);

      EventService.connect();
      mockEventSource.onerror();

      vi.advanceTimersByTime(3000);

      expect(connectionCallback).toHaveBeenCalledWith({ online: false });
    });

    it('schedules reconnect after error', () => {
      EventService.connect();
      const firstInstance = mockEventSource;

      mockEventSource.onerror();
      vi.advanceTimersByTime(3000);

      expect(firstInstance.close).toHaveBeenCalled();
      expect(global.EventSource).toHaveBeenCalledTimes(2);
    });

    it('does not schedule multiple offline timeouts', () => {
      const connectionCallback = vi.fn();
      EventService.on('connection', connectionCallback);

      EventService.connect();
      mockEventSource.onerror();
      mockEventSource.onerror();
      mockEventSource.onerror();

      vi.advanceTimersByTime(3000);

      expect(connectionCallback).toHaveBeenCalledTimes(1);
    });

    it('does not schedule multiple reconnect timeouts', () => {
      EventService.connect();

      mockEventSource.onerror();
      mockEventSource.onerror();
      mockEventSource.onerror();

      vi.advanceTimersByTime(3000);

      expect(global.EventSource).toHaveBeenCalledTimes(2);
    });

    it('clears offline timeout when connected event arrives', () => {
      const connectionCallback = vi.fn();
      EventService.on('connection', connectionCallback);

      EventService.connect();
      mockEventSource.onerror();

      // Reconnect before offline timeout
      vi.advanceTimersByTime(1000);
      sendMessage('connected', { status: 'ok' });

      vi.advanceTimersByTime(3000);

      expect(connectionCallback).not.toHaveBeenCalled();
    });
  });

  describe('isOnline', () => {
    it('returns true when connected', () => {
      EventService.connect();
      sendMessage('connected', { status: 'ok' });

      expect(EventService.isOnline()).toBe(true);
    });

    it('returns false when offline', () => {
      EventService.connect();
      mockEventSource.onerror();
      vi.advanceTimersByTime(3000);

      expect(EventService.isOnline()).toBe(false);
    });

    it('returns true when status is unknown', () => {
      expect(EventService.isOnline()).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles rapid connect/disconnect cycles', () => {
      EventService.connect();
      EventService.disconnect();
      EventService.connect();
      EventService.disconnect();
      EventService.connect();

      expect(global.EventSource).toHaveBeenCalledTimes(3);
    });

    it('handles error before any connection event', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      EventService.connect();
      mockEventSource.onerror();

      vi.advanceTimersByTime(3000);

      expect(consoleLogSpy).toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });

    it('does not emit duplicate connection events', () => {
      const connectionCallback = vi.fn();
      EventService.on('connection', connectionCallback);

      EventService.connect();
      mockEventSource.onerror();
      vi.advanceTimersByTime(3000);

      connectionCallback.mockClear();

      mockEventSource.onerror();
      vi.advanceTimersByTime(3000);

      expect(connectionCallback).not.toHaveBeenCalled();
    });
  });
});
