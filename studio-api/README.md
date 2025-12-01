# Studio API

Video/Audio editor backend API with 3-layer architecture.

## System Requirements

- Node.js >= 20.0.0
- ffmpeg
- rubberband (optional, for audio time-stretching)

### Install system dependencies

**macOS:**

```bash
brew install ffmpeg rubberband
```

**Fedora:**

```bash
sudo dnf install ffmpeg rubberband
```

## Setup

```bash
npm install
```

## Run

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

Server starts at <http://localhost:8080>

## Project Structure

```
studio-api/
├── server.js              # Express app entry point
├── src/
│   ├── config/            # Configuration
│   ├── handlers/          # HTTP request handlers
│   ├── middleware/        # Express middleware
│   ├── repositories/      # Data access layer
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   └── utils/             # Utilities (logger, errors, time)
└── projects/              # Project data storage
```

## API Endpoints (v1)

Base path: `/api/v1`

### Workspaces

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspaces` | List all workspaces |
| POST | `/workspaces` | Create workspace |
| DELETE | `/workspaces/:uuid` | Delete workspace |
| GET | `/workspaces/:uuid/state` | Load workspace state |
| PUT | `/workspaces/:uuid/state` | Save workspace state |

### Video

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspaces/:uuid/video` | Get video metadata |
| DELETE | `/workspaces/:uuid/video` | Delete video |
| GET | `/workspaces/:uuid/video/file` | Stream video for playback |
| POST | `/workspaces/:uuid/video/file` | Upload video (chunked) |
| OPTIONS | `/workspaces/:uuid/video/file` | Upload preflight |
| POST | `/workspaces/:uuid/video/convert` | Start video conversion |
| GET | `/workspaces/:uuid/video/convert` | Check conversion status |
| GET | `/workspaces/:uuid/video/convert/stream` | SSE conversion events |
| GET | `/workspaces/:uuid/video/audio` | Stream main audio track |

### Thumbnails

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspaces/:uuid/video/thumbnails` | Get thumbnail strip |
| GET | `/workspaces/:uuid/video/thumbnails/:id` | Get single thumbnail |

### Audio

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspaces/:uuid/audio` | List audio tracks |
| POST | `/workspaces/:uuid/audio` | Upload audio file |
| GET | `/workspaces/:uuid/audio/:id` | Get audio track info |
| DELETE | `/workspaces/:uuid/audio/:id` | Delete audio track |
| GET | `/workspaces/:uuid/audio/:id/file` | Stream audio file |
| POST | `/workspaces/:uuid/audio/:id/stretch` | Time-stretch audio |
| GET | `/workspaces/:uuid/audio/:id/stretch` | Get stretch status |

### Timeline

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspaces/:uuid/timeline` | Get timeline state |
| POST | `/workspaces/:uuid/timeline/:id` | Add track to timeline |
| DELETE | `/workspaces/:uuid/timeline/:id` | Remove from timeline |

### Exports

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/workspaces/:uuid/exports` | Start export job |
| GET | `/workspaces/:uuid/exports/:id` | Get exported video |
