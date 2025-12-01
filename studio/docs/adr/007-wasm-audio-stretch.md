# ADR 007 — WASM for audio time-stretching

## Status

Accepted

## Context

Time-stretching (changing audio duration without affecting pitch) is a core DAW feature. The options are:

1. **Server-side FFmpeg** — reliable but requires network round-trip, blocks offline use
2. **JavaScript DSP** — possible but slow for real-time on large files
3. **WASM (Rubber Band)** — near-native performance in the browser, works offline

The `rubberband-wasm` library compiles the industry-standard Rubber Band Library to WebAssembly, providing high-quality pitch-preserving time-stretch.

## Decision

Use `rubberband-wasm` as the primary time-stretch engine, running in a Web Worker to avoid blocking the main thread. Fall back to server-side processing (`ServerProcessor` via FFmpeg) when:

- Audio exceeds the WASM duration limit (`AUDIO.MAX_DURATION_WASM`: 900 seconds)
- The browser doesn't support the required WASM features
- The user is online and server processing is preferred (configurable)

## Consequences

- Time-stretch works fully offline for files under 15 minutes
- Web Worker keeps the UI responsive during processing
- Parallel stretch mode splits audio into chunks across multiple workers with crossfade for faster processing
- ~2MB additional bundle size for the WASM binary
- Server fallback ensures large files are still supported
- Two code paths (WASM + server) must be maintained and tested
