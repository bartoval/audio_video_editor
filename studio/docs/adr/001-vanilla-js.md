# ADR 001 — Vanilla JavaScript (no framework)

## Status

Accepted

## Context

Studio is a DAW (Digital Audio Workstation) that manipulates audio in real-time via Web Audio API, renders waveforms on Canvas, and synchronizes video playback with sub-frame precision. Frameworks like React or Vue optimize for UI re-rendering, not for continuous real-time loops driven by `requestAnimationFrame`.

The codebase needs direct control over:

- When and how the DOM updates (no virtual DOM diffing during playback)
- Web Audio API node graphs (created and wired imperatively)
- Canvas drawing (pixel-level waveform rendering at 60fps)
- Memory lifecycle (AudioBuffers, OfflineAudioContext, large blobs)

## Decision

Use vanilla JavaScript with ES modules. Structure the code with the MVP pattern (Model-View-Presenter) to maintain separation of concerns without a framework.

## Consequences

- Full control over rendering timing and memory — no framework scheduler competing with RAF loops
- Zero framework dependencies in production (3 prod deps total)
- Steeper onboarding for contributors used to component frameworks
- MVP discipline must be enforced by convention (CONTRIBUTING.md) rather than by framework constraints
- Bundle size stays minimal (~50KB gzipped for the entire app)
