import os
import subprocess
from dataclasses import dataclass
from typing import Optional

from app.config import settings


@dataclass
class StemFile:
    name: str
    path: str


@dataclass
class SeparationResult:
    stems: list[StemFile]
    model: str
    duration: float


class DemucsService:
    AVAILABLE_MODELS = ["htdemucs", "htdemucs_ft", "mdx_extra", "mdx_extra_q"]
    STEM_NAMES = ["vocals", "drums", "bass", "other"]

    def separate(
        self,
        file_path: str,
        output_dir: str,
        model: Optional[str] = None,
        two_stems: Optional[str] = None,
    ) -> SeparationResult:
        model = model or settings.demucs_model
        full_path = os.path.join(settings.media_input_path, file_path)

        if not os.path.exists(full_path):
            raise FileNotFoundError(f"Audio file not found: {full_path}")

        if model not in self.AVAILABLE_MODELS:
            raise ValueError(f"Invalid model: {model}. Available: {self.AVAILABLE_MODELS}")

        if two_stems and two_stems not in self.STEM_NAMES:
            raise ValueError(f"Invalid two_stems value: {two_stems}. Available: {self.STEM_NAMES}")

        os.makedirs(output_dir, exist_ok=True)

        cmd = [
            "python", "-m", "demucs",
            "--out", output_dir,
            "--name", model,
            "--mp3",
            "--device", settings.demucs_device,
        ]

        if settings.demucs_jobs != 1:
            cmd.extend(["--jobs", str(settings.demucs_jobs)])

        if two_stems:
            cmd.extend(["--two-stems", two_stems])

        cmd.append(full_path)

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=settings.max_duration_sec + 300,
        )

        if result.returncode != 0:
            raise RuntimeError(f"Demucs failed: {result.stderr}")

        stems = self._collect_stems(output_dir, model, file_path, two_stems)

        duration = self._get_audio_duration(full_path)

        return SeparationResult(
            stems=stems,
            model=model,
            duration=duration,
        )

    def _collect_stems(
        self,
        output_dir: str,
        model: str,
        file_path: str,
        two_stems: Optional[str],
    ) -> list[StemFile]:
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        stems_dir = os.path.join(output_dir, model, base_name)

        stems = []

        if two_stems:
            stem_names = [two_stems, "no_" + two_stems]
        else:
            stem_names = self.STEM_NAMES

        for stem_name in stem_names:
            stem_path = os.path.join(stems_dir, f"{stem_name}.mp3")

            if os.path.exists(stem_path):
                stems.append(StemFile(name=stem_name, path=stem_path))

        return stems

    def _get_audio_duration(self, file_path: str) -> float:
        try:
            result = subprocess.run(
                [
                    "ffprobe", "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    file_path,
                ],
                capture_output=True,
                text=True,
            )

            return float(result.stdout.strip())
        except (ValueError, subprocess.SubprocessError):
            return 0.0


demucs_service = DemucsService()
