import logging
import os
from dataclasses import dataclass

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class SceneResult:
    scenes: list[dict]
    fps: float
    duration: float


class SceneDetectService:
    """Detects scene boundaries in video files using PySceneDetect."""

    def detect(
        self,
        file_path: str,
        threshold: float = 27.0,
        min_scene_len_sec: float = 0.6,
    ) -> SceneResult:
        from scenedetect import open_video, SceneManager, ContentDetector

        full_path = os.path.join(settings.media_input_path, file_path)

        if not os.path.exists(full_path):
            raise FileNotFoundError(f"Video file not found: {full_path}")

        logger.info(f"Starting scene detection: {full_path} (threshold={threshold})")

        video = open_video(full_path)
        fps = video.frame_rate
        duration = video.duration.get_seconds()

        min_scene_len_frames = max(1, int(min_scene_len_sec * fps))

        scene_manager = SceneManager()
        scene_manager.add_detector(
            ContentDetector(threshold=threshold, min_scene_len=min_scene_len_frames)
        )
        scene_manager.detect_scenes(video)

        scene_list = scene_manager.get_scene_list()

        scenes = []
        for idx, (start, _end) in enumerate(scene_list):
            if idx == 0:
                continue

            scenes.append({
                "time": round(start.get_seconds(), 3),
                "type": "cut",
                "score": round(threshold, 2),
            })

        logger.info(f"Scene detection complete: {len(scenes)} scenes found in {duration:.1f}s video")

        return SceneResult(
            scenes=scenes,
            fps=fps,
            duration=duration,
        )


scene_detect_service = SceneDetectService()
