# Studio

Browser-based video/audio editor: multi-track timeline, waveforms, time-stretch, scene detection and stem separation ([steammeros](https://github.com/bartoval/steammeros)).

Single-user, no authentication: run it locally or behind a protected network, never exposed publicly.

## Layout

```
studio/            Frontend (vanilla JS, Vite)
server/            Go backend (FFmpeg, steammeros)
deployment/        Docker Compose, Kubernetes, Oracle VM
```

## Requirements

- [Go](https://go.dev/dl/) 1.26+
- A C++20 compiler (for steammeros via cgo)
- [Node.js](https://nodejs.org/en/download) 20+
- [FFmpeg](https://ffmpeg.org/download.html) built with [librubberband](https://breakfastquay.com/rubberband/) (check: `ffmpeg -filters | grep rubberband`)

## Run locally

```bash
cp "setup-env example.sh" setup-env.sh   # once, then edit the values
source setup-env.sh

cd server && go run .                        # Go API   :8080
cd studio && npm install && npm run dev      # Frontend :8081
```

Open <http://localhost:8081>. Run each command in its own terminal.

The Go server prepares the stem model and runtimes on first start and reuses them
offline afterward. It uses NVIDIA on Linux x86-64 when detected, otherwise CPU;
GPU inference needs a driver supporting CUDA 13. For fast GPU mode (mixed precision),
start the Go server with:

```bash
cd server
STEMS_DEVICE=cuda-fast go run .
```

Set `STEMS_DEVICE=off` to skip stems. No separate steammeros checkout is needed.

## Tests

```bash
cd server && go test ./...
cd studio && npm test && npm run typecheck
```

## Configuration

| Variable | Used by | Default | Notes |
| --- | --- | --- | --- |
| `PORT` | server | `8080` | API port |
| `ROOT_PATH` / `DATA_DIR` | server | `../studio-api` / `projects` | Existing project location is preserved; this directory now contains only data |
| `STEMS_DEVICE` | server | `auto` | `auto`, `cpu`, `cuda`, `cuda-fast` (mixed precision), `off` |
| `STEMS_CACHE_DIR` / `STEMS_OFFLINE` | server | user cache / `false` | Optional cache location; `true` forbids downloads and requires prepared assets |
| `HW_ENCODER` | server | auto | `h264_nvenc` or `libx264`; by default NVENC when the GPU supports it |

The full list is in `setup-env example.sh`.

## More

- [deployment/README.md](deployment/README.md): Docker, Kubernetes and VM deploy
- [studio/ARCHITECTURE.md](studio/ARCHITECTURE.md): frontend architecture
