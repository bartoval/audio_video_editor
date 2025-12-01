# ADR 003 — @ts-check + JSDoc (no TypeScript migration)

## Status

Accepted

## Context

The codebase is ~51K LOC of vanilla JavaScript. A full TypeScript migration would require renaming every file, configuring build tooling, and converting all imports — a multi-week effort that would block feature work and create a massive PR impossible to review incrementally.

However, type safety on core modules (stores, audio engine, clock) prevents real bugs: wrong argument types to Web Audio API, mismatched store state shapes, incorrect time calculations.

## Decision

Use `// @ts-check` + JSDoc annotations on critical modules only. Types are defined in `src/types/types.d.ts` and imported via the `@/types` alias. Files without `@ts-check` are not validated by `tsc`.

## Consequences

- Gradual adoption — add `@ts-check` to a file when you touch it, no big-bang migration
- Core modules (stores, MasterClock, Audio, PlaybackController) get type safety where it matters most
- Contributors can write plain JS in view/UI files without JSDoc overhead
- `npm run typecheck` validates only opted-in files — fast CI check
- Less ergonomic than native TypeScript (verbose `@typedef` imports, no inline generics)
