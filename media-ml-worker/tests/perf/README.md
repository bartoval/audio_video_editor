# Performance Tests

Automated end-to-end performance tests for ML jobs.

## Files

- `conftest.py`: shared fixtures, synthetic audio generation, report writer
- `test_ml_jobs_perf.py`: transcribe/stems performance tests
- `run.sh`: local runner entrypoint
- `results/`: generated JSON reports

## Run

From project root:

```bash
cd media-ml-worker
./tests/perf/run.sh
PERF_ENABLE_STEMS=1 ./tests/perf/run.sh
```

## Main Environment Variables

- `PERF_BASE_URL` (default: `http://localhost:8001`)
- `PERF_ENABLE_STEMS` (`0`/`1`)
- `PERF_REPORT_PATH` (default: `tests/perf/results/latest.json`)
- `PERF_TRANSCRIBE_MAX_RTF`
- `PERF_STEMS_MAX_RTF`
