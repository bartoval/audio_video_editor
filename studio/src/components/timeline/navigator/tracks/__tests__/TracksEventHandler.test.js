import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../../../config/constants', () => ({
  TRACK_ACTION: { CUT: 'cut', VOLUME: 'volume', COPY: 'copy', REMOVE: 'remove' },
  CUT_STATE: { ACTIVE: 'active', READY: 'ready', IDLE: 'idle' }
}));

vi.mock('../../../../../lib', () => ({
  generateUuid: vi.fn(() => 'test-uuid'),
  getTimeFromPosX: vi.fn(posX => posX / 10)
}));

vi.mock('../../../../../store/uiStore', () => ({
  default: {
    actions: {
      refreshInspector: vi.fn()
    },
    subscribe: vi.fn().mockReturnValue(vi.fn()),
    getState: vi.fn().mockReturnValue({})
  }
}));

vi.mock('../../../../../services/ToolMode', () => ({
  activate: vi.fn(),
  deactivate: vi.fn(),
  toggle: vi.fn(),
  getMode: vi.fn().mockReturnValue(null),
  isMode: vi.fn().mockReturnValue(false),
  isActive: vi.fn().mockReturnValue(false),
  onModeChange: vi.fn().mockReturnValue(vi.fn())
}));

vi.mock('../../../../../services/CutService', () => ({
  isActive: vi.fn().mockReturnValue(false),
  getState: vi.fn().mockReturnValue('idle'),
  setStart: vi.fn().mockReturnValue(true),
  setEnd: vi.fn().mockReturnValue(true),
  updateEnd: vi.fn(),
  cancel: vi.fn(),
  deactivate: vi.fn()
}));

vi.mock('../../../../../services/SnappingService', () => ({
  default: {
    snap: vi.fn(posX => posX),
    beginDrag: vi.fn(),
    endDrag: vi.fn()
  }
}));

let TracksEventHandler;
let ToolMode;
let CutService;

describe('TracksEventHandler', () => {
  let handler;
  let mockContainer;
  let mockController;
  let $tracks;
  let mockZone;

  beforeAll(async () => {
    TracksEventHandler = (await import('../TracksEventHandler')).default;
    ToolMode = await import('../../../../../services/ToolMode');
    CutService = await import('../../../../../services/CutService');
  });

  beforeEach(() => {
    $tracks = document.createElement('div');
    $tracks.className = 'tracks';
    document.body.appendChild($tracks);

    mockZone = {
      getId: vi.fn().mockReturnValue('zone-1'),
      getStart: vi.fn().mockReturnValue(0),
      getEnd: vi.fn().mockReturnValue(10),
      getRoot: vi.fn().mockReturnValue(document.createElement('div')),
      dragStart: vi.fn(),
      dragStop: vi.fn(),
      drag: vi.fn(),
      isSnapEnabled: vi.fn().mockReturnValue(true),
      isEditingEnvelope: vi.fn().mockReturnValue(false),
      model: {
        isVolumeVisible: vi.fn().mockReturnValue(false)
      },
      volumeShow: vi.fn()
    };

    mockContainer = {
      getPosXFromClientX: vi.fn(clientX => clientX),
      isSplitMode: vi.fn().mockReturnValue(false),
      exitSplitMode: vi.fn(),
      handleSplitClick: vi.fn(),
      enterSplitMode: vi.fn(),
      select: vi.fn(),
      revealSelection: vi.fn(),
      clone: vi.fn(),
      remove: vi.fn(),
      addTrack: vi.fn(),
      updateSnapPoints: vi.fn()
    };

    mockController = {
      getChild: vi.fn().mockReturnValue(mockZone),
      getSelected: vi.fn().mockReturnValue(null),
      getPosX: vi.fn().mockReturnValue(0),
      getNewId: vi.fn().mockReturnValue('new-id'),
      addComposite: vi.fn().mockReturnValue(document.createElement('div')),
      getGroupAtY: vi.fn().mockReturnValue({ group: null, isNewRow: false, insertBefore: null }),
      moveToGroup: vi.fn(),
      getGroups: vi.fn().mockReturnValue([]),
      view: {
        createGroupAt: vi.fn().mockReturnValue(document.createElement('div'))
      }
    };

    handler = new TracksEventHandler(mockContainer, mockController, $tracks);
  });

  afterEach(() => {
    handler?.destroy();
    $tracks?.remove();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('creates handler and binds events', () => {
      expect(handler).toBeTruthy();
    });

    it('binds dragover event', () => {
      const event = new Event('dragover');
      event.preventDefault = vi.fn();

      $tracks.dispatchEvent(event);

      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  describe('mousedown handling', () => {
    it('ignores click without zone target', () => {
      const event = new MouseEvent('mousedown', { clientX: 100, bubbles: true });

      $tracks.dispatchEvent(event);

      expect(mockContainer.select).not.toHaveBeenCalled();
    });

    it('exits split mode when clicking outside zone', () => {
      mockContainer.isSplitMode.mockReturnValue(true);

      const event = new MouseEvent('mousedown', { clientX: 100, bubbles: true });
      $tracks.dispatchEvent(event);

      expect(mockContainer.exitSplitMode).toHaveBeenCalled();
    });

    it('handles click on zone in normal mode', () => {
      const $zone = document.createElement('div');
      $zone.setAttribute('data-zone-id', 'zone-1');
      $tracks.appendChild($zone);

      const event = new MouseEvent('mousedown', { clientX: 100, bubbles: true });
      Object.defineProperty(event, 'target', { value: $zone });

      $zone.dispatchEvent(event);

      expect(mockController.getChild).toHaveBeenCalledWith('zone-1');
    });

    it('handles split mode click', () => {
      mockContainer.isSplitMode.mockReturnValue(true);

      const $zone = document.createElement('div');
      $zone.setAttribute('data-zone-id', 'zone-1');
      $tracks.appendChild($zone);

      const event = new MouseEvent('mousedown', { clientX: 100, bubbles: true });

      $zone.dispatchEvent(event);

      expect(mockContainer.handleSplitClick).toHaveBeenCalled();
    });
  });

  describe('tool mode handling', () => {
    beforeEach(() => {
      ToolMode.isActive.mockReturnValue(true);
    });

    afterEach(() => {
      ToolMode.isActive.mockReturnValue(false);
      ToolMode.getMode.mockReturnValue(null);
    });

    it('handles copy tool action', () => {
      ToolMode.getMode.mockReturnValue('copy');

      const $zone = document.createElement('div');
      $zone.setAttribute('data-zone-id', 'zone-1');
      $tracks.appendChild($zone);

      const event = new MouseEvent('mousedown', { clientX: 100, bubbles: true });
      $zone.dispatchEvent(event);

      expect(mockContainer.clone).toHaveBeenCalledWith(mockZone);
    });

    it('handles remove tool action', () => {
      ToolMode.getMode.mockReturnValue('remove');

      const $zone = document.createElement('div');
      $zone.setAttribute('data-zone-id', 'zone-1');
      $tracks.appendChild($zone);

      const event = new MouseEvent('mousedown', { clientX: 100, bubbles: true });
      $zone.dispatchEvent(event);

      expect(mockContainer.remove).toHaveBeenCalledWith(mockZone);
    });

    it('shows volume envelope on volume tool', () => {
      ToolMode.getMode.mockReturnValue('volume');

      const $zone = document.createElement('div');
      $zone.setAttribute('data-zone-id', 'zone-1');
      $tracks.appendChild($zone);

      const event = new MouseEvent('mousedown', { clientX: 100, bubbles: true });
      $zone.dispatchEvent(event);

      expect(mockZone.volumeShow).toHaveBeenCalled();
    });
  });

  describe('cut mode handling', () => {
    beforeEach(() => {
      CutService.isActive.mockReturnValue(true);
    });

    afterEach(() => {
      CutService.isActive.mockReturnValue(false);
      CutService.getState.mockReturnValue('idle');
    });

    it('cancels cut when in ready state', () => {
      CutService.getState.mockReturnValue('ready');

      const $zone = document.createElement('div');
      $zone.setAttribute('data-zone-id', 'zone-1');
      $tracks.appendChild($zone);

      const event = new MouseEvent('mousedown', { clientX: 100, bubbles: true });
      $zone.dispatchEvent(event);

      expect(CutService.cancel).toHaveBeenCalled();
    });
  });

  describe('drag handling', () => {
    it('starts move drag on zone body click', () => {
      const $zone = document.createElement('div');
      $zone.setAttribute('data-zone-id', 'zone-1');
      $tracks.appendChild($zone);

      const event = new MouseEvent('mousedown', { clientX: 100, bubbles: true });
      $zone.dispatchEvent(event);

      expect(mockZone.dragStart).toHaveBeenCalledWith('move', 100);
    });

    it('starts resize drag on hook click', () => {
      const $zone = document.createElement('div');
      $zone.setAttribute('data-zone-id', 'zone-1');
      const $hook = document.createElement('div');
      $hook.className = 'hook-resize';
      $zone.appendChild($hook);
      $tracks.appendChild($zone);

      const event = new MouseEvent('mousedown', { clientX: 100, bubbles: true });
      Object.defineProperty(event, 'target', { value: $hook });

      $hook.dispatchEvent(event);

      expect(mockZone.dragStart).toHaveBeenCalledWith('resize');
    });

    it('adds dragging class during move', () => {
      const $zone = document.createElement('div');
      $zone.setAttribute('data-zone-id', 'zone-1');
      $tracks.appendChild($zone);

      const event = new MouseEvent('mousedown', { clientX: 100, bubbles: true });
      $zone.dispatchEvent(event);

      expect($tracks.classList.contains('dragging')).toBe(true);
    });

    it('removes dragging class on drag end', () => {
      const $zone = document.createElement('div');
      $zone.setAttribute('data-zone-id', 'zone-1');
      $tracks.appendChild($zone);

      const mousedown = new MouseEvent('mousedown', { clientX: 100, bubbles: true });
      $zone.dispatchEvent(mousedown);

      const mouseup = new MouseEvent('mouseup', { clientX: 150, bubbles: true });
      document.dispatchEvent(mouseup);

      expect($tracks.classList.contains('dragging')).toBe(false);
    });
  });

  describe('drop handling', () => {
    it('handles track drop from library', () => {
      const trackData = { id: 'track-1', label: 'Test Track', duration: 30 };

      const $zones = document.createElement('div');
      $zones.className = 'zones';
      $tracks.appendChild($zones);

      const event = new Event('drop', { bubbles: true });
      event.preventDefault = vi.fn();
      event.stopPropagation = vi.fn();
      event.dataTransfer = {
        getData: vi.fn().mockReturnValue(JSON.stringify(trackData))
      };
      Object.defineProperty(event, 'clientX', { value: 100 });
      Object.defineProperty(event, 'target', { value: $zones });

      $zones.dispatchEvent(event);

      expect(mockContainer.addTrack).toHaveBeenCalled();
    });

    it('handles multiple track drop', () => {
      const tracksData = [
        { id: 'track-1', label: 'Track 1', duration: 30 },
        { id: 'track-2', label: 'Track 2', duration: 20 }
      ];

      const $zones = document.createElement('div');
      $zones.className = 'zones';
      $tracks.appendChild($zones);

      const event = new Event('drop', { bubbles: true });
      event.preventDefault = vi.fn();
      event.stopPropagation = vi.fn();
      event.dataTransfer = {
        getData: vi.fn().mockReturnValue(JSON.stringify(tracksData))
      };
      Object.defineProperty(event, 'clientX', { value: 100 });
      Object.defineProperty(event, 'target', { value: $zones });

      $zones.dispatchEvent(event);

      expect(mockContainer.addTrack).toHaveBeenCalledTimes(2);
    });

    it('ignores drop with empty data', () => {
      const event = new Event('drop', { bubbles: true });
      event.preventDefault = vi.fn();
      event.stopPropagation = vi.fn();
      event.dataTransfer = {
        getData: vi.fn().mockReturnValue('')
      };

      $tracks.dispatchEvent(event);

      expect(mockContainer.addTrack).not.toHaveBeenCalled();
    });

    it('ignores drop with invalid JSON', () => {
      const event = new Event('drop', { bubbles: true });
      event.preventDefault = vi.fn();
      event.stopPropagation = vi.fn();
      event.dataTransfer = {
        getData: vi.fn().mockReturnValue('not-json')
      };

      $tracks.dispatchEvent(event);

      expect(mockContainer.addTrack).not.toHaveBeenCalled();
    });

    it('creates new composite for drop on tracks element', () => {
      const trackData = { id: 'track-1', label: 'Test Track', duration: 30 };

      const event = new Event('drop', { bubbles: true });
      event.preventDefault = vi.fn();
      event.stopPropagation = vi.fn();
      event.dataTransfer = {
        getData: vi.fn().mockReturnValue(JSON.stringify(trackData))
      };
      Object.defineProperty(event, 'clientX', { value: 100 });
      Object.defineProperty(event, 'target', { value: $tracks });

      $tracks.dispatchEvent(event);

      expect(mockController.addComposite).toHaveBeenCalled();
    });
  });

  describe('selection', () => {
    it('selects zone on click if not selected, revealing it in the Inspector', () => {
      mockController.getSelected.mockReturnValue(null);

      const $zone = document.createElement('div');
      $zone.setAttribute('data-zone-id', 'zone-1');
      $tracks.appendChild($zone);

      const event = new MouseEvent('mousedown', { clientX: 100, bubbles: true });
      $zone.dispatchEvent(event);

      expect(mockContainer.select).toHaveBeenCalledWith('zone-1', { reveal: true });
    });

    it('does not re-select an already selected zone, but still reveals it', () => {
      mockController.getSelected.mockReturnValue({ getId: () => 'zone-1' });

      const $zone = document.createElement('div');
      $zone.setAttribute('data-zone-id', 'zone-1');
      $tracks.appendChild($zone);

      const event = new MouseEvent('mousedown', { clientX: 100, bubbles: true });
      $zone.dispatchEvent(event);

      expect(mockContainer.select).not.toHaveBeenCalled();
      expect(mockContainer.revealSelection).toHaveBeenCalledTimes(1);
    });
  });

  describe('destroy', () => {
    it('cleans up event listeners and state', () => {
      handler.destroy();

      expect(handler).toBeTruthy();
    });

    it('stops active drag on destroy', () => {
      const $zone = document.createElement('div');
      $zone.setAttribute('data-zone-id', 'zone-1');
      $tracks.appendChild($zone);

      const event = new MouseEvent('mousedown', { clientX: 100, bubbles: true });
      $zone.dispatchEvent(event);

      handler.destroy();

      expect(mockZone.dragStop).toHaveBeenCalled();
    });
  });
});
