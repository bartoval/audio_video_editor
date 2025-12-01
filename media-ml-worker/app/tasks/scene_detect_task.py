import json
import logging
import os
from typing import Optional

import httpx

from app.celery_app import celery_app
from app.config import settings
from app.services.scene_detect_service import scene_detect_service

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


@celery_app.task(bind=True, name="scene_detect")
def scene_detect_task(
    self,
    file_path: str,
    threshold: float = 27.0,
    min_scene_len: float = 0.6,
    callback_url: Optional[str] = None,
) -> dict:
    job_id = self.request.id

    try:
        self.update_state(state="PROCESSING", meta={"progress": 0})

        result = scene_detect_service.detect(
            file_path=file_path,
            threshold=threshold,
            min_scene_len_sec=min_scene_len,
        )

        output_dir = os.path.join(settings.media_output_path, job_id)
        os.makedirs(output_dir, exist_ok=True)

        output_file = os.path.join(output_dir, "scenes.json")
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump({
                "scenes": result.scenes,
                "fps": result.fps,
                "duration": result.duration,
            }, f, indent=2)

        result_data = {
            "status": "completed",
            "scenes": result.scenes,
            "fps": result.fps,
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

    except Exception as exc:
        result_data = {
            "status": "failed",
            "error": f"Scene detection failed: {str(exc)}",
        }
        send_callback(callback_url, job_id, result_data)

        return result_data
