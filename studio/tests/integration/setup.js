/**
 * Integration tests setup
 * Runs in real browser via Playwright
 */

// Add any global setup for integration tests here
// Unlike unit tests, we have a real DOM environment

// Helper to wait for element
globalThis.waitForElement = (selector, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      const element = document.querySelector(selector);

      if (element) {
        resolve(element);

        return;
      }

      if (Date.now() - startTime > timeout) {
        reject(new Error(`Element ${selector} not found after ${timeout}ms`));

        return;
      }

      requestAnimationFrame(check);
    };

    check();
  });
};

// Helper to simulate drag
globalThis.simulateDrag = (element, startX, startY, endX, endY) => {
  const rect = element.getBoundingClientRect();

  element.dispatchEvent(
    new MouseEvent('mousedown', {
      clientX: rect.left + startX,
      clientY: rect.top + startY,
      bubbles: true
    })
  );

  document.dispatchEvent(
    new MouseEvent('mousemove', {
      clientX: rect.left + endX,
      clientY: rect.top + endY,
      bubbles: true
    })
  );

  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
};

// Helper to create track container with proper dimensions
globalThis.createTrackContainer = (width = 500, height = 100) => {
  const container = document.createElement('div');
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.position = 'relative';
  document.body.appendChild(container);

  return container;
};
