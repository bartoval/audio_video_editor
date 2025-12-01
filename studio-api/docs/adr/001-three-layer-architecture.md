# ADR 001 — Three-Layer Architecture

## Status

Accepted

## Context

The backend serves a web-based DAW: chunked video uploads, FFmpeg transcoding, audio time-stretching, real-time SSE events, and ML job orchestration. These concerns differ in complexity and lifecycle, so mixing HTTP parsing with business logic or data access would create tightly coupled modules that are hard to test and hard to reason about.

## Decision

Organize the codebase into three explicit layers:

```
HTTP Request
  -> Handler (parse req/res, delegate, format response)
    -> Service (business logic, orchestration)
      -> Repository (data access, external tools)
        -> Storage Adapter (filesystem / cloud)
```

- **Handlers** extract parameters, call services, and return HTTP responses. They never access the filesystem or run FFmpeg.
- **Services** contain business rules: caching logic, job coordination, validation, event emission. They depend on repositories, never on `req`/`res`.
- **Repositories** wrap I/O: filesystem operations (via FileRepository), FFmpeg commands (via MediaRepository), or external HTTP calls. They expose domain-specific methods, not raw I/O primitives.

Each layer only calls the layer directly below it.

## Consequences

- Clear boundaries make unit testing straightforward: mock the layer below
- Adding a new feature follows a predictable pattern: handler + service + repository method
- The storage layer can be swapped (local/cloud) without touching services or handlers
- Requires discipline to avoid shortcuts (e.g., handler calling a repository directly)
