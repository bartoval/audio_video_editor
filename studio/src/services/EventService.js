// @ts-check

import { buildUrl } from '../config/routes';
import { SSE } from '../config/ui';
import * as Workspace from './workspace';

const { RECONNECT_DELAY, OFFLINE_DELAY } = SSE;

class EventService {
  /** @type {() => string} */
  #getEventSourceUrl;
  /** @type {EventSource | null} */
  #eventSource = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  #reconnectTimeout = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  #offlineTimeout = null;
  /** @type {boolean | undefined} */
  #isConnected = undefined;
  /** @type {Map<string, Set<(data: any) => void>>} */
  #listeners = new Map();

  constructor() {
    this.#getEventSourceUrl = () => buildUrl('events', Workspace.getUuid());
  }

  /** Override the SSE URL builder */
  configure({ getEventSourceUrl }) {
    if (getEventSourceUrl) this.#getEventSourceUrl = getEventSourceUrl;
  }

  connect() {
    this.#createEventSource();
  }

  disconnect() {
    this.#clearAllTimeouts();

    if (this.#eventSource) {
      this.#eventSource.close();
      this.#eventSource = null;
    }
  }

  /**
   * @param {string} event
   * @param {(data: any) => void} callback
   * @returns {() => void} Unsubscribe function
   */
  on(event, callback) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }

    this.#listeners.get(event)?.add(callback);

    return () => this.#listeners.get(event)?.delete(callback);
  }

  /**
   * @param {string} event
   * @param {(data: any) => void} callback
   */
  off(event, callback) {
    this.#listeners.get(event)?.delete(callback);
  }

  /** @returns {boolean} */
  isOnline() {
    return this.#isConnected !== false;
  }

  /**
   * @param {string} event
   * @param {any} data
   */
  emitLocal(event, data) {
    this.#emit(event, data);
  }

  /**
   * @param {string} event
   * @param {any} data
   * @returns {Promise<any>}
   */
  emitAsync(event, data) {
    return new Promise((resolve, reject) => {
      const callbacks = this.#listeners.get(event);

      if (!callbacks || callbacks.size === 0) {
        reject(new Error(`No handler for event: ${event}`));

        return;
      }

      const handler = callbacks.values().next().value;

      try {
        const result = handler(data);

        if (result instanceof Promise) {
          result.then(resolve).catch(reject);
        } else {
          resolve(result);
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  #createEventSource() {
    if (this.#eventSource) {
      this.#eventSource.close();
    }

    this.#clearAllTimeouts();

    const url = this.#getEventSourceUrl();
    this.#eventSource = new EventSource(url);

    this.#eventSource.onopen = () => {};

    this.#eventSource.addEventListener('message', this.#handleMessage);
    this.#eventSource.onerror = this.#handleError;
  }

  /**
   * @param {MessageEvent} event
   */
  #handleMessage = event => {
    try {
      const data = JSON.parse(event.data);
      const { type, payload } = data;

      if (!type) {
        console.warn('[EventService] Message missing type:', data);

        return;
      }

      if (type === 'connected') {
        this.#handleConnected(payload);
      } else {
        this.#emit(type, payload);
      }
    } catch (err) {
      console.error('[EventService] Failed to parse message:', err);
    }
  };

  /**
   * @param {Object} payload
   */
  #handleConnected(payload) {
    this.#clearAllTimeouts();

    const wasOffline = this.#isConnected === false;

    this.#isConnected = true;

    if (wasOffline) {
      this.#emit('connection', { online: true });
    }

    this.#emit('connected', payload);
  }

  #handleError = () => {
    console.log('[EventService] SSE error, isConnected:', this.#isConnected);

    if (!this.#offlineTimeout && this.#isConnected !== false) {
      console.log('[EventService] Scheduling offline in', OFFLINE_DELAY, 'ms');
      this.#offlineTimeout = setTimeout(() => {
        this.#offlineTimeout = null;
        console.log('[EventService] Setting offline');
        this.#setOnline(false);
      }, OFFLINE_DELAY);
    }

    if (!this.#reconnectTimeout) {
      if (this.#eventSource) {
        this.#eventSource.close();
        this.#eventSource = null;
      }

      this.#reconnectTimeout = setTimeout(() => {
        this.#reconnectTimeout = null;
        this.#createEventSource();
      }, RECONNECT_DELAY);
    }
  };

  /** @param {boolean} online */
  #setOnline(online) {
    console.log('[EventService] setOnline:', online, 'current:', this.#isConnected);

    if (this.#isConnected === online) {
      console.log('[EventService] State unchanged, skipping emit');

      return;
    }

    this.#isConnected = online;
    console.log('[EventService] Emitting connection event:', { online });
    this.#emit('connection', { online });
  }

  #clearAllTimeouts() {
    clearTimeout(this.#offlineTimeout);
    clearTimeout(this.#reconnectTimeout);
    this.#offlineTimeout = null;
    this.#reconnectTimeout = null;
  }

  /**
   * @param {string} event
   * @param {any} data
   */
  #emit(event, data) {
    const callbacks = this.#listeners.get(event);

    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error('[EventService] Listener error:', err);
        }
      });
    }
  }
}

const eventService = new EventService();

export const connect = () => eventService.connect();
export const disconnect = () => eventService.disconnect();
/** @type {(event: string, callback: (data: any) => void) => () => void} */
export const on = (event, callback) => eventService.on(event, callback);
/** @type {(event: string, callback: (data: any) => void) => void} */
export const off = (event, callback) => eventService.off(event, callback);
export const isOnline = () => eventService.isOnline();
/** @type {(event: string, data: any) => void} */
export const emitLocal = (event, data) => eventService.emitLocal(event, data);
/** @type {(event: string, data: any) => Promise<any>} */
export const emitAsync = (event, data) => eventService.emitAsync(event, data);

export default eventService;
