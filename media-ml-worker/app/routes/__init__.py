from app.routes.scene_detect import router as scene_detect_router
from app.routes.stems import router as stems_router
from app.routes.transcribe import router as transcribe_router

__all__ = ["transcribe_router", "stems_router", "scene_detect_router"]
