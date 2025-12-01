/**
 * Test fixtures and utilities for Navigator component tests
 */

/**
 * Create mock Mediator for Navigator tests
 */
export function createMockMediator() {
  return {
    registerNavigator: vi.fn(),
    onMoveFromNavigator: vi.fn(),
    onStop: vi.fn(),
    onStart: vi.fn(),
    onReset: vi.fn(),
    onSetTimeSlice: vi.fn()
  };
}

/**
 * Create mock callbacks for Navigator
 */
export function createMockCallbacks() {
  return {
    onMove: vi.fn(),
    onStop: vi.fn(),
    onStart: vi.fn(),
    onZoom: vi.fn(),
    onThumbnailProgress: vi.fn()
  };
}

/**
 * Create mock track data
 */
export function createMockTrack({
  id = 1,
  idTrack = 'track-1',
  label = 'Test Track',
  startTime = 0,
  durationTime = 10,
  startTimeBuffer = 0,
  endTimeBuffer = 10,
  groupId = 'group-1'
} = {}) {
  return {
    id,
    idTrack,
    label,
    startTime,
    durationTime,
    startTimeBuffer,
    endTimeBuffer,
    groupId,
    volumeValues: []
  };
}

/**
 * Create mock scene data
 */
export function createMockScene({
  id = 1,
  label = 'Scene 1',
  startTime = 0,
  durationTime = 10,
  color = '#3498db'
} = {}) {
  return {
    id,
    label,
    startTime,
    durationTime,
    color
  };
}

/**
 * Create mock config for Navigator.init()
 */
export function createMockConfig({
  duration = 60,
  tracks = [],
  scenes = [],
  scaleList = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  initialZoom = 4
} = {}) {
  return {
    duration,
    config: {
      tracks,
      scenes
    },
    scaleList,
    initialZoom
  };
}

/**
 * Create mock workspace metadata
 */
export function createMockWorkspace({
  uuid = 'test-uuid-123',
  videoUrl = '/test-video.mp4',
  videoMeta = {
    duration: 60,
    width: 1920,
    height: 1080,
    format: 'mp4'
  }
} = {}) {
  return {
    uuid,
    videoUrl,
    videoMeta
  };
}

/**
 * Create mock thumbnail manifest
 */
export function createMockThumbsManifest({
  thumbWidth = 100,
  thumbHeight = 56,
  scales = {
    0.1: {
      scale: 0.1,
      interval: 0.1,
      totalThumbs: 600,
      tiles: ['tile-0.jpg', 'tile-1.jpg']
    }
  }
} = {}) {
  return {
    thumbWidth,
    thumbHeight,
    scales
  };
}

/**
 * Mock ConfigStore methods
 */
export function mockConfigStore() {
  return {
    getScales: vi.fn(() => [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5]),
    getDefaultScale: vi.fn(() => 0.1),
    getThumbScaleForZoom: vi.fn(() => 0.1),
    getTiles: vi.fn(() => ({ rows: 10, cols: 10 })),
    getThumbsPerTile: vi.fn(() => 100)
  };
}

/**
 * Wait for async operations (thumbnails, etc.)
 */
export async function waitForAsync(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for next animation frame
 */
export async function waitForAnimationFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}
