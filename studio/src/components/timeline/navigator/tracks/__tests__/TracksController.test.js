import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TracksController from '../TracksController';

const trackInstances = [];
// Lets a test choose what the zone list reports as selected
const zoneState = vi.hoisted(() => ({ selected: null }));

vi.mock('../../../../../config/constants', () => ({
  TRACK_ACTION: { CUT: 'cut', VOLUME: 'volume', PAN: 'pan' },
  TRACKS: { DEFAULT_HEIGHT: 80 }
}));

vi.mock('../../../../../lib', () => ({
  getTimeFromPosX: vi.fn((posX, scale) => posX / 10),
  getPosXFromTime: vi.fn((time, scale) => time * 10),
  getTimelinePosXFromClientX: vi.fn(clientX => clientX)
}));

vi.mock('../../../../core/zones', () => ({
  ZoneListController: class {
    init = vi.fn().mockResolvedValue(true);
    add = vi.fn();
    remove = vi.fn();
    getChild = vi.fn();
    getSelected = vi.fn(() => zoneState.selected);
    setSelected = vi.fn().mockReturnValue(true);
    getComposite = vi.fn().mockReturnValue(null);
    addComposite = vi.fn().mockReturnValue(document.createElement('div'));
    getCount = vi.fn().mockReturnValue(0);
    getNumChildren = vi.fn().mockReturnValue(0);
    getData = vi.fn().mockReturnValue([]);
    getNewId = vi.fn().mockReturnValue('new-id');
    forEach = vi.fn();
  }
}));

vi.mock('../TrackPresenter', () => ({
  default: class {
    constructor(config) {
      this.config = config;
      trackInstances.push(this);
    }
    getId = vi.fn().mockReturnValue('test-id');
    select = vi.fn();
    deselect = vi.fn();
    clean = vi.fn().mockResolvedValue(true);
    getRoot = vi.fn().mockReturnValue(document.createElement('div'));
    setContainerCallbacks = vi.fn();
  }
}));

vi.mock('../TracksEventHandler', () => ({
  default: class {
    destroy = vi.fn();
  }
}));

vi.mock('../views', () => ({
  CutZoneOverlay: class {
    show = vi.fn();
    hide = vi.fn();
    destroy = vi.fn();
  }
}));

vi.mock('../../../../../services/ToolMode', () => ({
  onModeChange: vi.fn().mockReturnValue(vi.fn()),
  isMode: vi.fn().mockReturnValue(false),
  deactivate: vi.fn(),
  getMode: vi.fn().mockReturnValue(null)
}));

vi.mock('../../../../../services/CutService', () => ({
  splitAt: vi.fn().mockResolvedValue({ left: {}, right: {} })
}));

vi.mock('../../../../../services/SnappingService', () => ({
  default: {
    registerSnapPoints: vi.fn(),
    unregisterSnapPoints: vi.fn(),
    clearSnapPoints: vi.fn()
  }
}));

describe('TracksController', () => {
  let $parent;
  let controller;
  let mockCallbacks;

  beforeEach(() => {
    $parent = document.createElement('div');
    $parent.classList.add('timeline');
    document.body.appendChild($parent);
    trackInstances.length = 0;

    mockCallbacks = {
      onMove: vi.fn(),
      onSetMenu: vi.fn(),
      onDragEnd: vi.fn(),
      onRevealSelection: vi.fn(),
      onTracksChange: vi.fn()
    };
    zoneState.selected = null;

    vi.clearAllMocks();
  });

  afterEach(() => {
    controller = null;
    $parent.remove();
  });

  describe('Initialization', () => {
    it('creates tracks element', () => {
      controller = new TracksController($parent, mockCallbacks);

      const $tracks = $parent.querySelector('[data-testid="tracks-container"]');
      expect($tracks).toBeTruthy();
    });

    it('creates placeholder element', () => {
      controller = new TracksController($parent, mockCallbacks);

      const $placeholder = $parent.querySelector('.tracks-placeholder');
      expect($placeholder).toBeTruthy();
    });

    it('initializes with config', async () => {
      controller = new TracksController($parent, mockCallbacks);

      const mockRuler = { getScale: () => 0.1 };
      const result = await controller.init([], mockRuler);

      expect(result).toBe(true);
      expect(mockCallbacks.onSetMenu).toHaveBeenCalledWith(controller);
    });
  });

  describe('Track Operations', () => {
    beforeEach(async () => {
      controller = new TracksController($parent, mockCallbacks);
      const mockRuler = { getScale: () => 0.1 };
      await controller.init([], mockRuler);
    });

    it('getSelected returns null when no track selected', () => {
      const selected = controller.getSelected();
      expect(selected).toBeNull();
    });

    it('getCount returns track count', () => {
      const count = controller.getCount();
      expect(typeof count).toBe('number');
    });

    it('clone configures callbacks on cloned track', () => {
      const sourceTrack = {
        getGroupElement: vi.fn().mockReturnValue(document.createElement('div')),
        clone: vi.fn().mockReturnValue({ id: 'source-track' })
      };

      const cloned = controller.clone(sourceTrack);

      expect(cloned).toBe(true);
      expect(trackInstances).toHaveLength(1);
      expect(trackInstances[0].setContainerCallbacks).toHaveBeenCalledTimes(1);
    });
  });

  describe('select', () => {
    const zone = { getId: () => 'clip-1', select: vi.fn(), deselect: vi.fn() };

    beforeEach(async () => {
      controller = new TracksController($parent, mockCallbacks);
      await controller.init([], { getScale: () => 0.1 });
      zoneState.selected = zone;
    });

    it('reveals the clip when the user picked it (opens the Inspector)', () => {
      controller.select('clip-1', { reveal: true });

      expect(mockCallbacks.onRevealSelection).toHaveBeenCalledTimes(1);
    });

    it('does not reveal selections made by code (new track, split, duplicate)', () => {
      controller.select('clip-1');

      expect(mockCallbacks.onRevealSelection).not.toHaveBeenCalled();
      expect(mockCallbacks.onSetMenu).toHaveBeenCalled();
    });

    it('revealSelection reveals the clip that is already selected', () => {
      controller.revealSelection();

      expect(mockCallbacks.onRevealSelection).toHaveBeenCalledTimes(1);
    });

    it('does not reveal when nothing ends up selected', () => {
      zoneState.selected = null;

      controller.select('missing', { reveal: true });

      expect(mockCallbacks.onRevealSelection).not.toHaveBeenCalled();
    });
  });

  describe('Snapshots', () => {
    const cleanDomForSnapshot = $element => {
      if (!$element) return '';

      const clone = $element.cloneNode(true);

      clone.querySelectorAll('[style]').forEach($el => {
        $el.removeAttribute('style');
      });

      return clone.innerHTML;
    };

    it('matches DOM structure after creation', () => {
      controller = new TracksController($parent, mockCallbacks);

      const $tracks = $parent.querySelector('[data-testid="tracks-container"]');
      expect(cleanDomForSnapshot($tracks)).toMatchSnapshot('tracks-controller-initial');
    });

    it('matches DOM structure after initialization', async () => {
      controller = new TracksController($parent, mockCallbacks);
      const mockRuler = { getScale: () => 0.1 };
      await controller.init([], mockRuler);

      const $tracks = $parent.querySelector('[data-testid="tracks-container"]');
      expect(cleanDomForSnapshot($tracks)).toMatchSnapshot('tracks-controller-after-init');
    });

    it('matches public API shape', () => {
      controller = new TracksController($parent, mockCallbacks);

      const publicMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(controller))
        .filter(name => !name.startsWith('_') && !name.startsWith('#') && name !== 'constructor')
        .sort();

      expect(publicMethods).toMatchSnapshot('tracks-controller-public-api');
    });
  });
});
