import os
from dataclasses import dataclass
from typing import Optional

from faster_whisper import WhisperModel

from app.config import settings


@dataclass
class TranscriptionResult:
    text: str
    segments: list[dict]
    language: str
    duration: float


class WhisperService:
    _instance: Optional["WhisperService"] = None
    _model: Optional[WhisperModel] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)

        return cls._instance

    def _get_model(self, model_size: Optional[str] = None) -> WhisperModel:
        size = model_size or settings.whisper_model

        if self._model is None:
            self._model = WhisperModel(
                size,
                device=settings.whisper_device,
                compute_type=settings.whisper_compute_type,
            )

        return self._model

    def transcribe(
        self,
        file_path: str,
        language: Optional[str] = None,
        model_size: Optional[str] = None,
    ) -> TranscriptionResult:
        full_path = os.path.join(settings.media_input_path, file_path)

        if not os.path.exists(full_path):
            raise FileNotFoundError(f"Audio file not found: {full_path}")

        model = self._get_model(model_size)

        segments_iter, info = model.transcribe(
            full_path,
            language=language,
            beam_size=5,
            vad_filter=False,
            word_timestamps=True,
        )

        segments = []
        full_text_parts = []

        for segment in segments_iter:
            words = []
            if segment.words:
                for word in segment.words:
                    words.append({
                        "start": round(word.start, 3),
                        "end": round(word.end, 3),
                        "word": word.word.strip(),
                        "probability": round(word.probability, 3),
                    })

            segments.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip(),
                "words": words,
            })
            full_text_parts.append(segment.text.strip())

        return TranscriptionResult(
            text=" ".join(full_text_parts),
            segments=segments,
            language=info.language,
            duration=info.duration,
        )


whisper_service = WhisperService()
