from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672//"
    media_input_path: str = "/media/input"
    media_output_path: str = "/media/output"

    whisper_model: str = "base"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"

    demucs_model: str = "htdemucs"
    demucs_device: str = "cpu"
    demucs_jobs: int = 0  # 0 = auto (use all cores)

    max_file_size_mb: int = 500
    max_duration_sec: int = 3600

    class Config:
        env_file = ".env"


settings = Settings()
