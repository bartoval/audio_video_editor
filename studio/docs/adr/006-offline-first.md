# ADR 006 — Offline-first persistence

## Status

Accepted

## Context

Studio runs in the browser and must survive network interruptions without losing user work. A DAW session can contain hours of editing — losing state on a disconnection is unacceptable.

The app needs to:

- Persist timeline, workspace, and audio data locally
- Detect online/offline transitions and adapt UI accordingly
- Queue mutations and sync when connectivity returns
- Serve a degraded but functional experience offline (playback, editing, local export)

## Decision

Use IndexedDB as the primary persistence layer for stores (`timelineStore`, `workspaceStore`) and audio blobs. The `Api` service includes offline fallback: reads serve from IndexedDB when offline, writes queue via `SyncManager` for later sync. Connection state is tracked via `EventService` (`CONNECTION` event) and reflected in the UI.

## Consequences

- User work is never lost on network failure — IndexedDB persists across sessions
- UI adapts automatically: disabled buttons show offline-specific labels (e.g., "Cannot load while offline")
- SyncManager handles conflict resolution on reconnect
- IndexedDB storage limits vary by browser (~50MB minimum, typically much more)
- Audio blobs stored locally can consume significant storage for large projects
