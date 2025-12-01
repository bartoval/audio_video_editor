# Media ML Worker

Python service for ML-powered media operations: audio transcription (Whisper) and stem separation (Demucs).

## Stack

- **FastAPI** - API framework
- **Celery** - Task queue
- **RabbitMQ** - Message broker
- **faster-whisper** - Transcription (CTranslate2 optimized)

## Quick Start

From the project root:

```bash
# From the project root (uses config from setup-env.sh)
docker compose -f docker-compose.local.yml up --build
```

Starts RabbitMQ + ML Worker API (port 8001) + Celery worker.

```bash
docker compose -f docker-compose.local.yml logs -f    # View logs
docker compose -f docker-compose.local.yml ps          # Check status
docker compose -f docker-compose.local.yml down        # Stop all
```

### Manual Setup (without Docker)

```bash
# Start RabbitMQ only
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management

# Install Python dependencies
pip install -r requirements.txt

# Run API
uvicorn app.main:app --reload --port 8001

# In another terminal: run Celery worker
celery -A app.celery_app worker --loglevel=info
```

## Endpoints

### Health Check

```bash
curl http://localhost:8001/health
```

### Transcribe Audio

**Start transcription:**

```bash
curl -X POST http://localhost:8001/transcribe \
  -H "Content-Type: application/json" \
  -d '{"file_path": "audio.mp3", "language": "en"}'
```

Response:

```json
{
  "job_id": "abc123",
  "status": "pending",
  "message": "Transcription job queued"
}
```

**Check status:**

```bash
curl http://localhost:8001/transcribe/{job_id}
```

Response (completed):

```json
{
  "job_id": "abc123",
  "status": "completed",
  "text": "Full transcription text...",
  "segments": [
    {"start": 0.0, "end": 2.5, "text": "Hello world"}
  ],
  "language": "en",
  "duration": 120.5
}
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672//` | RabbitMQ connection (Docker setup overrides host to `rabbitmq`) |
| `MEDIA_INPUT_PATH` | `/media/input` | Input files directory |
| `MEDIA_OUTPUT_PATH` | `/media/output` | Output files directory |
| `WHISPER_MODEL` | `base` | Model: tiny, base, small, medium, large |
| `WHISPER_DEVICE` | `cpu` | Device: cpu, cuda |
| `MAX_FILE_SIZE_MB` | `500` | Max input file size |
| `MAX_DURATION_SEC` | `3600` | Max audio duration |

## SSE Callbacks (Local Development)

When running the ML worker in Docker with Node.js running locally, the Celery worker needs to reach Node.js for job completion callbacks.

**Problem:** `localhost` inside Docker refers to the container, not the host machine.

**Solution:** Use the Docker bridge IP to reach the host:

```bash
# Get Docker bridge IP (usually 172.17.0.1)
ip route | grep docker0

# Export for Node.js before starting
export INTERNAL_API_URL=http://172.17.0.1:8080
npm run dev
```

**In production (Docker Compose):** Use the service name directly:

```yaml
environment:
  - INTERNAL_API_URL=http://studio-api:8080
```

## RabbitMQ Management

Access the management UI at <http://localhost:15672> (guest/guest).

### Consumer Timeout

RabbitMQ has a default consumer timeout of 30 minutes. Demucs stem separation can exceed this on CPU, causing `PreconditionFailed` errors.

**Production:** The docker-compose and k8s deployments include `rabbitmq.conf` with a 2-hour timeout.

**Local development (temporary fix):**

```bash
docker exec rabbitmq rabbitmqctl eval 'application:set_env(rabbit, consumer_timeout, 7200000).'
docker restart celery-worker
```

## API Docs

Swagger UI: <http://localhost:8001/docs>

## Performance Test Automation

End-to-end performance tests are available with `pytest` and produce a JSON report.

### What is measured

- Queue wait time (`queue_wait_ms`)
- Processing time (`processing_ms`)
- End-to-end time (`end_to_end_ms`)
- Real-time factor (`rtf = processing_seconds / audio_seconds`)

### Run

```bash
# 1) Start worker stack (from project root)
docker compose -f docker-compose.local.yml up --build

# 2) Run automated perf tests (transcribe by default)
./scripts/run-perf-tests.sh

# 3) Run also stems benchmark (slower)
PERF_ENABLE_STEMS=1 ./scripts/run-perf-tests.sh
```

### Report output

Default report path:

`media-ml-worker/tests/perf/results/latest.json`

You can override it:

```bash
PERF_REPORT_PATH=/tmp/ml-perf.json ./scripts/run-perf-tests.sh
```

Optional threshold gates (fail test if exceeded):

```bash
PERF_TRANSCRIBE_MAX_RTF=1.0 PERF_ENABLE_STEMS=1 PERF_STEMS_MAX_RTF=8.0 ./scripts/run-perf-tests.sh
```
