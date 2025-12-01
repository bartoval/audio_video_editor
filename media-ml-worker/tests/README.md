# Test Suite

This folder contains automated tests for `media-ml-worker`.

## Structure

- `perf/`: end-to-end performance automation for ML jobs (`/transcribe`, `/stems`)

## Notes

- Performance tests are intentionally separated from unit tests because they require:
  - running worker services (API + Celery + RabbitMQ)
  - longer execution time
  - generated artifacts (JSON reports)
