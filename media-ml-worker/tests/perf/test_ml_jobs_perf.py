import os
import time

import httpx
import pytest


def _healthcheck(base_url: str):
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(f"{base_url}/health")
            resp.raise_for_status()
            body = resp.json()
            return body.get("status") == "ok"
    except Exception:
        return False


def _start_job(base_url: str, endpoint: str, payload: dict):
    with httpx.Client(timeout=30.0) as client:
        resp = client.post(f"{base_url}{endpoint}", json=payload)
        resp.raise_for_status()
        data = resp.json()

    return data["job_id"], data


def _poll_job(base_url: str, endpoint: str, job_id: str, timeout_sec: int, poll_interval_sec: float):
    started_at = time.time()
    first_processing_at = None
    final_payload = None

    with httpx.Client(timeout=20.0) as client:
        while True:
            if time.time() - started_at > timeout_sec:
                raise TimeoutError(f"Timeout waiting for job {job_id} ({endpoint})")

            resp = client.get(f"{base_url}{endpoint}/{job_id}")
            resp.raise_for_status()
            payload = resp.json()
            status = payload.get("status")

            if status == "processing" and first_processing_at is None:
                first_processing_at = time.time()

            if status in {"completed", "failed"}:
                final_payload = payload
                break

            time.sleep(poll_interval_sec)

    finished_at = time.time()
    queue_wait_ms = 0.0
    processing_ms = (finished_at - started_at) * 1000

    if first_processing_at is not None:
        queue_wait_ms = (first_processing_at - started_at) * 1000
        processing_ms = (finished_at - first_processing_at) * 1000

    return {
        "job_id": job_id,
        "end_to_end_ms": (finished_at - started_at) * 1000,
        "queue_wait_ms": queue_wait_ms,
        "processing_ms": processing_ms,
        "result": final_payload,
    }


@pytest.fixture(scope="module", autouse=True)
def ensure_worker_up(perf_config):
    if not _healthcheck(perf_config["base_url"]):
        pytest.skip(f"ML worker is not healthy at {perf_config['base_url']}")


def test_transcribe_perf(perf_config, perf_report):
    job_id, _ = _start_job(
        perf_config["base_url"],
        "/transcribe",
        {"file_path": perf_config["transcribe_file_path"]},
    )

    metric = _poll_job(
        perf_config["base_url"],
        "/transcribe",
        job_id,
        timeout_sec=perf_config["transcribe_timeout_sec"],
        poll_interval_sec=perf_config["poll_interval_sec"],
    )

    result = metric["result"]
    assert result["status"] == "completed", result.get("error")
    assert isinstance(result.get("text"), str)
    assert result.get("duration") is not None

    audio_sec = perf_config["transcribe_audio_seconds"]
    metric["audio_seconds"] = audio_sec
    metric["rtf"] = (metric["processing_ms"] / 1000.0) / audio_sec
    perf_report["jobs"]["transcribe"] = metric

    max_rtf_env = os.getenv("PERF_TRANSCRIBE_MAX_RTF")
    if max_rtf_env:
        assert metric["rtf"] <= float(max_rtf_env), metric


def test_stems_perf(perf_config, perf_report):
    if not perf_config["enable_stems"]:
        pytest.skip("Set PERF_ENABLE_STEMS=1 to run stem separation perf test")

    job_id, _ = _start_job(
        perf_config["base_url"],
        "/stems",
        {
            "file_path": perf_config["stems_file_path"],
            "model": perf_config["stems_model"],
        },
    )

    metric = _poll_job(
        perf_config["base_url"],
        "/stems",
        job_id,
        timeout_sec=perf_config["stems_timeout_sec"],
        poll_interval_sec=perf_config["poll_interval_sec"],
    )

    result = metric["result"]
    assert result["status"] == "completed", result.get("error")
    assert isinstance(result.get("stems"), list)
    assert len(result["stems"]) >= 2

    audio_sec = perf_config["stems_audio_seconds"]
    metric["audio_seconds"] = audio_sec
    metric["rtf"] = (metric["processing_ms"] / 1000.0) / audio_sec
    perf_report["jobs"]["stems"] = metric

    max_rtf_env = os.getenv("PERF_STEMS_MAX_RTF")
    if max_rtf_env:
        assert metric["rtf"] <= float(max_rtf_env), metric
