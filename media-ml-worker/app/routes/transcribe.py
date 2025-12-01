from celery.result import AsyncResult
from fastapi import APIRouter, HTTPException

from app.celery_app import celery_app
from app.models import (
    JobStatus,
    TranscribeRequest,
    TranscribeResponse,
    TranscribeResult,
)
from app.tasks.transcribe_task import transcribe_task

router = APIRouter(prefix="/transcribe", tags=["transcribe"])


@router.post("", response_model=TranscribeResponse)
async def create_transcription(request: TranscribeRequest) -> TranscribeResponse:
    task = transcribe_task.delay(
        file_path=request.file_path,
        language=request.language,
        model_size=request.model,
        callback_url=request.callback_url,
    )

    return TranscribeResponse(
        job_id=task.id,
        status=JobStatus.PENDING,
        message="Transcription job queued",
    )


@router.get("/{job_id}", response_model=TranscribeResult)
async def get_transcription(job_id: str) -> TranscribeResult:
    task_result = AsyncResult(job_id, app=celery_app)

    if task_result.state == "PENDING":
        return TranscribeResult(
            job_id=job_id,
            status=JobStatus.PENDING,
        )

    if task_result.state == "PROCESSING":
        return TranscribeResult(
            job_id=job_id,
            status=JobStatus.PROCESSING,
        )

    if task_result.state == "SUCCESS":
        result = task_result.result

        if result.get("status") == "failed":
            return TranscribeResult(
                job_id=job_id,
                status=JobStatus.FAILED,
                error=result.get("error"),
            )

        return TranscribeResult(
            job_id=job_id,
            status=JobStatus.COMPLETED,
            text=result.get("text"),
            segments=result.get("segments"),
            language=result.get("language"),
            duration=result.get("duration"),
        )

    if task_result.state == "FAILURE":
        return TranscribeResult(
            job_id=job_id,
            status=JobStatus.FAILED,
            error=str(task_result.info),
        )

    return TranscribeResult(
        job_id=job_id,
        status=JobStatus.PENDING,
    )
