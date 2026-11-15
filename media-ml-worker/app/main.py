from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models import HealthResponse
from app.routes import stems_router, transcribe_router

app = FastAPI(
    title="Media ML Worker",
    description="ML service for audio transcription and stem separation",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transcribe_router)
app.include_router(stems_router)


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get("/")
async def root():
    return {
        "service": "media-ml-worker",
        "version": "0.1.0",
        "endpoints": [
            "/health",
            "/transcribe",
            "/stems",
            "/docs",
        ],
    }
