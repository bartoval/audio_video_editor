#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKER_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

BASE_URL="${PERF_BASE_URL:-http://localhost:8001}"
REPORT_PATH="${PERF_REPORT_PATH:-${SCRIPT_DIR}/results/latest.json}"
ENABLE_STEMS="${PERF_ENABLE_STEMS:-0}"

echo "[perf] base url: ${BASE_URL}"
echo "[perf] report: ${REPORT_PATH}"
echo "[perf] stems enabled: ${ENABLE_STEMS}"

if ! command -v pytest >/dev/null 2>&1; then
  echo "[perf] pytest non trovato. Installa requirements: pip install -r media-ml-worker/requirements.txt"
  exit 1
fi

cd "${WORKER_DIR}"

PERF_BASE_URL="${BASE_URL}" \
PERF_REPORT_PATH="${REPORT_PATH}" \
PERF_ENABLE_STEMS="${ENABLE_STEMS}" \
pytest -q tests/perf/test_ml_jobs_perf.py

echo "[perf] done. Report scritto in ${REPORT_PATH}"
