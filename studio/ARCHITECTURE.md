# Studio Frontend Architecture

## Overview

Studio is a web-based DAW (Digital Audio Workstation) built with vanilla JavaScript following established architectural patterns: **MVP** (Model-View-Presenter), **Flux-like stores**, and **Event-driven communication**.

---

## High-Level Architecture

```mermaid
graph TB
    subgraph Presentation["Presentation Layer"]
        Header[Header]
        Library[Library]
        Video[Video Player]
        Player[Playback Controls]
        Navigator[Timeline Editor]
        Inspector[Inspector Panel]
    end

    subgraph Orchestration["Orchestration Layer"]
        Mediator[Mediator]
        EventService[EventService]
    end

    subgraph State["State Management"]
        playbackStore[(playbackStore)]
        timelineStore[(timelineStore)]
        workspaceStore[(workspaceStore)]
        uiStore[(uiStore)]
    end

    subgraph Services["Service Layer"]
        PlaybackController[PlaybackController]
        ScaleManager[ScaleManager]
        ToolMode[ToolMode]
        ShortcutService[ShortcutService]
        JobTracker[JobTrackerService]
        Api[Api]
    end

    subgraph Core["Core Libraries"]
        MasterClock[MasterClock]
        Audio[Audio Engine]
        Persist[IndexedDB Persist]
    end

    Header --> Mediator
    Library --> EventService
    Video --> Mediator
    Player --> PlaybackController
    Navigator --> EventService
    Inspector --> EventService

    Mediator --> Video
    Mediator --> Player
    Mediator --> Navigator

    EventService --> playbackStore
    EventService --> timelineStore
    EventService --> workspaceStore

    PlaybackController --> MasterClock
    PlaybackController --> playbackStore
    Navigator --> Audio

    JobTracker --> EventService

    playbackStore --> Persist
    timelineStore --> Persist
    workspaceStore --> Persist

    Api --> EventService
```

---

## Component Hierarchy

```mermaid
graph TB
    App[App.js]

    App --> Library
    App --> Video
    App --> Player
    App --> Navigator
    App --> Header
    App --> Mediator

    subgraph Library["Library Panel"]
        LibraryPresenter[LibraryPresenter]
        LibraryModel[LibraryModel]
        LibraryView[LibraryView]
        LibraryPlayback[LibraryPlayback]
        LibraryUpload[LibraryUpload]
    end

    subgraph Video["Video Player"]
        VideoPresenter[VideoPresenter]
        VideoView[VideoView]
    end

    subgraph Player["Playback Controls"]
        PlayerPresenter[PlayerPresenter]
        ControlBar[ControlBar]
    end

    subgraph Navigator["Timeline Editor"]
        NavPresenter[Navigator]
        RulerController[RulerController]
        TracksController[TracksController]
        MarkerController[MarkerController]
        Minimap[Minimap]
        ThumbnailsView[ThumbnailsView]
        InspectorPresenter[InspectorPresenter]
    end

    TracksController --> TrackPresenter1[TrackPresenter]
    TracksController --> TrackPresenter2[TrackPresenter]
    TracksController --> TrackPresenterN[TrackPresenter...]

    subgraph Track["Single Track"]
        TrackPresenter1 --> TrackModel[TrackModel]
        TrackPresenter1 --> TrackView[TrackView]
        TrackPresenter1 --> AudioBlob[Audio]
        TrackPresenter1 --> WaveformCtrl[WaveformController]
        TrackPresenter1 --> VolumeCtrl[VolumeController]
        TrackPresenter1 --> PanCtrl[PanController]
        TrackPresenter1 --> CutCtrl[CutZoneController]
    end
```

---

## MVP Pattern

```mermaid
graph LR
    subgraph MVP["Model-View-Presenter"]
        Presenter[Presenter<br/>Logic & Orchestration]
        View[View<br/>DOM & Events]
        Model[Model<br/>State & Data]
    end

    subgraph Services["External"]
        Store[(Store)]
        EventSvc[EventService]
        AudioSvc[Audio Engine]
    end

    Presenter --> View
    Presenter --> Model
    Presenter --> Store
    Presenter --> EventSvc
    Presenter --> AudioSvc

    View -->|User Events| Presenter
    Model -->|State Changes| Presenter

    style Presenter fill:#f9f,stroke:#333
    style View fill:#bbf,stroke:#333
    style Model fill:#bfb,stroke:#333
```

**Responsibilities:**

- **Presenter**: orchestration, business logic, service calls
- **View**: DOM rendering, event binding, lifecycle (mount/destroy)
- **Model**: local component state, actions, notifications

---

## State Management (Flux-like Stores)

```mermaid
graph TB
    subgraph Stores["Singleton Stores"]
        playbackStore["playbackStore<br/>time, duration, playing, speed"]
        timelineStore["timelineStore<br/>tracks, markers, selection"]
        workspaceStore["workspaceStore<br/>videoUrl, config, uuid"]
        uiStore["uiStore<br/>toasts, tasks, toolMode"]
    end

    subgraph Persistence["Persistence"]
        IndexedDB[(IndexedDB)]
    end

    subgraph Components["Subscribers"]
        Player[Player]
        Navigator[Navigator]
        Inspector[Inspector]
        Header[Header]
    end

    timelineStore --> IndexedDB
    workspaceStore --> IndexedDB

    playbackStore -->|subscribe| Player
    playbackStore -->|subscribe| Navigator
    timelineStore -->|subscribe| Navigator
    timelineStore -->|subscribe| Inspector
    uiStore -->|subscribe| Header
```

### Store API

```javascript
// Pattern
const store = createStore(initialState, {
  actions: {
    actionName(state, payload) {
      return {
        /* partial update */
      };
    }
  }
});

// Usage
store.getState(); // Read
store.setState(updates); // Write
store.actions.method(arg); // Action
store.subscribe(callback); // Watch
```

---

## Event Communication

```mermaid
graph TB
    subgraph EventService["EventService (Pub/Sub)"]
        LocalEvents[Local Events]
        SSE[Server-Sent Events]
    end

    subgraph Publishers["Publishers"]
        Library[Library]
        Navigator[Navigator]
        Player[Player]
    end

    subgraph Subscribers["Subscribers"]
        TimelineStore[(timelineStore)]
        PlaybackStore[(playbackStore)]
        Components[Components]
    end

    subgraph Backend["Backend"]
        API[API Server]
    end

    Library -->|emitLocal| LocalEvents
    Navigator -->|emitLocal| LocalEvents
    Player -->|emitLocal| LocalEvents

    LocalEvents -->|on| TimelineStore
    LocalEvents -->|on| PlaybackStore
    LocalEvents -->|on| Components

    API -->|SSE| SSE
    SSE -->|on| Components
    SSE -->|on| TimelineStore
```

### Event Categories

| Category | Events | Purpose |
| -------- | ------ | ------- |
| Playback | `PLAYBACK_PLAY`, `PLAYBACK_PAUSE`, `PLAYBACK_MOVE` | Playback control |
| Timeline | `TIMELINE_ADD_TRACKS`, `MARKERS_CHANGED` | Timeline editing |
| Video | `VIDEO_LOADED`, `VIDEO_DELETED` | Video management |
| System | `CONNECTION`, `THUMBNAILS`, `JOB_COMPLETED` | Backend events |

---

## Playback Time Synchronization

```mermaid
graph TB
    subgraph Sources["Time Sources"]
        Video[Video Element]
        AudioCtx[AudioContext]
    end

    subgraph Clock["Single Source of Truth"]
        MasterClock[MasterClock<br/>time, duration, isPlaying]
    end

    subgraph Loop["Update Loop"]
        PlaybackLoop[PlaybackLoop<br/>requestAnimationFrame]
    end

    subgraph Store["State"]
        playbackStore[(playbackStore)]
    end

    subgraph UI["UI Updates"]
        Player[Player Controls]
        Ruler[Ruler Playhead]
        Tracks[Track Positions]
        Markers[Marker Highlights]
    end

    Video --> MasterClock
    AudioCtx --> MasterClock
    MasterClock --> PlaybackLoop
    PlaybackLoop --> playbackStore

    playbackStore --> Player
    playbackStore --> Ruler
    playbackStore --> Tracks
    playbackStore --> Markers
```

---

## Sequence Diagrams

### Application Initialization

```mermaid
sequenceDiagram
    participant App
    participant ConfigStore
    participant Persist
    participant Connectors as StoreConnectors
    participant Workspace
    participant Mediator
    participant EventService

    App->>ConfigStore: load()
    ConfigStore-->>App: config ready

    App->>Persist: initPersistence()
    Persist->>IndexedDB: rehydrate stores
    IndexedDB-->>Persist: stored state
    Persist-->>App: stores ready

    App->>Connectors: initStoreConnectors()
    Note over Connectors: Wire EventService → Stores

    App->>Workspace: init(uuid)
    Workspace-->>App: session ready

    App->>App: Create components
    Note over App: Library, Video, Player, Navigator

    App->>Api: load(uuid)
    Api-->>App: workspace data

    alt Has Video
        App->>Mediator: onLoadVideo(url)
        Mediator->>Video: load(url)
        Mediator->>Player: init(duration)
        Mediator->>Navigator: init(duration)
    else Audio Only
        App->>Mediator: initAudioOnly()
        Mediator->>Navigator: init(0)
    end

    App->>EventService: connect()
    Note over EventService: Start SSE listening
```

### Track Addition Flow

```mermaid
sequenceDiagram
    participant User
    participant Library
    participant EventService
    participant Navigator
    participant TracksController
    participant TrackPresenter
    participant Audio
    participant timelineStore
    participant IndexedDB

    User->>Library: Drag audio file
    Library->>EventService: emitLocal(TIMELINE_ADD_TRACKS, tracks)

    EventService->>Navigator: on(TIMELINE_ADD_TRACKS)
    Navigator->>TracksController: addTrack(config)

    TracksController->>TrackPresenter: new TrackPresenter(config)
    TrackPresenter->>Audio: new Audio(blob)
    Audio-->>TrackPresenter: audio ready

    TrackPresenter->>TrackPresenter: initControllers()
    Note over TrackPresenter: Waveform, Volume, Pan, Cut

    TracksController-->>Navigator: track added
    Navigator->>Navigator: syncTracksToStore()
    Navigator->>timelineStore: setTracks(tracks)

    timelineStore->>IndexedDB: persist('timeline')
    IndexedDB-->>timelineStore: saved
```

### Playback Control Flow

```mermaid
sequenceDiagram
    participant User
    participant Player
    participant PlaybackController
    participant MasterClock
    participant Video
    participant Audio
    participant PlaybackLoop
    participant playbackStore
    participant Navigator

    User->>Player: Click Play
    Player->>PlaybackController: play()

    PlaybackController->>MasterClock: play()
    MasterClock->>Video: video.play()
    MasterClock->>Audio: audioContext.resume()

    MasterClock->>PlaybackLoop: start()

    loop Every Frame (RAF)
        PlaybackLoop->>MasterClock: getTime()
        MasterClock-->>PlaybackLoop: currentTime
        PlaybackLoop->>playbackStore: setState({ time })
        playbackStore->>Player: notify subscribers
        playbackStore->>Navigator: notify subscribers
        Navigator->>Navigator: updatePlayhead(time)
    end

    User->>Player: Click Pause
    Player->>PlaybackController: pause()
    PlaybackController->>MasterClock: pause()
    MasterClock->>Video: video.pause()
    MasterClock->>PlaybackLoop: stop()
```

### Tool Mode Interaction

```mermaid
sequenceDiagram
    participant User
    participant Toolbar
    participant ToolMode
    participant uiStore
    participant Document
    participant TrackPresenter

    User->>Toolbar: Click Volume Tool
    Toolbar->>ToolMode: setMode('volume')
    ToolMode->>uiStore: setState({ toolMode: 'volume' })

    uiStore->>Document: body.className = 'tool-volume'
    Note over Document: CSS cursor changes

    User->>TrackPresenter: Mouse over track
    TrackPresenter->>ToolMode: isMode('volume')
    ToolMode-->>TrackPresenter: true
    TrackPresenter->>TrackPresenter: showVolumeOverlay()

    User->>TrackPresenter: Click & drag
    TrackPresenter->>VolumeController: handleDrag(position)
    VolumeController->>TrackModel: setVolume(value)
    TrackModel->>TrackView: updateVolumeDisplay()
```

---

## Design Principles

1. **Single Source of Truth**: `MasterClock` for time, stores for state
2. **Immutable Updates**: `setState()` creates new objects, never mutates
3. **Presenter as Orchestrator**: logic lives in presenters, not in views
4. **Event-Driven**: components decoupled via EventService
5. **Offline-First**: IndexedDB for persistence, offline fallback in Api
6. **Tool-First Pattern**: tools operate on any track without prior selection
7. **Canvas for Performance**: waveforms rendered on Canvas, not SVG

For the rationale behind these choices, see the [Architecture Decision Records](docs/adr/).

---

## Styles

```
src/styles/
├── index.css        entry point: the import order IS the cascade order
├── tokens.css       design tokens (the only file allowed to hold raw colors)
├── layout.css       html/body, app shell, focus rings
├── utilities.css    utility classes, responsive tweaks
└── components/      shared controls: button, range, toggles
src/components/**/   each component keeps its stylesheet next to its JS
```

**Tokens have three layers:**

| Layer | Examples | Used by |
| --- | --- | --- |
| Primitives | `--gray-750`, `--iris-500`, `--space-3` | `tokens.css` only |
| Semantic | `--surface-panel`, `--text-subtle`, `--accent-default`, `--fn-volume`, `--playhead` | all components |
| Legacy | `--accent`, `--panel-bg`, `--bs-info` | old rules; mapped onto semantic tokens, removed as components migrate |

**Rules:**

1. **One color, one meaning.** `--accent-*` marks selection, focus, the active mode and the primary action. `--fn-volume`, `--fn-pan`, `--fn-cut` appear only inside their function. `--playhead` is reserved for time. Red (`--danger-*`) shows on hover or confirmation, never at rest.
2. **Three kinds of control**, each with its own look: modes (segmented pill, accent when active), actions (neutral buttons), options (switches or soft-accent toggles).
3. **Selection never changes layout.** Tools for the selected clip dock in `.timeline-dock`.
4. **A rule lives in exactly one file.** No override layers appended at the end.
5. **Debt only goes down.** `npm run lint:css` counts raw colors, `!important` and `backdrop-filter` outside `tokens.css` and fails above `css-budget.json`. It runs in the pre-commit hook and in CI. After a cleanup, lock the gain with `npm run lint:css -- --update`.

---

## Type Safety

The project uses `// @ts-check` + JSDoc for gradual type checking.

```javascript
// @ts-check

/**
 * @typedef {import('@/types').Track} Track
 */

/**
 * @param {Track} track
 * @returns {void}
 */
function processTrack(track) {
  // ...
}
```

**Type-checked files:**

- `store/createStore.js`
- `store/playbackStore.js`
- `lib/MasterClock.js`
- `lib/audio/nodes/Volume.js`

**Run type check:** `npm run typecheck`
