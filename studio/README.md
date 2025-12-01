# Studio Frontend

Web-based DAW (Digital Audio Workstation) built with vanilla JavaScript, Vite, and MVP pattern.

## Stack

- **Vite** - Build tool / dev server
- **Vanilla JS** (ES modules) - No framework
- **Bootstrap 5** - UI components
- **Web Audio API** - Audio processing
- **IndexedDB** - Offline persistence

## Quick Start

```bash
npm install
npm run dev    # http://localhost:8081
```

## Development

```bash
npm run dev              # Hot reload dev server
npm test                 # Unit tests (vitest)
npm run test:run         # Single run
npm run test:coverage    # Coverage report
npm run test:integration # Browser integration tests
npm run typecheck        # Type checking (@ts-check + JSDoc)
npm run lint             # ESLint
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier
```

Pre-commit hooks (husky) run lint + format on staged files.

## Project Structure

```text
src/
├── components/        # UI components (MVP pattern)
│   └── timeline/      # Timeline editor, tracks, navigator
├── config/            # Constants, routes, UI selectors
├── lib/               # Core libraries (MasterClock, Audio engine)
├── services/          # Application services (PlaybackController, EventService, etc.)
├── store/             # Flux-like stores (playback, timeline, workspace, ui)
└── types/             # TypeScript definitions (@ts-check + JSDoc)
```

## Key Patterns

- **MVP** — Presenter handles state/logic, View is passive DOM (bind/setState/destroy)
- **Flux stores** — `createStore()` factory, immutable state, subscribe/dispatch
- **EventService** — Pub/sub + SSE auto-reconnect for real-time updates
- **Factory DOM** — `createElement` for dynamic content, no innerHTML for updates

## Further Reading

- [ARCHITECTURE.md](ARCHITECTURE.md) — Diagrams, data flows, design patterns
