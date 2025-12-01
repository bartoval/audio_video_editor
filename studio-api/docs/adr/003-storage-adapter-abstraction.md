# ADR 003 — Storage Adapter Abstraction

## Status

Accepted

## Context

The application stores project data (video files, audio tracks, thumbnails, JSON state) on the filesystem. Deployment targets include local development machines, Docker containers with mounted volumes, and cloud environments with object storage (Oracle OCI, potentially AWS S3, GCP).

Repositories need file operations (read, write, list, stream) without coupling to a specific storage backend.

## Decision

Introduce a Storage layer with a common interface and pluggable adapters:

```
FileRepository -> Storage Singleton -> Adapter (local | oracle | ...)
```

**Common interface** (all async except `createWriteStream`):
`ensureDir`, `exists`, `read`, `write`, `remove`, `removeDir`, `readJson`, `writeJson`, `createReadStream`, `createWriteStream`, `list`, `stat`, `copy`, `getUrl`

**Adapter selection** is driven by the `STORAGE_PROVIDER` environment variable, resolved once at startup via a factory in `storage/index.js`.

FileRepository is a thin pass-through that delegates every call to the storage singleton. Repositories consume FileRepository, never the storage layer directly.

## Consequences

- Adding a new cloud provider requires only a new adapter file implementing the common interface
- All I/O operations are async (except `createWriteStream` which must return a sync stream)
- The Oracle adapter exists and implements the full interface; other cloud adapters can follow the same shape
- Storage provider is a startup-time decision; switching at runtime is not supported
- `STORAGE_PROVIDER=local` is the default and fully tested; cloud adapters need integration testing against real infrastructure
