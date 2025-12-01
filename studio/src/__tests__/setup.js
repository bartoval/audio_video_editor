import { vi } from 'vitest';

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn(callback => {
  return setTimeout(callback, 16);
});

global.cancelAnimationFrame = vi.fn(id => {
  clearTimeout(id);
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock Image for thumbnail loading
global.Image = class {
  constructor() {
    setTimeout(() => {
      if (this.onload) {
        this.onload();
      }
    }, 0);
  }
};

// Mock fetch for manifest/thumbnails
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        scales: {
          0.01: { scale: '0.01', interval: 1, totalThumbs: 10, tiles: ['tile-0.png'] },
          0.02: { scale: '0.02', interval: 2, totalThumbs: 10, tiles: ['tile-0.png'] },
          0.05: { scale: '0.05', interval: 5, totalThumbs: 10, tiles: ['tile-0.png'] },
          0.1: { scale: '0.1', interval: 10, totalThumbs: 10, tiles: ['tile-0.png'] },
          0.2: { scale: '0.2', interval: 20, totalThumbs: 10, tiles: ['tile-0.png'] }
        }
      }),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
  })
);

// Mock SVG methods
if (typeof SVGElement !== 'undefined') {
  SVGElement.prototype.getBBox = vi.fn(() => ({
    x: 0,
    y: 0,
    width: 100,
    height: 20
  }));
}

// Mock Canvas 2D context
HTMLCanvasElement.prototype.getContext = vi.fn(type => {
  if (type === '2d') {
    return {
      fillStyle: '',
      strokeStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: vi.fn(text => ({ width: text.length * 8 })),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      closePath: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn()
    };
  }
  return null;
});

// Mock Web Audio API
global.window = global.window || {};
global.window.audioContextInstance = {
  decodeAudioData: vi.fn((arrayBuffer, successCallback) => {
    // Mock successful decode with empty AudioBuffer
    const mockAudioBuffer = {
      duration: 0,
      length: 0,
      numberOfChannels: 2,
      sampleRate: 44100,
      getChannelData: vi.fn(() => new Float32Array(0))
    };
    if (successCallback) {
      successCallback(mockAudioBuffer);
    }
    return Promise.resolve(mockAudioBuffer);
  })
};

// Helper to mock element dimensions
export function mockElementDimensions(element, { width = 800, height = 600, offsetLeft = 0 } = {}) {
  Object.defineProperties(element, {
    offsetWidth: { get: () => width, configurable: true },
    offsetHeight: { get: () => height, configurable: true },
    offsetLeft: { get: () => offsetLeft, configurable: true },
    clientWidth: { get: () => width, configurable: true },
    clientHeight: { get: () => height, configurable: true }
  });

  element.getBoundingClientRect = vi.fn(() => ({
    width,
    height,
    top: 0,
    left: offsetLeft,
    right: width,
    bottom: height,
    x: offsetLeft,
    y: 0
  }));
}

// Helper to create mock mouse event
export function createMouseEvent(type, { clientX = 0, clientY = 0, button = 0 } = {}) {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    button
  });
}

// Helper to simulate drag
export function simulateDrag(
  element,
  { startX = 0, startY = 0, endX = 100, endY = 0, steps = 5 } = {}
) {
  const events = [];

  // mousedown
  events.push(createMouseEvent('mousedown', { clientX: startX, clientY: startY }));

  // mousemove steps
  const deltaX = (endX - startX) / steps;
  const deltaY = (endY - startY) / steps;

  for (let i = 1; i <= steps; i++) {
    events.push(
      createMouseEvent('mousemove', {
        clientX: startX + deltaX * i,
        clientY: startY + deltaY * i
      })
    );
  }

  // mouseup
  events.push(createMouseEvent('mouseup', { clientX: endX, clientY: endY }));

  return events;
}
