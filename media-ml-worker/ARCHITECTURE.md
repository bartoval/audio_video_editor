# Media ML Worker - Architecture

## Overview

Python microservice for ML-powered media operations: audio transcription (Whisper) and stem separation (Demucs). Built with FastAPI + Celery for async job processing.

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| API Framework | FastAPI | HTTP endpoints, validation, OpenAPI docs |
| Task Queue | Celery | Async job processing |
| Message Broker | RabbitMQ | Job queue backend |
| Transcription | faster-whisper | Speech-to-text (CTranslate2 optimized) |
| Stem Separation | Demucs | Audio source separation |
| Validation | Pydantic | Request/response schemas |

## Request Flow

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  Client  │────▶│  FastAPI     │────▶│  RabbitMQ   │────▶│ Celery       │
│          │     │  (routes)    │     │  (broker)   │     │ Worker       │
└──────────┘     └──────────────┘     └─────────────┘     └──────┬───────┘
     ▲                  │                                        │
     │                  │                                        ▼
     │                  ▼                                 ┌──────────────┐
     │           ┌──────────────┐                         │  Service     │
     │           │  Return      │                         │  (ML model)  │
     │           │  jobId       │                         └──────┬───────┘
     │           └──────────────┘                                │
     │                                                           ▼
     │                                                    ┌──────────────┐
     └────────────────────────────────────────────────────│  Result      │
                         (poll for status)                │  Storage     │
                                                          └──────────────┘
```

### Step by Step

1. **Client** sends POST request (e.g., `/transcribe`)
2. **FastAPI route** validates request with Pydantic
3. **Route** queues a Celery task via `.delay()`
4. **Route** immediately returns `jobId` + `status: pending`
5. **RabbitMQ** holds the job message
6. **Celery worker** picks up the job
7. **Task** calls the appropriate **Service** (Whisper/Demucs)
8. **Service** runs ML model, returns result
9. **Task** saves result and updates job status
10. **Client** polls `GET /transcribe/{jobId}` for status/result

## Component Details

### Configuration (`config.py`)

Uses `pydantic-settings` for type-safe environment configuration:

```python
class Settings(BaseSettings):
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672//"
    whisper_model: str = "base"      # tiny, base, small, medium, large
    whisper_device: str = "cpu"      # cpu, cuda
    media_input_path: str = "/media/input"
    media_output_path: str = "/media/output"
```

Environment variables are automatically mapped (e.g., `WHISPER_MODEL` → `whisper_model`).

### Models (`models/schemas.py`)

Pydantic models for request validation and response serialization:

```python
class TranscribeRequest(BaseModel):
    file_path: str                    # Required
    language: Optional[str] = None    # Optional, auto-detect if omitted
    model: Optional[str] = None       # Whisper model override

class TranscribeResult(BaseModel):
    job_id: str
    status: JobStatus                 # Enum: pending, processing, completed, failed
    text: Optional[str] = None
    segments: Optional[list[dict]] = None
    error: Optional[str] = None
```

### Routes (`routes/*.py`)

FastAPI routers define HTTP endpoints:

```python
@router.post("", response_model=TranscribeResponse)
async def create_transcription(request: TranscribeRequest):
    task = transcribe_task.delay(file_path=request.file_path, ...)
    return TranscribeResponse(job_id=task.id, status=JobStatus.PENDING)

@router.get("/{job_id}", response_model=TranscribeResult)
async def get_transcription(job_id: str):
    task_result = AsyncResult(job_id, app=celery_app)
    # Map Celery state to response...
```

### Services (`services/*.py`)

Singleton wrappers around ML models:

```python
class WhisperService:
    _model = None  # Lazy-loaded, shared across requests

    def transcribe(self, file_path, language=None):
        if self._model is None:
            self._model = WhisperModel(settings.whisper_model, ...)

        segments, info = self._model.transcribe(file_path, language=language)
        return TranscriptionResult(text=..., segments=..., language=info.language)
```

### Tasks (`tasks/*.py`)

Celery tasks for async processing:

```python
@celery_app.task(bind=True, name="transcribe")
def transcribe_task(self, file_path, language=None):
    self.update_state(state="PROCESSING")

    try:
        result = whisper_service.transcribe(file_path, language)
        return {"status": "completed", "text": result.text, ...}
    except Exception as e:
        return {"status": "failed", "error": str(e)}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/transcribe` | Start transcription job |
| GET | `/transcribe/{jobId}` | Get transcription status/result |
| POST | `/stems` | Start stem separation job |
| GET | `/stems/{jobId}` | Get stems status/result |

### Example: Transcribe

**Request:**
```bash
curl -X POST http://localhost:8001/transcribe \
  -H "Content-Type: application/json" \
  -d '{"file_path": "0/project-uuid/resources/audioTracks/audio.mp3"}'
```

**Response (immediate):**
```json
{
  "job_id": "abc123",
  "status": "pending",
  "message": "Transcription job queued"
}
```

**Poll for result:**
```bash
curl http://localhost:8001/transcribe/abc123
```

**Response (completed):**
```json
{
  "job_id": "abc123",
  "status": "completed",
  "text": "Hello world, this is a test.",
  "segments": [
    {"start": 0.0, "end": 2.5, "text": "Hello world"},
    {"start": 2.5, "end": 4.0, "text": "this is a test."}
  ],
  "language": "en",
  "duration": 4.0
}
```

## Job States

```
PENDING ──▶ PROCESSING ──▶ COMPLETED
                │
                └──▶ FAILED
```

| State | Description |
|-------|-------------|
| `pending` | Job queued, waiting for worker |
| `processing` | Worker executing job |
| `completed` | Job finished successfully |
| `failed` | Job failed with error |

## File Storage

The worker operates on a shared `/media` volume (Docker mount) with two main areas:

- **Input** (`/media/projects/`): Mounted from studio-api's project storage. Audio files are read from `0/<uuid>/resources/audioTracks/` or `0/<uuid>/library/`.
- **Output** (`/media/output/`): Each job writes results under `<job-id>/`. Transcription jobs produce a `transcription.json` file. Stem separation jobs produce individual MP3 files per stem (vocals, drums, bass, other) under `htdemucs/<filename>/`.

## Deployment

### Development

```bash
./run-dev.sh          # Start RabbitMQ + API + Celery worker
./run-dev.sh stop     # Stop all
./run-dev.sh logs     # View logs
```

### Production (Docker)

```yaml
services:
  media-ml-worker:
    image: vabar/media-ml-worker:latest
    environment:
      - RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672//
      - WHISPER_MODEL=base
    depends_on:
      - rabbitmq

  celery-worker:
    image: vabar/media-ml-worker:latest
    command: celery -A app.celery_app worker --loglevel=info

  rabbitmq:
    image: rabbitmq:3-management-alpine
```

## Integration with studio-api

studio-api calls media-ml-worker via HTTP:

```
studio-api                    media-ml-worker
    │                               │
    │  POST /transcribe             │
    │ ─────────────────────────────▶│
    │                               │
    │  { jobId: "abc" }             │
    │ ◀─────────────────────────────│
    │                               │
    │  GET /transcribe/abc          │
    │ ─────────────────────────────▶│
    │                               │
    │  { status, text, ... }        │
    │ ◀─────────────────────────────│
```

Configuration in studio-api:
```javascript
// config/index.js
mediaWorker: {
  url: process.env.MEDIA_WORKER_URL || 'http://localhost:8001',
  timeout: 60000
}
```
