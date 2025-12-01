// @ts-check

/**
 * Creates a debounced function that delays invoking fn until after wait ms
 * have elapsed since the last time the debounced function was invoked.
 *
 * @param {(...args: any[]) => any} fn - Function to debounce
 * @param {number} wait - Milliseconds to delay
 * @returns {((...args: any[]) => void) & { cancel: () => void }} Debounced function with cancel method
 */
export function debounce(fn, wait) {
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timeoutId = null;

  const debounced = function (...args) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn.apply(this, args);
    }, wait);
  };

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Creates a throttled function that only invokes fn at most once per wait ms.
 * Uses trailing edge by default.
 *
 * @param {(...args: any[]) => any} fn - Function to throttle
 * @param {number} wait - Minimum milliseconds between invocations
 * @param {{ leading?: boolean, trailing?: boolean }} [options]
 * @returns {((...args: any[]) => void) & { cancel: () => void }} Throttled function with cancel method
 */
export function throttle(fn, wait, options = {}) {
  const { leading = false, trailing = true } = options;

  /** @type {ReturnType<typeof setTimeout> | null} */
  let timeoutId = null;
  /** @type {any[] | null} */
  let lastArgs = null;
  /** @type {any} */
  let lastThis = null;
  let lastCallTime = 0;

  const invokeFunc = () => {
    fn.apply(lastThis, lastArgs);
    lastArgs = null;
    lastThis = null;
  };

  const throttled = function (...args) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    lastArgs = args;
    lastThis = this;

    if (timeSinceLastCall >= wait) {
      lastCallTime = now;

      if (leading) {
        invokeFunc();
      } else if (trailing && timeoutId === null) {
        timeoutId = setTimeout(() => {
          timeoutId = null;
          lastCallTime = Date.now();
          invokeFunc();
        }, wait);
      }
    } else if (trailing && timeoutId === null) {
      timeoutId = setTimeout(() => {
        timeoutId = null;
        lastCallTime = Date.now();
        invokeFunc();
      }, wait - timeSinceLastCall);
    }
  };

  throttled.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    lastArgs = null;
    lastThis = null;
  };

  return throttled;
}
