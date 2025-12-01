import json
import math
import os
import struct
import time
import wave
from pathlib import Path

import pytest


def _write_sine_wav(path: Path, duration_sec: int, sample_rate: int = 16000, freq_hz: float = 440.0):
    path.parent.mkdir(parents=True, exist_ok=True)

    amplitude = 0.3
    total_samples = duration_sec * sample_rate

    with wave.open(str(path), "w") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)  # 16-bit PCM
        wav_file.setframerate(sample_rate)

        frames = bytearray()
        for i in range(total_samples):
            sample = amplitude * math.sin(2 * math.pi * freq_hz * (i / sample_rate))
            frames.extend(struct.pack("<h", int(sample * 32767)))

        wav_file.writeframes(bytes(frames))


@pytest.fixture(scope="session")
def perf_config():
    project_root = Path(__file__).resolve().parents[3]

    base_url = os.getenv("PERF_BASE_URL", "http://localhost:8001").rstrip("/")
    media_host_root = Path(os.getenv("PERF_MEDIA_HOST_ROOT", project_root / "studio-api" / "projects"))
    fixture_dir = Path(os.getenv("PERF_FIXTURE_DIR", media_host_root / "perf-fixtures"))

    transcribe_duration = int(os.getenv("PERF_TRANSCRIBE_AUDIO_SECONDS", "30"))
    stems_duration = int(os.getenv("PERF_STEMS_AUDIO_SECONDS", "20"))

    transcribe_name = f"sine_{transcribe_duration}s.wav"
    stems_name = f"sine_{stems_duration}s.wav"

    transcribe_file = fixture_dir / transcribe_name
    stems_file = fixture_dir / stems_name

    if not transcribe_file.exists():
        _write_sine_wav(transcribe_file, duration_sec=transcribe_duration)

    if not stems_file.exists():
        _write_sine_wav(stems_file, duration_sec=stems_duration)

    report_path = Path(
        os.getenv(
            "PERF_REPORT_PATH",
            Path(__file__).resolve().parent / "results" / "latest.json",
        )
    )

    return {
        "base_url": base_url,
        "transcribe_file_path": f"perf-fixtures/{transcribe_name}",
        "stems_file_path": f"perf-fixtures/{stems_name}",
        "transcribe_audio_seconds": transcribe_duration,
        "stems_audio_seconds": stems_duration,
        "poll_interval_sec": float(os.getenv("PERF_POLL_INTERVAL_SEC", "1.5")),
        "transcribe_timeout_sec": int(os.getenv("PERF_TRANSCRIBE_TIMEOUT_SEC", "900")),
        "stems_timeout_sec": int(os.getenv("PERF_STEMS_TIMEOUT_SEC", "1800")),
        "enable_stems": os.getenv("PERF_ENABLE_STEMS", "0") == "1",
        "stems_model": os.getenv("PERF_STEMS_MODEL", "htdemucs"),
        "report_path": report_path,
    }


@pytest.fixture(scope="session")
def perf_report():
    return {
        "started_at": int(time.time()),
        "jobs": {},
    }


@pytest.fixture(scope="session", autouse=True)
def write_report_on_exit(perf_report, perf_config):
    yield

    report_path = perf_config["report_path"]
    report_path.parent.mkdir(parents=True, exist_ok=True)
    perf_report["finished_at"] = int(time.time())
    report_path.write_text(json.dumps(perf_report, indent=2), encoding="utf-8")
