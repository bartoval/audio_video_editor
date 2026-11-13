# Deployment

## Structure

```
deployment/
├── docker/          # Build images (multi-arch)
├── oracle-vm/       # Production deploy (ARM64)
└── k8s/             # Kubernetes (local dev)
```

## Services

| Service | Description | Port |
|---------|-------------|------|
| studio-frontend | Vanilla JS SPA (built with Vite, served by nginx) | 80/443 |
| studio-api | Node.js backend | 8080 |
| media-ml-worker | Python ML service (FastAPI) | 8001 |
| celery-worker | Async task worker | - |
| rabbitmq | Message broker | 5672, 15672 |

## Quick Start

### Local (dev)

```bash
# First time: copy setup-env.example.sh to setup-env.sh and fill values
source setup-env.sh

# Backend
cd studio-api && npm install && npm run dev    # :8080

# Frontend
cd studio && npm install && npm run dev        # :8081

# ML Worker (optional, if needed)
cd media-ml-worker
docker compose -f ../deployment/docker/docker-compose.yaml up rabbitmq media-ml-worker celery-worker
```

### Docker (local)

```bash
source setup-env.sh
cd deployment/docker
docker compose -f docker-compose-build.yaml build
docker compose up -d                           # :8080
```

### Oracle VM (production)

```bash
# Build multi-arch images
./deployment/docker/build.sh          # all | api | frontend | proxy | ml-worker

# Deploy
./deployment/oracle-vm/deploy.sh      # all | api | frontend | sync | status | logs
```

**Environment variables on VM:**

```bash
ssh opc@<VM_IP>
source setup-env.sh                       # Copy from setup-env.example.sh, fill values
cd /home/opc/app && docker compose up -d
```

## Architecture

```
nginx (:80/:443)
  ├── /api/*   → studio-api (:8080)
  │                  │
  │                  ├── /api/v1/ml/* → media-ml-worker (:8001)
  │                  │                        │
  │                  │                        └── celery-worker
  │                  │                              │
  │                  │                              └── rabbitmq
  │                  │
  └── /*       → studio-frontend
                     │
               File Storage (local | Oracle)
```

## ML Worker

The `media-ml-worker` provides:
- **Transcription** (Whisper): `POST /api/v1/ml/transcribe`
- **Stem separation** (Demucs): `POST /api/v1/ml/stems`

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MEDIA_WORKER_URL` | `http://media-ml-worker:8000` | ML worker URL |
| `WHISPER_MODEL` | `base` | tiny, base, small, medium, large |
| `WHISPER_DEVICE` | `cpu` | cpu or cuda |
| `RABBITMQ_URL` | `amqp://guest:guest@rabbitmq:5672//` | RabbitMQ connection |

### RabbitMQ Management

Access at http://localhost:15672 (guest/guest)

## Environment

See `setup-env.example.sh` in project root for all required variables. Copy to `setup-env.sh` and fill values.
