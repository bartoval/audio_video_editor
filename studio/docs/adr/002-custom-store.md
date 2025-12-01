# ADR 002 — Custom createStore

## Status

Accepted

## Context

The app needs shared state (playback time, timeline tracks, workspace config) accessible by multiple components. Libraries like Redux or Zustand would work but add dependencies and patterns (reducers, middleware, selectors) that are heavier than what we need.

Our state management requirements are simple:

- Read state synchronously (`getState()`)
- Write partial updates (`setState()`)
- Named actions with business logic (`actions.seek(time)`)
- Subscribe/unsubscribe for reactive updates
- No async middleware, no devtools, no selector memoization needed

## Decision

Implement a minimal `createStore` factory (64 LOC) that provides `getState`, `setState`, `subscribe`, and named `actions`. Each action receives current state and returns a partial update (or `undefined` to skip).

## Consequences

- Zero dependencies for state management
- Store API is trivial to learn — one file to read
- Actions co-locate validation with state updates (e.g., `seek` clamps time to duration)
- No devtools integration (debugging via `store.getState()` in console)
- Pattern must be documented for contributors unfamiliar with custom stores
