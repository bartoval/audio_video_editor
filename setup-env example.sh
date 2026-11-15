#!/bin/bash
# Optional local configuration: copy to setup-env.sh and source it.

export PORT=8080
export HW_ENCODER=

# Existing projects remain in studio-api/projects when running from server/.
# Override ROOT_PATH to choose another data directory.
# export ROOT_PATH=/path/to/studio-data

# Model and runtimes are prepared once, then reused from the cache.
export STEMS_DEVICE=auto  # auto, cpu, cuda, cuda-fast, off
# export STEMS_OFFLINE=true
# export STEMS_CACHE_DIR=/path/to/stems-cache
# export STEMS_CUDA_DEVICE=0

export TMP_TTL_MINUTES=30
export TMP_CLEANUP_INTERVAL_MINUTES=60
