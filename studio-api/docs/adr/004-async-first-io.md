# ADR 004 — Async-First I/O

## Status

Accepted

## Context

The API runs on a single-threaded Node.js event loop. Synchronous filesystem calls (`existsSync`, `mkdirSync`, `readFileSync`, etc.) block the event loop during disk I/O, stalling all concurrent requests. This is particularly harmful during video conversion and thumbnail generation, where multiple I/O operations happen in rapid succession.

All callers of the sync operations were already in async contexts, so migration to `fs.promises.*` was mechanically straightforward.

## Decision

Use `fs.promises.*` for all filesystem operations. No `*Sync` calls in application code, with two documented exceptions:

1. **`config/index.js`** — Reads `.env` and config at startup, before the event loop serves requests. Sync is acceptable here because it runs once at boot.
2. **`local.js:createWriteStream`** — `fs.mkdirSync` before `fs.createWriteStream`. This function must return a stream synchronously (not a Promise), so the directory creation cannot be async without changing the storage interface contract.

## Consequences

- The event loop is never blocked by filesystem I/O during request handling
- Cloud storage adapters (Oracle, AWS) work correctly since they are async by nature
- `ensureDir` and `exists` in the storage adapter are now `async` — all callers must `await` them
- ChunkRepository uses lazy `init()` for async directory creation instead of sync constructor logic
- Tests mock file operations with `mockResolvedValue` instead of `mockReturnValue`
