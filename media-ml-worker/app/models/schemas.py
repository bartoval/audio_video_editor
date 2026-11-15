from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TranscribeRequest(BaseModel):
    file_path: str = Field(..., description="Path to audio file (relative to media input)")
    language: Optional[str] = Field(None, description="Language code (e.g., 'en', 'it'). Auto-detect if not provided")
    model: Optional[str] = Field(None, description="Whisper model size: tiny, base, small, medium, large")
    callback_url: Optional[str] = Field(None, description="URL to POST when job completes")


class TranscribeResponse(BaseModel):
    job_id: str
    status: JobStatus
    message: str


class TranscribeResult(BaseModel):
    job_id: str
    status: JobStatus
    text: Optional[str] = None
    segments: Optional[list[dict]] = None
    language: Optional[str] = None
    duration: Optional[float] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    version: str = "0.1.0"


class StemsRequest(BaseModel):
    file_path: str = Field(..., description="Path to audio file (relative to media input)")
    model: Optional[str] = Field("htdemucs", description="Demucs model: htdemucs, htdemucs_ft, mdx_extra")
    two_stems: Optional[str] = Field(None, description="Extract only two stems: vocals, drums, bass, or other")
    callback_url: Optional[str] = Field(None, description="URL to POST when job completes")


class StemsResponse(BaseModel):
    job_id: str
    status: JobStatus
    message: str


class StemFile(BaseModel):
    name: str
    path: str


class StemsResult(BaseModel):
    job_id: str
    status: JobStatus
    stems: Optional[list[StemFile]] = None
    model: Optional[str] = None
    duration: Optional[float] = None
    error: Optional[str] = None
