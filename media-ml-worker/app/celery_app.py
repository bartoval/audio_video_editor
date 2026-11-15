from celery import Celery

from app.config import settings

celery_app = Celery(
    "media_ml_worker",
    broker=settings.rabbitmq_url,
    backend="rpc://",
    include=["app.tasks.transcribe_task", "app.tasks.stems_task"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=settings.max_duration_sec + 300,
    worker_prefetch_multiplier=1,
)
