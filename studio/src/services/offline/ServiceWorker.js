/**
 * ServiceWorker - registration and communication helper
 */

const SW_VERSION = 'v1';
const STORAGE_KEY = `sw-enabled-${SW_VERSION}`;

class ServiceWorkerService {
  static #instance = null;
  #registration = null;
  #isSupported = 'serviceWorker' in navigator;
  #isEnabled = true;

  constructor() {
    // Load saved preference
    const saved = localStorage.getItem(STORAGE_KEY);
    this.#isEnabled = saved === null ? true : saved === 'true';
  }

  // ============================================================================
  // Static API
  // ============================================================================

  static getInstance() {
    if (!ServiceWorkerService.#instance) {
      ServiceWorkerService.#instance = new ServiceWorkerService();
    }

    return ServiceWorkerService.#instance;
  }

  static register() {
    return ServiceWorkerService.getInstance().register();
  }

  static unregister() {
    return ServiceWorkerService.getInstance().unregister();
  }

  static isSupported() {
    return ServiceWorkerService.getInstance().isSupported;
  }

  static isEnabled() {
    return ServiceWorkerService.getInstance().isEnabled;
  }

  static isRegistered() {
    return ServiceWorkerService.getInstance().isRegistered;
  }

  static setEnabled(enabled) {
    return ServiceWorkerService.getInstance().setEnabled(enabled);
  }

  static postMessage(message) {
    return ServiceWorkerService.getInstance().postMessage(message);
  }

  static clearCache() {
    return ServiceWorkerService.postMessage({ type: 'CLEAR_CACHE' });
  }

  static clearApiCache() {
    return ServiceWorkerService.postMessage({ type: 'CLEAR_API_CACHE' });
  }

  static cacheWorkspace(uuid) {
    return ServiceWorkerService.postMessage({ type: 'CACHE_WORKSPACE', payload: { uuid } });
  }

  // ============================================================================
  // Instance API
  // ============================================================================

  async register() {
    if (!this.#isSupported || !this.#isEnabled) {
      return null;
    }

    // Check if already registered to avoid duplicates
    if (this.#registration) {
      return this.#registration;
    }

    try {
      // Check for existing registration first
      const existing = await navigator.serviceWorker.getRegistration('/');

      if (existing) {
        console.log('[SW Service] Using existing registration');
        this.#registration = existing;

        return existing;
      }

      console.log('[SW Service] Registering new SW');
      this.#registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      // Handle updates
      this.#registration.addEventListener('updatefound', () => {
        const newWorker = this.#registration.installing;

        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.#onUpdateAvailable();
            }
          });
        }
      });

      return this.#registration;
    } catch (err) {
      console.error('[SW Service] Registration failed:', err);

      return null;
    }
  }

  async unregister() {
    if (!this.#isSupported) {
      return false;
    }

    try {
      const registrations = await navigator.serviceWorker.getRegistrations();

      for (const registration of registrations) {
        await registration.unregister();
      }

      this.#registration = null;

      // Clear all caches
      const cacheNames = await caches.keys();

      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
      }

      return true;
    } catch {
      return false;
    }
  }

  async setEnabled(enabled) {
    this.#isEnabled = enabled;
    localStorage.setItem(STORAGE_KEY, String(enabled));

    if (enabled) {
      await this.register();
    } else {
      await this.unregister();
    }
  }

  postMessage(message) {
    if (!this.#isSupported || !this.#isEnabled) {
      return;
    }

    const sw = this.#registration?.active || navigator.serviceWorker.controller;

    if (sw) {
      sw.postMessage(message);
    }
  }

  #onUpdateAvailable() {
    // New version available - refresh to apply
  }

  // ============================================================================
  // Public Getters
  // ============================================================================

  get isSupported() {
    return this.#isSupported;
  }

  get isEnabled() {
    return this.#isEnabled;
  }

  get isRegistered() {
    return this.#registration !== null;
  }

  get registration() {
    return this.#registration;
  }
}

export default ServiceWorkerService;
