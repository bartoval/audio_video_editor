# Contributing to Studio

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full architecture overview (directory structure, data flow, stores, services, persistence).

---

## MVP Rules

| Layer | Role | Imports allowed |
|-------|------|-----------------|
| **Presenter** | State, orchestration, service calls | Stores, services, EventService, config |
| **View** | DOM only — render, bind events, destroy | `lib/` utilities, CSS. **Never** stores/services |
| **Model** | Data + derived state | Pure logic only |

The View is **passive**: it receives state via `setState()` and communicates back via callbacks passed in the constructor.

## State Management

Two systems, different purposes:

| System | Use for | Example |
|--------|---------|---------|
| **Store** (`createStore`) | Persistent/shared state that multiple components read | `playbackStore.getState().time` |
| **EventService** | One-shot coordination between components | `EventService.emitLocal(EVENT.VIDEO_LOADED, data)` |

**Rule**: if a value is read by more than one component, it belongs in a Store. If it triggers a one-time action in another component, use EventService.

---

## Skeleton Component

Use this as a starting point when creating a new component. Based on `InspectorPresenter` + `InspectorView`.

### MyPresenter.js

```javascript
import uiStore from '../../store/uiStore';
import MyView from './MyView';

export default class MyPresenter {
  #view = null;
  #unsubscribeStore = null;

  constructor($parent) {
    this.#view = new MyView($parent, {
      onAction: value => this.#handleAction(value),
      onClose: () => this.close()
    });

    this.#unsubscribeStore = uiStore.subscribe(() => this.#refresh());
  }

  open() {
    this.#view?.setState({ visible: true });
  }

  close() {
    this.#view?.setState({ visible: false });
  }

  destroy() {
    this.#unsubscribeStore?.();
    this.#view?.destroy();
    this.#view = null;
  }

  #handleAction(value) {
    // Business logic here — call services, update stores
  }

  #refresh() {
    const state = uiStore.getState();
    this.#view?.setState({ /* derive view state from store */ });
  }
}
```

### MyView.js

```javascript
import { View } from '../../lib';

export default class MyView extends View {
  #$panel = null;
  #$actionBtn = null;
  #onAction = null;
  #onClose = null;

  constructor($parent, callbacks = {}) {
    super($parent);
    this.#onAction = callbacks.onAction || (() => {});
    this.#onClose = callbacks.onClose || (() => {});
    this.mount();
  }

  render() {
    this.#$panel = document.createElement('div');
    this.#$panel.className = 'my-component';

    this.#$actionBtn = document.createElement('button');
    this.#$actionBtn.textContent = 'Do something';
    this.#$actionBtn.setAttribute('aria-label', 'Do something');

    this.#$panel.appendChild(this.#$actionBtn);
    this.$parent.appendChild(this.#$panel);
  }

  onMount() {
    this.#$actionBtn.addEventListener('click', this.#handleClick);
  }

  onDestroy() {
    this.#$actionBtn?.removeEventListener('click', this.#handleClick);
    this.#$panel?.remove();
    super.onDestroy();
  }

  setState(state) {
    // Update DOM from state — no business logic
  }

  #handleClick = () => {
    this.#onAction('value');
  };
}
```

### Key conventions

- View receives callbacks in constructor, never imports services/stores
- Presenter subscribes to stores and unsubscribes in `destroy()`
- Event listeners registered in `onMount()`, removed in `onDestroy()`
- DOM elements prefixed with `$` (`#$panel`, `#$actionBtn`)
- Private fields use `#` prefix
- CSS state classes: `.is-active`, `.is-disabled`, `.hide`

---

## Testing

We use **Vitest**. Run tests with:

```bash
npm test              # all tests
npm run test:coverage # with coverage report
```

### Testing a Presenter

Mock dependencies at module level with `vi.mock()`, then test behavior through events and DOM:

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock services before import
vi.mock('../../services/EventService', () => ({
  on: vi.fn((event, cb) => {
    listeners.get(event)?.add(cb);
    return () => listeners.get(event)?.delete(cb);
  }),
  emitLocal: vi.fn((event, payload) => {
    listeners.get(event)?.forEach(cb => cb(payload));
  })
}));

vi.mock('../../store/uiStore', () => ({
  default: {
    getState: vi.fn(() => ({ toolMode: null })),
    subscribe: vi.fn(() => () => {})
  }
}));

const listeners = new Map();

describe('MyPresenter', () => {
  let MyPresenter;
  let $parent;

  beforeEach(async () => {
    vi.resetModules();
    listeners.clear();
    document.body.innerHTML = '<div id="root"></div>';
    $parent = document.getElementById('root');
    MyPresenter = (await import('./MyPresenter.js')).default;
  });

  it('updates DOM on store change', () => {
    const presenter = new MyPresenter($parent);
    // assert DOM state
    presenter.destroy();
  });
});
```

### What to mock

| Dependency | Mock strategy |
|------------|---------------|
| `EventService` | Fake `on`/`emitLocal` with local Map |
| Stores | Return static `getState()`, noop `subscribe` |
| `Mediator` | Noop all methods |
| `workspace` | Static URLs: `getRouteUrl: () => '/api/test'` |
| `MasterClock` | `{ registerVideo: vi.fn() }` |
| DOM | `document.body.innerHTML` in `beforeEach` |

---

## Events Catalog

All events are defined in `src/config/constants.js` as `EVENT.*`. Use `EventService.on()` to listen and `EventService.emitLocal()` to fire.

### Video

| Event | Payload | Fired when |
|-------|---------|------------|
| `VIDEO_LOADED` | `{ video, duration }` | Video loaded and ready |
| `VIDEO_DELETED` | `{}` | Video removed from workspace |
| `VIDEO_RESIZED` | — | Video element resized |

### Playback

| Event | Payload | Fired when |
|-------|---------|------------|
| `PLAYBACK_PLAY` | — | Play requested |
| `PLAYBACK_PAUSE` | — | Pause requested |
| `PLAYBACK_RESET` | `{ isScene? }` | Reset to beginning |
| `PLAYBACK_REWIND` | — | Jump to start |
| `PLAYBACK_SKIP_BACK` | `{ seconds }` | Skip backward |
| `PLAYBACK_SKIP_FORWARD` | `{ seconds }` | Skip forward |
| `PLAYBACK_FAST_FORWARD` | — | Jump to end |
| `PLAYBACK_SET_TIME_SLICE` | `{ start, end }` | Loop region set |
| `PLAYBACK_MOVE_FROM_NAVIGATOR` | `{ time }` | Seek from timeline click |
| `PLAYBACK_MOVE_FROM_PLAYER` | `{ time }` | Seek from player scrubber |

### Workspace

| Event | Payload | Fired when |
|-------|---------|------------|
| `WORKSPACE_LOAD_VIDEO` | `{ url, config }` | Video load requested |
| `WORKSPACE_INIT_AUDIO_ONLY` | `config` | Audio-only mode init |
| `WORKSPACE_GET_DATA` | — | Workspace state requested |

### Timeline

| Event | Payload | Fired when |
|-------|---------|------------|
| `TIMELINE_ADD_TRACKS` | tracks array | Audio tracks added to timeline |
| `TIMELINE_SCROLL_TO` | position | Scroll timeline to position |

### Jobs

| Event | Payload | Fired when |
|-------|---------|------------|
| `JOB_COMPLETED` | job data | Async job finished (stems, transcription) |
| `JOB_FAILED` | job data | Async job failed |
| `JOB_COUNT_CHANGED` | count | Active job count changed |

### Other

| Event | Payload | Fired when |
|-------|---------|------------|
| `LAYOUT_RESIZE` | — | Window or layout resized |
| `LIBRARY_REMOVED` | track id | Track removed from library |
| `CONNECTION` | `{ online }` | Online/offline status changed |
| `MARKERS_CHANGED` | markers | Timeline markers updated |
| `MARKER_PREVIOUS` / `MARKER_NEXT` | — | Navigate between markers |
| `LOOP_TOGGLE` | — | Toggle loop mode |
| `TRANSCRIPTION_READY` | data | Whisper transcription completed |

---

## Code Style

- **No single-letter params** (`v` -> `value`, `t` -> `track`)
- **Prefer destructuring**: `const { type, duration } = config`
- **Strings in config**: hardcoded messages go in `src/config/constants.js`
- **CSS selectors in config**: DOM selectors go in `src/config/ui.js`
- **`@ts-check` + JSDoc** on core modules (not full TypeScript)
- **No comments** unless explaining *why*, not *what*

## Type Checking

We use `// @ts-check` + JSDoc for gradual type checking (not full TypeScript). When adding or modifying a core module, add `@ts-check` at the top and import types via the `@/types` alias:
psrc/types/types.d.ts
```javascript
// @ts-check

/** @typedef {import('@/types').AudioConfig} AudioConfig */
```

Types are defined in `src/types/types.d.ts`. See [ARCHITECTURE.md](ARCHITECTURE.md#type-safety) for the list of type-checked files.

```bash
npm run typecheck
```

## Linting

ESLint runs automatically on pre-commit via husky + lint-staged.

```bash
npm run lint          # check
npm run lint:fix      # auto-fix
```
