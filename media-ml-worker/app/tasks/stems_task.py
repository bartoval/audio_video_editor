import os
import logging
from typing import Optional

import httpx

from app.celery_app import celery_app
from app.config import settings
from app.services.demucs_service import demucs_service

logger = logging.getLogger(__name__)


def send_callback(callback_url: str, job_id: str, result: dict) -> None:
    if not callback_url:
        return

    try:
        payload = {"job_id": job_id, **result}
        response = httpx.post(callback_url, json=payload, timeout=10.0)
        response.raise_for_status()
        logger.info(f"Callback sent successfully to {callback_url}")
    except Exception as exc:
        logger.warning(f"Failed to send callback to {callback_url}: {exc}")


@celery_app.task(bind=True, name="stems")
def stems_task(
    self,
    file_path: str,
    model: str = "htdemucs",
    two_stems: Optional[str] = None,
    callback_url: Optional[str] = None,
) -> dict:
    job_id = self.request.id

    try:
        self.update_state(state="PROCESSING", meta={"progress": 0})

        output_dir = os.path.join(settings.media_output_path, job_id)

        result = demucs_service.separate(
            file_path=file_path,
            output_dir=output_dir,
            model=model,
            two_stems=two_stems,
        )

        result_data = {
            "status": "completed",
            "stems": [{"name": s.name, "path": s.path} for s in result.stems],
            "model": result.model,
            "duration": result.duration,
        }

        send_callback(callback_url, job_id, result_data)

        return result_data

    except FileNotFoundError as exc:
        result_data = {
            "status": "failed",
            "error": str(exc),
        }
        send_callback(callback_url, job_id, result_data)

        return result_data

    except ValueError as exc:
        result_data = {
            "status": "failed",
            "error": str(exc),
        }
        send_callback(callback_url, job_id, result_data)

        return result_data

    except Exception as exc:
        result_data = {
            "status": "failed",
            "error": f"Stem separation failed: {str(exc)}",
        }
        send_callback(callback_url, job_id, result_data)

        return result_data
