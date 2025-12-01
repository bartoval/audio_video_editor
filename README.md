# Video Audio Studio Sync

A browser-based video editor with timeline, audio waveforms, and multi-track support.

## Requirements

- Node.js 20+
- ffmpeg (optional - needed for video thumbnails in timeline)

### Install ffmpeg

**macOS:**

```bash
brew install ffmpeg
```

**Fedora:**

```bash
sudo dnf install ffmpeg
```

## Run Locally

```bash
# Install dependencies
npm install

# Build frontend and start server
npm run build
npm start
```

Open <http://localhost:8080/studio/>

### Development Mode

```bash
# Terminal 1: Backend with auto-reload
npm run dev

# Terminal 2: Frontend with hot-reload
cd studio && npm run dev
```

## Run with Docker

```bash
# Build and start
docker compose up --build

# Or run in background
docker compose up -d --build
```

Open <http://localhost:8080/studio/>

### Stop Docker

```bash
docker compose down
```
