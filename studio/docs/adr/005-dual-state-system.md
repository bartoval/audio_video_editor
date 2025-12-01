# ADR 005 — Store + EventService (two state systems)

## Status

Accepted

## Context

Components need two different kinds of communication:

1. **Shared state** — values read by multiple components continuously (playback time, track list, workspace config). These need `getState()` + `subscribe()` for reactive updates.
2. **One-shot coordination** — actions that trigger behavior in another component once (add tracks to timeline, video loaded, job completed). These are fire-and-forget signals.

Merging both into stores would force components to poll or watch for transient signals. Merging both into events would lose the ability to read current state synchronously.

## Decision

Use two systems with a clear rule:

- **Store** (`createStore`): if a value is read by more than one component, it belongs in a store
- **EventService** (`on` / `emitLocal`): if it triggers a one-time action in another component, use an event

## Consequences

- Clean separation: stores hold truth, events coordinate actions
- Components can read state anytime without subscribing to events they missed
- EventService also handles SSE (server-sent events) for backend communication — same API for local and remote events
- Contributors must learn both systems and know when to use which (documented in CONTRIBUTING.md)
- Risk of misuse: putting transient state in stores or persistent state in events. The rule above prevents this.
