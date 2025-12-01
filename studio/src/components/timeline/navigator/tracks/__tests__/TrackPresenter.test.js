import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TrackPresenter from '../TrackPresenter';

vi.mock('../../../../../lib', () => ({
  Audio: class {
    constructor(config) {
      this.config = config;
    }
    load = vi.fn().mockResolvedValue(true);
    play = vi.fn();
    stop = vi.fn();
    setDerivedId = vi.fn();
    getGain = vi.fn().mockReturnValue(1);
    setGain = vi.fn();
    getPan = vi.fn().mockReturnValue(0);
    setPan = vi.fn();
    getDuration = vi.fn().mockReturnValue(30);
    destroy = vi.fn();
  },
  getPosXFromTime: vi.fn((time, scale) => time * 10)
}));

vi.mock('../../../../core/zones', () => ({
  ZonePresenter: class {
    constructor(config, $parent, options) {
      this.config = config;
      this.$parent = $parent;
      this.model = options?.model;
      this.view = options?.view;
    }
    getId = vi.fn().mockReturnValue('test-track-id');
    select = vi.fn();
    deselect = vi.fn();
    getRoot = vi.fn().mockReturnValue(document.createElement('div'));
    clean = vi.fn().mockResolvedValue(true);
    zoom = vi.fn();
    getWidth = vi.fn().mockReturnValue(300);
    getStartTime = vi.fn().mockReturnValue(0);
    getDuration = vi.fn().mockReturnValue(30);
    moveTo = vi.fn();
  }
}));

vi.mock('../TrackModel', () => ({
  default: class {
    constructor(config) {
      this.config = config;
    }
    getStartTime = vi.fn().mockReturnValue(0);
    getDuration = vi.fn().mockReturnValue(30);
    getOriginalDuration = vi.fn().mockReturnValue(30);
    setStartTime = vi.fn();
    setDuration = vi.fn();
    getData = vi.fn().mockReturnValue({});
  }
}));

vi.mock('../TrackView', () => ({
  default: class {
    constructor($parent, config) {
      this.$parent = $parent;
      this.config = config;
      this.$root = document.createElement('div');
      this.$root.className = 'track';
      this.$root.setAttribute('data-testid', 'track-root');
      this.$content = document.createElement('div');
      this.$content.className = 'track-content';
      this.$root.appendChild(this.$content);
      $parent.appendChild(this.$root);
    }
    getRoot = vi.fn().mockReturnValue(this.$root);
    getContent = vi.fn().mockReturnValue(this.$content);
    setLabel = vi.fn();
    setSelected = vi.fn();
    destroy = vi.fn();
  }
}));

vi.mock('../TrackConfig', () => ({
  fromFlat: vi.fn(config => ({
    id: config.id || 'test-track-id',
    track: {
      idTrack: config.idTrack || 'audio-1',
      label: config.label || 'Test Track',
      startTime: config.startTime || 0,
      duration: config.duration || 30,
      derivedId: null
    },
    audio: {
      buffer: null,
      panValue: 0,
      volumeValues: [],
      volumePaths: []
    },
    cut: {
      startTimeBuffer: 0,
      endTimeBuffer: 0,
      isCutBuffer: false,
      start: 0,
      end: 30
    },
    transform: {
      stretchFactor: 1
    },
    waveform: {
      path: '',
      viewBox: '0 0 1000 100'
    }
  }))
}));

vi.mock('../controllers/WaveformController', () => ({
  default: class {
    render = vi.fn();
    destroy = vi.fn();
  }
}));

vi.mock('../controllers/VolumeController', () => ({
  default: class {
    render = vi.fn();
    destroy = vi.fn();
    show = vi.fn();
    hide = vi.fn();
  }
}));

vi.mock('../controllers/PanController', () => ({
  default: class {
    render = vi.fn();
    destroy = vi.fn();
    show = vi.fn();
    hide = vi.fn();
  }
}));

vi.mock('../controllers/CutZoneController', () => ({
  default: class {
    render = vi.fn();
    destroy = vi.fn();
  }
}));

vi.mock('../controllers/StretchInfoOverlay', () => ({
  default: class {
    show = vi.fn();
    hide = vi.fn();
    destroy = vi.fn();
  }
}));

vi.mock('../controllers/SuperZoomController', () => ({
  default: class {
    render = vi.fn();
    destroy = vi.fn();
  }
}));

vi.mock('../views/MoveHandle', () => ({
  default: class {
    render = vi.fn();
    destroy = vi.fn();
  }
}));

vi.mock('../views/ResizeHandles', () => ({
  default: class {
    render = vi.fn();
    destroy = vi.fn();
  }
}));

vi.mock('../views/FloatingTrackToolbar', () => ({
  default: class {
    render = vi.fn();
    destroy = vi.fn();
    show = vi.fn();
    hide = vi.fn();
  }
}));

vi.mock('../DragStrategy', () => ({
  default: class {
    init = vi.fn();
    destroy = vi.fn();
  },
  MoveDragStrategy: class {},
  ResizeDragStrategy: class {}
}));

describe('TrackPresenter', () => {
  let $parent;
  let track;

  const mockConfig = {
    id: 'track-1',
    idTrack: 'audio-1',
    label: 'Test Track',
    startTime: 0,
    duration: 30
  };

  beforeEach(() => {
    $parent = document.createElement('div');
    $parent.setAttribute('data-zone-group', 'group-1');
    document.body.appendChild($parent);

    vi.clearAllMocks();
  });

  afterEach(() => {
    track = null;
    $parent.remove();
  });

  describe('Initialization', () => {
    it('creates track element', () => {
      track = new TrackPresenter(mockConfig, $parent);

      const $track = $parent.querySelector('[data-testid="track-root"]');
      expect($track).toBeTruthy();
    });

    it('creates track with config', () => {
      track = new TrackPresenter(mockConfig, $parent);

      expect(track).toBeDefined();
      expect(track.blob).toBeDefined();
    });
  });

  describe('Snapshots', () => {
    it('matches public API shape', () => {
      track = new TrackPresenter(mockConfig, $parent);

      const proto = Object.getPrototypeOf(track);
      const parentProto = Object.getPrototypeOf(proto);

      const ownMethods = Object.getOwnPropertyNames(proto).filter(
        name => !name.startsWith('_') && !name.startsWith('#') && name !== 'constructor'
      );

      const inheritedMethods = Object.getOwnPropertyNames(parentProto).filter(
        name => !name.startsWith('_') && !name.startsWith('#') && name !== 'constructor'
      );

      const allMethods = [...new Set([...ownMethods, ...inheritedMethods])].sort();

      expect(allMethods).toMatchSnapshot('track-presenter-public-api');
    });

    it('matches instance properties', () => {
      track = new TrackPresenter(mockConfig, $parent);

      const publicProps = Object.keys(track)
        .filter(key => !key.startsWith('_') && !key.startsWith('#'))
        .sort();

      expect(publicProps).toMatchSnapshot('track-presenter-instance-props');
    });
  });
});
