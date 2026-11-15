import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent } from '@testing-library/dom';
import { Inspector } from '../index.js';

vi.mock('../../../../../services/offline/LocalMedia', () => ({
  audioUrl: vi.fn(async id => `blob:local/${id}`)
}));
import { audioUrl } from '../../../../../services/offline/LocalMedia';

// Mock Oscilloscope
vi.mock('../../../../../lib', async () => {
  const actual = await vi.importActual('../../../../../lib');
  return {
    ...actual,
    Oscilloscope: class MockOscilloscope {
      constructor() {}
      attachAnalyser() {}
      attach() {}
      start() {}
      stop() {}
    }
  };
});

// Mock AudioContext (not available in jsdom)
class MockAnalyserNode {
  fftSize = 128;
  connect() {
    return this;
  }
}

class MockMediaElementSource {
  connect() {
    return this;
  }
}

class MockAudioContext {
  state = 'running';
  createAnalyser() {
    return new MockAnalyserNode();
  }
  createMediaElementSource() {
    return new MockMediaElementSource();
  }
  resume() {
    return Promise.resolve();
  }
}

globalThis.AudioContext = MockAudioContext;

describe('Inspector', () => {
  let $container;
  let inspector;
  let mockAudioElement;
  let originalCreateElement;

  // Mock zone with blob
  const createMockZone = (overrides = {}) => ({
    blob: {
      idTrack: 'track-123',
      getDerivedId: vi.fn().mockReturnValue(overrides.derivedId ?? null),
      getStartTime: vi.fn().mockReturnValue(overrides.startTime ?? 10),
      getEndTime: vi.fn().mockReturnValue(overrides.endTime ?? 30)
    },
    getStart: vi.fn().mockReturnValue(overrides.timelineStart ?? 0),
    getEnd: vi.fn().mockReturnValue(overrides.timelineEnd ?? 60),
    getDuration: vi.fn().mockReturnValue(overrides.duration ?? 20),
    getLabel: vi.fn().mockReturnValue(overrides.label ?? 'Test Track'),
    getSpeed: vi.fn().mockReturnValue(overrides.speed ?? 1),
    getGain: vi.fn().mockReturnValue(overrides.gain ?? 1),
    getPitch: vi.fn().mockReturnValue(overrides.pitch ?? 0),
    setSpeed: vi.fn(),
    setGain: vi.fn(),
    setPitch: vi.fn(),
    ...overrides
  });

  beforeEach(() => {
    $container = document.createElement('div');
    document.body.appendChild($container);

    // Store original
    originalCreateElement = document.createElement.bind(document);

    // Create a real audio element that we can spy on
    mockAudioElement = originalCreateElement('audio');
    mockAudioElement.play = vi.fn().mockResolvedValue();
    mockAudioElement.pause = vi.fn();
    mockAudioElement.load = vi.fn();

    // Mock createElement for audio
    vi.spyOn(document, 'createElement').mockImplementation(tag => {
      if (tag === 'audio') {
        return mockAudioElement;
      }
      return originalCreateElement(tag);
    });
  });

  afterEach(() => {
    if (inspector) {
      inspector.destroy();
      inspector = null;
    }
    // Clean up any inspector panels appended to body
    document.querySelectorAll('.inspector-panel').forEach(el => el.remove());
    // Clean up audio element if still attached
    if (mockAudioElement?.parentNode) {
      mockAudioElement.remove();
    }
    if ($container?.parentNode) {
      document.body.removeChild($container);
    }
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('renders inspector panel to body', () => {
      inspector = new Inspector($container);

      const $panel = document.querySelector('.inspector-panel');
      expect($panel).toBeTruthy();
    });

    it('panel is hidden by default', () => {
      inspector = new Inspector($container);

      const $panel = document.querySelector('.inspector-panel');
      expect($panel.classList.contains('open')).toBe(false);
    });

    it('renders header with close button', () => {
      inspector = new Inspector($container);

      const $header = document.querySelector('.inspector-header');
      const $closeBtn = $header.querySelector('.inspector-close');

      expect($header).toBeTruthy();
      expect($closeBtn).toBeTruthy();
    });

    it('renders pitch, speed and volume controls', () => {
      inspector = new Inspector($container);

      const $pitch = document.querySelector('[data-ref="pitch"]');
      const $speed = document.querySelector('[data-ref="speed"]');
      const $gain = document.querySelector('[data-ref="gain"]');

      expect($pitch).toBeTruthy();
      expect($speed).toBeTruthy();
      expect($gain).toBeTruthy();
    });

    it('controls are disabled by default', () => {
      inspector = new Inspector($container);

      const $pitch = document.querySelector('[data-ref="pitch"]');
      const $speed = document.querySelector('[data-ref="speed"]');
      const $gain = document.querySelector('[data-ref="gain"]');
      const $playBtn = document.querySelector('[data-ref="playBtn"]');

      expect($pitch.disabled).toBe(true);
      expect($speed.disabled).toBe(true);
      expect($gain.disabled).toBe(true);
      expect($playBtn.disabled).toBe(true);
    });
  });

  describe('open/close', () => {
    beforeEach(() => {
      inspector = new Inspector($container);
    });

    it('open() adds open class', () => {
      inspector.open();

      const $panel = document.querySelector('.inspector-panel');
      expect($panel.classList.contains('open')).toBe(true);
    });

    it('close() removes open class', () => {
      inspector.open();
      inspector.close();

      const $panel = document.querySelector('.inspector-panel');
      expect($panel.classList.contains('open')).toBe(false);
    });

    it('toggle() opens when closed', () => {
      inspector.toggle();

      expect(inspector.isOpen()).toBe(true);
    });

    it('toggle() closes when open', () => {
      inspector.open();
      inspector.toggle();

      expect(inspector.isOpen()).toBe(false);
    });

    it('close button closes panel', () => {
      inspector.open();

      const $closeBtn = document.querySelector('.inspector-close');
      fireEvent.click($closeBtn);

      expect(inspector.isOpen()).toBe(false);
    });

    it('isOpen() returns correct state', () => {
      expect(inspector.isOpen()).toBe(false);

      inspector.open();
      expect(inspector.isOpen()).toBe(true);

      inspector.close();
      expect(inspector.isOpen()).toBe(false);
    });
  });

  describe('zone selection', () => {
    beforeEach(() => {
      inspector = new Inspector($container);
    });

    it('enables controls when zone is selected', () => {
      const mockZone = createMockZone();
      const mockContainer = { getSelected: () => mockZone };

      inspector.set(mockContainer);

      const $pitch = document.querySelector('[data-ref="pitch"]');
      const $speed = document.querySelector('[data-ref="speed"]');
      const $gain = document.querySelector('[data-ref="gain"]');
      const $playBtn = document.querySelector('[data-ref="playBtn"]');

      expect($pitch.disabled).toBe(false);
      expect($speed.disabled).toBe(false);
      expect($gain.disabled).toBe(false);
      expect($playBtn.disabled).toBe(false);
    });

    it('disables controls when no zone selected', () => {
      const mockContainer = { getSelected: () => null };

      inspector.set(mockContainer);

      const $pitch = document.querySelector('[data-ref="pitch"]');
      expect($pitch.disabled).toBe(true);
    });

    it('displays zone properties', () => {
      // Note: getSpeed returns stretch factor, UI shows playback speed (inverted)
      // stretch=0.8 means playback at 125%, stretch=1.5 means playback at 67%
      const mockZone = createMockZone({
        pitch: 3,
        speed: 0.8, // stretch factor: 1/0.8 = 125% playback speed
        gain: 0.8
      });
      const mockContainer = { getSelected: () => mockZone };

      inspector.set(mockContainer);

      const $pitch = document.querySelector('[data-ref="pitch"]');
      const $speed = document.querySelector('[data-ref="speed"]');
      const $gain = document.querySelector('[data-ref="gain"]');
      const $pitchValue = document.querySelector('[data-ref="pitchValue"]');
      const $speedValue = document.querySelector('[data-ref="speedValue"]');
      const $gainValue = document.querySelector('[data-ref="gainValue"]');

      expect($pitch.value).toBe('3');
      expect($pitchValue.textContent).toBe('3');
      expect($speed.value).toBe('125'); // 1/0.8 * 100 = 125
      expect($speedValue.textContent).toBe('125%');
      expect($gain.value).toBe('80');
      expect($gainValue.textContent).toBe('80%');
    });

    it('displays track info', () => {
      const mockZone = createMockZone({ label: 'My Song' });
      const mockContainer = { getSelected: () => mockZone };

      inspector.set(mockContainer);

      const $trackInfo = document.querySelector('[data-ref="trackInfo"]');
      expect($trackInfo.textContent).toContain('My Song');
    });

    it('shows placeholder when no selection', () => {
      const mockContainer = { getSelected: () => null };

      inspector.set(mockContainer);

      const $trackInfo = document.querySelector('[data-ref="trackInfo"]');
      expect($trackInfo.textContent).toContain('Select a track');
    });
  });

  describe('playback - zone boundaries', () => {
    let mockZone;

    beforeEach(() => {
      inspector = new Inspector($container);

      mockZone = createMockZone({
        startTime: 15, // blob start time (audio file)
        endTime: 45, // blob end time (audio file)
        timelineStart: 0, // timeline position (different!)
        timelineEnd: 120
      });

      const mockContainer = { getSelected: () => mockZone };
      inspector.set(mockContainer);
    });

    it('uses blob.getStartTime() for audio start position', async () => {
      const $playBtn = document.querySelector('[data-ref="playBtn"]');
      fireEvent.click($playBtn);

      // Trigger onloadeddata and wait for async handler
      await mockAudioElement.onloadeddata?.();

      expect(mockAudioElement.currentTime).toBe(15);
    });

    it('uses blob.getEndTime() to determine stop point', async () => {
      const $playBtn = document.querySelector('[data-ref="playBtn"]');
      fireEvent.click($playBtn);

      await mockAudioElement.onloadeddata?.();

      // Simulate playback reaching end
      mockAudioElement.currentTime = 45;
      mockAudioElement.ontimeupdate?.();

      expect(mockAudioElement.pause).toHaveBeenCalled();
    });

    it('does not stop before reaching zone end', async () => {
      const $playBtn = document.querySelector('[data-ref="playBtn"]');
      fireEvent.click($playBtn);

      await mockAudioElement.onloadeddata?.();

      // Reset pause mock after onloadeddata (it may have been called during setup)
      mockAudioElement.pause.mockClear();

      // Simulate playback at middle of zone
      mockAudioElement.currentTime = 30;
      mockAudioElement.ontimeupdate?.();

      expect(mockAudioElement.pause).not.toHaveBeenCalled();
    });

    it('applies playback speed when speed slider changes', () => {
      inspector = new Inspector($container);
      const mockZone = createMockZone();
      const mockContainer = { getSelected: () => mockZone };
      inspector.set(mockContainer);

      const $speed = document.querySelector('[data-ref="speed"]');

      fireEvent.input($speed, { target: { value: '120' } });

      expect(mockAudioElement.playbackRate).toBe(1.2);
    });

    it('applies 50% playback speed correctly', () => {
      inspector = new Inspector($container);
      const mockZone = createMockZone();
      const mockContainer = { getSelected: () => mockZone };
      inspector.set(mockContainer);

      const $speed = document.querySelector('[data-ref="speed"]');

      fireEvent.input($speed, { target: { value: '50' } });

      expect(mockAudioElement.playbackRate).toBe(0.5);
    });
  });

  describe('controls interaction', () => {
    let mockZone;

    beforeEach(() => {
      inspector = new Inspector($container);
      mockZone = createMockZone();
      const mockContainer = { getSelected: () => mockZone };
      inspector.set(mockContainer);
    });

    it('updates pitch on input change', () => {
      const $pitch = document.querySelector('[data-ref="pitch"]');

      fireEvent.input($pitch, { target: { value: '5' } });
      fireEvent.change($pitch, { target: { value: '5' } });

      expect(mockZone.setPitch).toHaveBeenCalledWith(5);
    });

    it('updates speed on input', () => {
      // Slider value 120 = 120% playback speed
      // setSpeed is called with stretch factor: 1/1.2 = 0.833...
      const $speed = document.querySelector('[data-ref="speed"]');

      fireEvent.input($speed, { target: { value: '120' } });

      expect(mockZone.setSpeed).toHaveBeenCalledWith(1 / 1.2);
    });

    it('updates gain on input', () => {
      const $gain = document.querySelector('[data-ref="gain"]');

      fireEvent.input($gain, { target: { value: '80' } });

      expect(mockZone.setGain).toHaveBeenCalledWith(0.8);
    });

    it('displays pitch value', () => {
      const $pitch = document.querySelector('[data-ref="pitch"]');
      const $pitchValue = document.querySelector('[data-ref="pitchValue"]');

      fireEvent.input($pitch, { target: { value: '-3' } });

      expect($pitchValue.textContent).toBe('-3');
    });

    it('displays speed as percentage', () => {
      const $speed = document.querySelector('[data-ref="speed"]');
      const $speedValue = document.querySelector('[data-ref="speedValue"]');

      fireEvent.input($speed, { target: { value: '75' } });

      expect($speedValue.textContent).toBe('75%');
    });

    it('displays gain as percentage', () => {
      const $gain = document.querySelector('[data-ref="gain"]');
      const $gainValue = document.querySelector('[data-ref="gainValue"]');

      // Gain slider range is 0-100
      fireEvent.input($gain, { target: { value: '75' } });

      expect($gainValue.textContent).toBe('75%');
    });
  });

  describe('playback toggle', () => {
    beforeEach(() => {
      inspector = new Inspector($container);
      inspector.open();

      const mockZone = createMockZone();
      const mockContainer = { getSelected: () => mockZone };
      inspector.set(mockContainer);
    });

    it('play button starts playback', async () => {
      const $playBtn = document.querySelector('[data-ref="playBtn"]');
      fireEvent.click($playBtn);

      await mockAudioElement.onloadeddata?.();

      await vi.waitFor(() => expect(mockAudioElement.play).toHaveBeenCalled());
    });

    it('play button changes to pause icon when playing', async () => {
      const $playBtn = document.querySelector('[data-ref="playBtn"]');
      fireEvent.click($playBtn);

      await mockAudioElement.onloadeddata?.();
      mockAudioElement.dispatchEvent(new Event('play'));

      const $icon = $playBtn.querySelector('i');
      expect($icon.className).toContain('pause');
    });

    it('clicking again pauses playback', async () => {
      const $playBtn = document.querySelector('[data-ref="playBtn"]');

      // Start playback
      fireEvent.click($playBtn);
      mockAudioElement.onloadeddata?.();

      // Pause
      fireEvent.click($playBtn);

      expect(mockAudioElement.pause).toHaveBeenCalled();
    });

    it('resets to start when audio ends', async () => {
      const $playBtn = document.querySelector('[data-ref="playBtn"]');
      fireEvent.click($playBtn);

      mockAudioElement.onloadeddata?.();

      // Simulate audio ending
      mockAudioElement.onended?.();

      const $icon = $playBtn.querySelector('i');
      expect($icon.className).toContain('play');
    });
  });

  describe('edge cases', () => {
    it('handles zone without blob', () => {
      inspector = new Inspector($container);

      const mockZone = createMockZone();
      mockZone.blob = null;
      const mockContainer = { getSelected: () => mockZone };

      inspector.set(mockContainer);

      const $playBtn = document.querySelector('[data-ref="playBtn"]');
      expect(() => fireEvent.click($playBtn)).not.toThrow();
    });

    it('handles zone without idTrack', () => {
      inspector = new Inspector($container);

      const mockZone = createMockZone();
      mockZone.blob.idTrack = null;
      const mockContainer = { getSelected: () => mockZone };

      inspector.set(mockContainer);

      const $playBtn = document.querySelector('[data-ref="playBtn"]');
      expect(() => fireEvent.click($playBtn)).not.toThrow();
    });

    it('stops playback when zone changes', () => {
      inspector = new Inspector($container);

      const zone1 = createMockZone({ label: 'Track 1' });
      const zone2 = createMockZone({ label: 'Track 2' });

      inspector.set({ getSelected: () => zone1 });
      inspector.set({ getSelected: () => zone2 });

      expect(mockAudioElement.pause).toHaveBeenCalled();
    });

    it('resets play button icon when zone changes', async () => {
      inspector = new Inspector($container);
      inspector.open();

      const zone1 = createMockZone({ label: 'Track 1' });
      inspector.set({ getSelected: () => zone1 });

      const $playBtn = document.querySelector('[data-ref="playBtn"]');
      fireEvent.click($playBtn);
      await mockAudioElement.onloadeddata?.();
      mockAudioElement.dispatchEvent(new Event('play'));

      const $iconPlaying = $playBtn.querySelector('i');
      expect($iconPlaying.className).toContain('pause');

      const zone2 = createMockZone({ label: 'Track 2' });
      inspector.set({ getSelected: () => zone2 });

      const $iconAfterChange = $playBtn.querySelector('i');
      expect($iconAfterChange.className).toContain('play');
    });

    it('resumes from current position after pause', async () => {
      inspector = new Inspector($container);
      inspector.open();

      const mockZone = createMockZone({ startTime: 10 });
      inspector.set({ getSelected: () => mockZone });

      const $playBtn = document.querySelector('[data-ref="playBtn"]');

      fireEvent.click($playBtn);
      await mockAudioElement.onloadeddata?.();

      mockAudioElement.currentTime = 25;

      fireEvent.click($playBtn);
      mockAudioElement.dispatchEvent(new Event('pause'));

      mockAudioElement.currentTime = 25;

      fireEvent.click($playBtn);

      expect(mockAudioElement.currentTime).toBe(25);
    });

    it('handles null container', () => {
      inspector = new Inspector($container);

      expect(() => inspector.set(null)).not.toThrow();

      const $pitch = document.querySelector('[data-ref="pitch"]');
      expect($pitch.disabled).toBe(true);
    });

    it('stops playback on close', async () => {
      inspector = new Inspector($container);

      const mockZone = createMockZone();
      inspector.set({ getSelected: () => mockZone });

      const $playBtn = document.querySelector('[data-ref="playBtn"]');
      fireEvent.click($playBtn);
      mockAudioElement.onloadeddata?.();

      inspector.close();

      expect(mockAudioElement.pause).toHaveBeenCalled();
    });

    it('uses local audio for non-derived tracks', async () => {
      inspector = new Inspector($container);
      inspector.open();

      audioUrl.mockClear();

      const mockZone = createMockZone();
      inspector.set({ getSelected: () => mockZone });

      await vi.waitFor(() => expect(audioUrl).toHaveBeenCalledWith('track-123'));

      const $playBtn = document.querySelector('[data-ref="playBtn"]');
      fireEvent.click($playBtn);

      await vi.waitFor(() => expect(mockAudioElement.src).toBe('blob:local/track-123'));
    });

    it('uses local audio for derived tracks', async () => {
      inspector = new Inspector($container);
      inspector.open();

      audioUrl.mockClear();

      const mockZone = createMockZone({ derivedId: 'track-456-stretched.mp3' });
      inspector.set({ getSelected: () => mockZone });

      await vi.waitFor(() => expect(audioUrl).toHaveBeenCalledWith('track-456-stretched.mp3'));

      const $playBtn = document.querySelector('[data-ref="playBtn"]');
      fireEvent.click($playBtn);

      await vi.waitFor(() =>
        expect(mockAudioElement.src).toBe('blob:local/track-456-stretched.mp3')
      );
    });

    it('reloads source when derivedId becomes available after initial load', async () => {
      inspector = new Inspector($container);
      inspector.open();

      const mockZone = createMockZone();
      inspector.set({ getSelected: () => mockZone });

      audioUrl.mockClear();

      const $playBtn = document.querySelector('[data-ref="playBtn"]');
      fireEvent.click($playBtn);
      await mockAudioElement.onloadeddata?.();

      await vi.waitFor(() => expect(mockAudioElement.src).toBe('blob:local/track-123'));

      mockAudioElement.dispatchEvent(new Event('pause'));
      mockZone.blob.getDerivedId.mockReturnValue('track-123-pitched.mp3');

      fireEvent.click($playBtn);

      await vi.waitFor(() => expect(audioUrl).toHaveBeenCalledWith('track-123-pitched.mp3'));
      await vi.waitFor(() => expect(mockAudioElement.src).toBe('blob:local/track-123-pitched.mp3'));
    });
  });
});
