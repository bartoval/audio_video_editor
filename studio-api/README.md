# Studio API

Backend API for a web-based video/audio editor (DAW). Express.js, FFmpeg, 3-layer architecture.

## Quick Start

**Requirements:** Node.js >= 20, ffmpeg, rubberband (optional, for time-stretch)

```bash
npm install
source ../setup-env.sh     # load environment variables
npm run dev                # http://localhost:8080
```

Environment variables are configured via `setup-env.sh` in the project root. See the file for all available options (port, storage provider, GPU encoder, ML worker URLs, etc.).

## Project Structure

```text
src/
├── config/            # Configuration and constants
├── handlers/          # HTTP request handlers (thin controllers)
├── middleware/        # Express middleware (CORS, errors, uploads)
├── repositories/      # Data access (files, media, chunks)
├── routes/            # API route definitions
├── services/          # Business logic
├── storage/           # Storage adapters (local, oracle)
└── utils/             # Logger, errors, time helpers
```

**Request flow:** Route -> Handler -> Service -> Repository -> Storage Adapter

## Development

```bash
npm run dev            # Hot reload (nodemon)
npm test               # Run tests (vitest)
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
npm run lint           # ESLint
npm run lint:fix       # ESLint auto-fix
npm run format         # Prettier
```

Pre-commit hooks (husky) run lint + format on staged files.

### Testing

Tests use vitest. Dependencies are injected via factory functions:

```javascript
const mockFileRepo = {
  ensureDir: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(true),
  readJson: vi.fn().mockResolvedValue({ metadata: {} })
};

const service = uploadServiceCreator({ fileRepo: mockFileRepo });
```

Tests live in `__tests__/` directories next to the source. Coverage target: 50%.

### Adding a New Endpoint

1. **Route** in `src/routes/index.js`
2. **Handler** in `src/handlers/` — parse request, call service, send response
3. **Service** in `src/services/` — business logic, `*Creator(deps = {})` pattern
4. **Repository** if new I/O is needed
5. **Test** with mocked dependencies

## Key Patterns

- **Factory DI** — All modules export `*Creator(deps = {})`. Tests inject mocks, production uses defaults
- **Async-first I/O** — All file operations use `fs.promises.*`, no sync calls in request path
- **Storage adapters** — Pluggable backends (local filesystem, Oracle OCI). Add new ones in `src/storage/adapters/`
- **MediaRepository facade** — Composes ProbeRepo, ThumbnailRepo, ExportRepo, AudioProcessingRepo behind a flat API

## API Endpoints

Base path: `/api/v1`. Full list in [src/routes/index.js](src/routes/index.js).

| Area | Key Endpoints |
| ---- | ------------- |
| Workspaces | `GET/POST/DELETE /workspaces`, `GET/PUT /workspaces/:uuid/state` |
| Video | `POST .../video/file` (chunked upload), `POST .../video/convert`, `GET .../video/file` (stream) |
| Audio | `POST .../audio` (upload), `POST .../audio/:id/stretch`, `POST .../audio/:id/stems` |
| Thumbnails | `GET .../video/thumbnails/:scale/:file`, `POST .../thumbnails/regenerate` |
| Exports | `POST .../exports`, `GET .../exports/out` |
| ML | `POST /ml/transcribe`, `POST /ml/stems` |
| Events | `GET .../events` (SSE stream) |

## Security

This API currently has **no user authentication**. Before production: add JWT/OAuth, rate limiting, CORS restrictions, HTTPS.

## Further Reading

- [ARCHITECTURE.md](ARCHITECTURE.md) — Diagrams, data flows, design patterns
- [docs/adr/](docs/adr/) — Architecture Decision Records
