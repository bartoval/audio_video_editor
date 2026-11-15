# Studio

A browser-based video/audio editor (DAW) with multi-track timeline, waveform visualization, and ML-powered audio processing.

## Project Structure

```
studio/            Frontend — Vanilla JS, Vite, MVP pattern
server/            Backend  — Go, being migrated from studio-api (forwards unmigrated routes to it)
studio-api/        Legacy backend — Express.js, FFmpeg, 3-layer architecture
media-ml-worker/   ML Worker — Python, FastAPI, Celery, Whisper, Demucs
deployment/        Docker Compose, Kubernetes (OKE)
```

## Features

- Timeline-based video editing with multi-track audio
- Waveform visualization (Canvas, Web Worker tiling)
- Audio time-stretching (WASM / server fallback)
- Stem separation (vocals, drums, bass, other) via Demucs
- Audio transcription with word-level timestamps via Whisper
- Chunked file upload for large videos
- Hardware-accelerated video encoding (NVIDIA GPU)
- Real-time progress updates via SSE
- Offline-first with IndexedDB persistence

## Quick Start

### Requirements

- Go 1.26+
- Node.js 20+
- FFmpeg, rubberband (optional)
- Docker (for ML worker / RabbitMQ)
- Python 3.10+ (only if running ML worker outside Docker)

### Development (hot reload)

```bash
# Terminal 1 — Go backend (port 8080)
source setup-env.sh
cd server && go run .

# Terminal 1b — legacy Node backend (port 8090), serves the routes not yet in Go
source setup-env.sh
cd studio-api && npm install && PORT=8090 npm run dev

# Terminal 2 — Frontend (port 8081)
cd studio && npm install && npm run dev

# Terminal 3 — ML Worker (optional, for transcription/stems)
docker compose -f docker-compose.local.yml up --build
```

Frontend: <http://localhost:8081> | Backend: <http://localhost:8080> | ML Worker: <http://localhost:8001>

### Production build

```bash
cd studio && npm install && npm run build && cd ..
cd studio-api && npm install && npm start
```

Open <http://localhost:8080>

## Architecture

```
┌──────────┐     ┌──────────────┐     ┌─────────────────┐
│  Studio  │────▶│  Studio API  │────▶│  ML Worker      │
│ (Vite)   │     │  (Express)   │     │  (FastAPI)      │
│ port 8081│     │  port 8080   │     │  port 8001      │
└──────────┘     └──────┬───────┘     └────────┬────────┘
                        │                      │
                        │ SSE, REST             │ Celery tasks
                        ▼                      ▼
                   ┌──────────┐          ┌──────────┐
                   │ File     │          │ RabbitMQ │
                   │ Storage  │          │          │
                   └──────────┘          └──────────┘
```

- **Studio**: SPA with MVP pattern, Flux-like stores, EventService pub/sub
- **Studio API**: REST API + FFmpeg processing, chunked uploads, SSE events
- **ML Worker**: Celery task queue for Whisper transcription and Demucs stem separation

## Configuration

Key environment variables (see component READMEs for full list):

| Variable           | Service    | Default                               | Description                                |
| ------------------ | ---------- | ------------------------------------- | ------------------------------------------ |
| `PORT`             | studio-api | `8080`                                | Server port                                |
| `NODE_ENV`         | studio-api | `development`                         | Environment                                |
| `STORAGE_PROVIDER` | studio-api | `local`                               | `local` or `oracle`                        |
| `HW_ENCODER`       | studio-api | `null`                                | `h264_nvenc` for GPU                       |
| `WHISPER_MODEL`    | ml-worker  | `base`                                | `tiny`, `base`, `small`, `medium`, `large` |
| `RABBITMQ_URL`     | ml-worker  | `amqp://guest:guest@localhost:5672//` | RabbitMQ connection                        |
| `INTERNAL_API_URL` | studio-api | `http://localhost:8080`               | Callback URL for ML worker                 |

## Authentication

Studio is a single-user application and runs without user authentication. All workspaces are available within the same studio instance.

## Deployment

### Docker Compose

```bash
cd deployment/docker
docker-compose -f docker-compose-build.yaml build
docker-compose up
```

### Kubernetes (OKE)

```bash
cd deployment/docker
docker-compose -f docker-compose-build.yaml build
docker-compose -f docker-compose-build.yaml push
kubectl apply -f deployment/k8s/
```

## Testing

```bash
cd studio && npm test             # Unit tests (vitest)
cd studio && npm run test:coverage # Coverage report
cd studio && npm run typecheck    # Type checking (@ts-check + JSDoc)
```

## Documentation

- [studio/ARCHITECTURE.md](studio/ARCHITECTURE.md) — Frontend architecture, patterns, sequence diagrams
- [studio-api/README.md](studio-api/README.md) — Backend API endpoints, configuration, security
- [media-ml-worker/README.md](media-ml-worker/README.md) — ML worker setup, endpoints, performance tests
