#!/bin/bash

# Setup environment variables for the application
# Copy this file: cp "setup-env example.sh" setup-env.sh
# Fill in values, then run: source setup-env.sh

# Studio API - Server
export NODE_ENV=development
export PORT=8080
export STORAGE_PROVIDER=local
export HW_ENCODER=

# Go server - Stem separation: model and runtimes are installed automatically.
export STEMS_DEVICE=auto           # auto (NVIDIA GPU or CPU), cpu, cuda, cuda-fast (mixed), off
# Optional: STEMS_CUDA_DEVICE=0, STEMS_CACHE_DIR=/path/to/cache, STEMS_OFFLINE=true
# Existing installations can still set STEMS_MODEL, STEMS_ORT_LIBRARY and STEMS_CUDA_OPS.

# Studio API - Temp cleanup
export TMP_TTL_MINUTES=30
export TMP_CLEANUP_INTERVAL_MINUTES=60

# ML Worker - Networking
# INTERNAL_API_URL: how the Docker ML worker reaches the host backend
export INTERNAL_API_URL=http://host.docker.internal:8080
export MEDIA_WORKER_URL=http://localhost:8001
export MEDIA_WORKER_TIMEOUT=60000
export SHARED_MEDIA_PATH=/media

# ML Worker - RabbitMQ
export RABBITMQ_URL=amqp://guest:guest@localhost:5672//

# ML Worker - Models
export WHISPER_MODEL=small
export DEMUCS_MODEL=htdemucs
export DEMUCS_JOBS=0

# ML Worker - Device (default: CPU)
# If you have a GPU, uncomment the GPU lines below and comment out the CPU ones
export WHISPER_DEVICE=cpu
export WHISPER_COMPUTE_TYPE=int8
export DEMUCS_DEVICE=cpu
export ML_DOCKERFILE=Dockerfile
export DOCKER_RUNTIME=runc
# export WHISPER_DEVICE=cuda
# export WHISPER_COMPUTE_TYPE=float16
# export DEMUCS_DEVICE=cuda
# export ML_DOCKERFILE=Dockerfile.cuda
# export DOCKER_RUNTIME=nvidia

echo "Environment variables set:"
echo "  WHISPER_MODEL: $WHISPER_MODEL"
echo "  WHISPER_DEVICE: $WHISPER_DEVICE"
echo "  DEMUCS_MODEL: $DEMUCS_MODEL"
echo "  DEMUCS_DEVICE: $DEMUCS_DEVICE"
