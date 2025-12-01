# Video Audio Studio Sync

A browser-based video editor with timeline, audio waveforms, and multi-track support.

## Project Structure

```text
├── studio/          # Frontend (Vite + vanilla JS)
├── studio-api/      # Backend API (Express + FFmpeg)
├── public/          # Built frontend (generated)
├── Dockerfile       # Production build
└── README.md
```

## Requirements

- Node.js 20+
- ffmpeg
- rubberband (for audio time-stretching)

### Install Dependencies

**macOS:**

```bash
brew install ffmpeg rubberband
```

**Fedora:**

```bash
sudo dnf install ffmpeg rubberband
```

## Run Locally

```bash
# Install frontend dependencies
cd studio && npm install && cd ..

# Install backend dependencies
cd studio-api && npm install && cd ..

# Build frontend
cd studio && npm run build && cd ..

# Start server
cd studio-api && npm start
```

Open <http://localhost:8080>

### Development Mode

```bash
# Terminal 1: Backend with auto-reload
cd studio-api && npm run dev

# Terminal 2: Frontend with hot-reload
cd studio && npm run dev
```

Frontend dev server: <http://localhost:8081>

## Run with Docker

```bash
# Build and run
docker build -t studio .
docker run -p 8080:8080 studio
```

Open <http://localhost:8080>
