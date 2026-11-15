# Studio

Browser-based video/audio editor: multi-track timeline, waveforms, time-stretch, stem separation ([steammeros](https://github.com/bartoval/steammeros)) and transcription (Whisper).

Single-user, no authentication: run it locally or behind a protected network, never exposed publicly.

## Layout

```
studio/            Frontend (vanilla JS, Vite)
server/            Go backend, being migrated from studio-api; forwards unmigrated routes to it
studio-api/        Legacy Node backend (Express, FFmpeg)
media-ml-worker/   ML worker (FastAPI, Celery, Whisper, Demucs)
deployment/        Docker Compose, Kubernetes, Oracle VM
```

## Requirements

- [Go](https://go.dev/dl/) 1.26+
- [Node.js](https://nodejs.org/en/download) 20+
- [FFmpeg](https://ffmpeg.org/download.html) built with [librubberband](https://breakfastquay.com/rubberband/) (check: `ffmpeg -filters | grep rubberband`)
- [Docker](https://docs.docker.com/get-started/get-docker/), for the ML worker

## Run locally

```bash
cp "setup-env example.sh" setup-env.sh   # once, then edit the values
source setup-env.sh

cd server && go run .                                       # Go API      :8080
cd studio-api && npm install && PORT=8090 npm run dev       # Node API    :8090
cd studio && npm install && npm run dev                     # Frontend    :8081
docker compose -f docker-compose.local.yml up --build       # ML worker   :8001 (optional)
```

Open <http://localhost:8081>. Run each command in its own terminal.

## Tests

```bash
cd server && go test ./...
cd studio-api && npm test
cd studio && npm test && npm run typecheck
```

## Configuration

| Variable | Used by | Default | Notes |
| --- | --- | --- | --- |
| `PORT` | server, studio-api | `8080` | Use `8090` for studio-api when running with the Go server |
| `LEGACY_API_URL` | server | `http://localhost:8090` | Where unmigrated routes are forwarded |
| `ROOT_PATH` / `DATA_DIR` | server | `../studio-api` / `projects` | Workspace storage, shared with studio-api |
| `STEMS_MODEL` | server | none | [steammeros](https://github.com/bartoval/steammeros) model; empty turns stem separation off. GPU: also `STEMS_CUDA_DEVICE`, `STEMS_CUDA_OPS` |
| `STEMS_ORT_LIBRARY` | server | system | ONNX Runtime shared library |
| `HW_ENCODER` | server | auto | `h264_nvenc` or `libx264`; by default NVENC when the GPU supports it |
| `WHISPER_MODEL` | ml-worker | `base` | `tiny` … `large` |
| `INTERNAL_API_URL` | studio-api | `http://localhost:8080` | Callback URL for the ML worker |

The full list is in `setup-env example.sh`.

## More

- [deployment/README.md](deployment/README.md): Docker, Kubernetes and VM deploy
- [studio/ARCHITECTURE.md](studio/ARCHITECTURE.md): frontend architecture
- [studio-api/README.md](studio-api/README.md): legacy API endpoints
- [media-ml-worker/README.md](media-ml-worker/README.md): ML worker
