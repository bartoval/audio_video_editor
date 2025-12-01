# Contributing to Studio API

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full architecture overview (layers, data flows, design patterns).

---

## 3-Layer Rules

| Layer | Role | Imports allowed |
|-------|------|-----------------|
| **Handler** | Parse `req`/`res`, delegate to service, format response | Services only |
| **Service** | Business logic, orchestration | Repositories, other services |
| **Repository** | Data access, external tools (FFmpeg, rubberband) | Storage, `fs`, `child_process` |

Handlers never access the filesystem. Services never touch `req`/`res`.

## Factory DI Pattern

All services and repositories use the `*Creator(deps = {})` pattern:

```javascript
function myServiceCreator(deps = {}) {
  const fileRepo = deps.fileRepo || fileRepositoryCreator();

  async function doSomething() { /* ... */ }

  return { doSomething };
}

module.exports = { myServiceCreator };
```

- Factory returns a plain object (no classes, no `this`)
- Defaults use real implementations via `require()`
- Tests inject mocks: `myServiceCreator({ fileRepo: mockFileRepo })`

---

## Testing

We use **Vitest**. Run tests with:

```bash
npm test              # all tests
npm run test:coverage # with coverage report
```

### Mocking with Factory DI

```javascript
import { describe, it, expect, vi } from 'vitest';

const mockFileRepo = {
  ensureDir: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(true),
  readJson: vi.fn().mockResolvedValue({ data: {} }),
  writeJson: vi.fn().mockResolvedValue(undefined),
  deleteFile: vi.fn().mockResolvedValue(true)
};

const service = myServiceCreator({ fileRepo: mockFileRepo });

describe('myService', () => {
  it('does something', async () => {
    const result = await service.doSomething();
    expect(mockFileRepo.writeJson).toHaveBeenCalled();
  });
});
```

### What to mock

| Dependency | Mock strategy |
|------------|---------------|
| `fileRepo` | `vi.fn().mockResolvedValue(...)` for each method |
| `mediaRepo` | Same — `probeMedia`, `stretchAudio`, etc. |
| `chunkRepo` | Same — `saveChunk`, `allChunksExist`, `assembleChunks` |
| `eventService` | `{ emitThumbnailStatus: vi.fn() }` |
| `execFile` | `vi.fn((cmd, args, cb) => cb(null, '', ''))` |

---

## Adding a New Endpoint

1. **Route** in `src/routes/index.js`
2. **Handler** in `src/handlers/` — parse request, call service, send response
3. **Service** in `src/services/` — business logic, `*Creator(deps = {})` pattern
4. **Repository** if new I/O is needed
5. **Test** with mocked dependencies

---

## Code Style

- **No single-letter params** (`v` -> `value`, `s` -> `stream`, `t` -> `track`)
- **Prefer destructuring**: `const { uuid } = req.params`
- **Async-first**: use `fs.promises.*`, never `*Sync` in application code
- **No comments** unless explaining *why*, not *what*
- **Prefer `const`** over `let` wherever possible

## Linting

ESLint + Prettier run automatically on pre-commit via husky + lint-staged.

```bash
npm run lint          # check
npm run lint:fix      # auto-fix
npm run format        # prettier
```
