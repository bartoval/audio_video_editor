from celery.result import AsyncResult
from fastapi import APIRouter

from app.celery_app import celery_app
from app.models import (
    JobStatus,
    StemFile,
    StemsRequest,
    StemsResponse,
    StemsResult,
)
from app.tasks.stems_task import stems_task

router = APIRouter(prefix="/stems", tags=["stems"])


@router.post("", response_model=StemsResponse)
async def create_stems(request: StemsRequest) -> StemsResponse:
    task = stems_task.delay(
        file_path=request.file_path,
        model=request.model,
        two_stems=request.two_stems,
        callback_url=request.callback_url,
    )

    return StemsResponse(
        job_id=task.id,
        status=JobStatus.PENDING,
        message="Stem separation job queued",
    )


@router.get("/{job_id}", response_model=StemsResult)
async def get_stems(job_id: str) -> StemsResult:
    task_result = AsyncResult(job_id, app=celery_app)

    if task_result.state == "PENDING":
        return StemsResult(
            job_id=job_id,
            status=JobStatus.PENDING,
        )

    if task_result.state == "PROCESSING":
        return StemsResult(
            job_id=job_id,
            status=JobStatus.PROCESSING,
        )

    if task_result.state == "SUCCESS":
        result = task_result.result

        if result.get("status") == "failed":
            return StemsResult(
                job_id=job_id,
                status=JobStatus.FAILED,
                error=result.get("error"),
            )

        stems_data = result.get("stems", [])
        stems = [StemFile(name=s["name"], path=s["path"]) for s in stems_data]

        return StemsResult(
            job_id=job_id,
            status=JobStatus.COMPLETED,
            stems=stems,
            model=result.get("model"),
            duration=result.get("duration"),
        )

    if task_result.state == "FAILURE":
        return StemsResult(
            job_id=job_id,
            status=JobStatus.FAILED,
            error=str(task_result.info),
        )

    return StemsResult(
        job_id=job_id,
        status=JobStatus.PENDING,
    )
