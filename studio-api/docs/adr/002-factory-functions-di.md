# ADR 002 — Factory Functions with Dependency Injection

## Status

Accepted

## Context

Services and repositories depend on each other (e.g., UploadService needs ChunkRepository, FileRepository, and MediaRepository). For unit testing, we need to replace these dependencies with mocks without resorting to module-level monkey-patching or complex DI containers.

Node.js CommonJS modules are singletons by default, which makes swapping dependencies at test time fragile.

## Decision

Every service and repository is a factory function (named `*Creator`) that accepts an optional `deps` object. Production code calls the factory with no arguments (defaults are used); test code passes mocks.

```javascript
function uploadServiceCreator(deps = {}) {
  const chunkRepo = deps.chunkRepo || chunkRepositoryCreator();
  const fileRepo = deps.fileRepo || fileRepositoryCreator();
  const mediaRepo = deps.mediaRepo || mediaRepositoryCreator();

  async function handleVideoChunk(file, flowParams) { /* ... */ }

  return { handleVideoChunk };
}
```

Key conventions:
- Factory returns a plain object with public methods (no classes, no `this`)
- Defaults use the real implementation via `require()`
- Private helpers are closured, not exported
- Each factory is exported as `{ fooCreator }` from its module

## Consequences

- Tests inject mocks directly: `uploadServiceCreator({ chunkRepo: mockChunkRepo })`
- No DI framework dependency; the pattern is plain JavaScript closures
- Consistent naming (`*Creator`) makes the pattern discoverable
- Factories can be composed: MediaRepository composes ProbeRepository, ThumbnailRepository, ExportRepository, and AudioProcessingRepository
