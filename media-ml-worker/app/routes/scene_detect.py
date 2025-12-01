from celery.result import AsyncResult
from fastapi import APIRouter

from app.celery_app import celery_app
from app.models import (
    JobStatus,
    SceneDetectRequest,
    SceneDetectResponse,
    SceneDetectResult,
)
from app.tasks.scene_detect_task import scene_detect_task

router = APIRouter(prefix="/scene-detect", tags=["scene-detect"])


@router.post("", response_model=SceneDetectResponse)
async def create_scene_detection(request: SceneDetectRequest) -> SceneDetectResponse:
    task = scene_detect_task.delay(
        file_path=request.file_path,
        threshold=request.threshold,
        min_scene_len=request.min_scene_len,
        callback_url=request.callback_url,
    )

    return SceneDetectResponse(
        job_id=task.id,
        status=JobStatus.PENDING,
        message="Scene detection job queued",
    )


@router.get("/{job_id}", response_model=SceneDetectResult)
async def get_scene_detection(job_id: str) -> SceneDetectResult:
    task_result = AsyncResult(job_id, app=celery_app)

    if task_result.state == "PENDING":
        return SceneDetectResult(
            job_id=job_id,
            status=JobStatus.PENDING,
        )

    if task_result.state == "PROCESSING":
        return SceneDetectResult(
            job_id=job_id,
            status=JobStatus.PROCESSING,
        )

    if task_result.state == "SUCCESS":
        result = task_result.result

        if result.get("status") == "failed":
            return SceneDetectResult(
                job_id=job_id,
                status=JobStatus.FAILED,
                error=result.get("error"),
            )

        return SceneDetectResult(
            job_id=job_id,
            status=JobStatus.COMPLETED,
            scenes=result.get("scenes"),
            fps=result.get("fps"),
            duration=result.get("duration"),
        )

    if task_result.state == "FAILURE":
        return SceneDetectResult(
            job_id=job_id,
            status=JobStatus.FAILED,
            error=str(task_result.info),
        )

    return SceneDetectResult(
        job_id=job_id,
        status=JobStatus.PENDING,
    )
