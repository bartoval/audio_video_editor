# Feature: Automatic Scene Detection

## Summary

Detect scene boundaries (cuts and fades) in a project's video file using PySceneDetect and create timeline markers at each transition point. Integrates into the existing ML worker pipeline (Celery + SSE callbacks).

## Motivation

Manual scene identification is tedious. Automatic scene detection lets editors instantly see where cuts happen in their footage, enabling faster navigation and editing decisions. This is especially valuable for long-form content where scrubbing through the entire video is impractical.

---

## Technical Spec

### 1. ML Worker (`media-ml-worker`)

#### 1.1 Schema (`app/models/schemas.py`)

Add these models alongside the existing `TranscribeRequest`/`StemsRequest`:

```python
class SceneDetectRequest(BaseModel):
    file_path: str = Field(..., description="Path to video file")
    threshold: Optional[float] = Field(27.0, description="Content detector threshold (lower = more sensitive)")
    min_scene_len: Optional[float] = Field(0.6, description="Minimum scene length in seconds")
    callback_url: Optional[str] = Field(None, description="URL to POST when job completes")


class Scene(BaseModel):
    time: float = Field(..., description="Scene boundary timestamp in seconds")
    type: str = Field(..., description="Transition type: 'cut' or 'fade'")
    score: float = Field(..., description="Detection confidence score")


class SceneDetectResult(BaseModel):
    job_id: str
    status: JobStatus
    scenes: Optional[list[Scene]] = None
    fps: Optional[float] = None
    duration: Optional[float] = None
    error: Optional[str] = None
```

#### 1.2 Service (`app/services/scene_detect_service.py`)

New file. Singleton pattern like `whisper_service.py`.

```python
from scenedetect import open_video, SceneManager, ContentDetector, ThresholdDetector

class SceneDetectService:
    """Detects scene boundaries in video files using PySceneDetect."""

    def detect(self, file_path, threshold=27.0, min_scene_len_sec=0.6):
        """
        Returns:
            SceneDetectOutput with scenes list, fps, duration
        Raises:
            FileNotFoundError: if file_path doesn't exist
        """
        video = open_video(file_path)
        fps = video.frame_rate
        duration = video.duration.get_seconds()

        scene_manager = SceneManager()
        scene_manager.add_detector(ContentDetector(
            threshold=threshold,
            min_scene_len=int(min_scene_len_sec * fps)
        ))
        scene_manager.detect_scenes(video)

        scene_list = scene_manager.get_scene_list()

        scenes = []
        for idx, (start, end) in enumerate(scene_list):
            if idx > 0:
                scenes.append({
                    "time": start.get_seconds(),
                    "type": "cut",
                    "score": round(threshold, 2)
                })

        return {
            "scenes": scenes,
            "fps": fps,
            "duration": duration
        }
```

**Detection logic**: `ContentDetector` finds hard cuts by comparing frame luminance/color changes. Threshold 27.0 is the PySceneDetect default — lower values catch more subtle transitions.

#### 1.3 Task (`app/tasks/scene_detect_task.py`)

New file. Follow `transcribe_task.py` pattern exactly:

```python
@celery_app.task(bind=True, name="scene_detect")
def scene_detect_task(self, file_path, threshold=27.0, min_scene_len=0.6, callback_url=None):
    job_id = self.request.id

    try:
        self.update_state(state="PROCESSING", meta={"progress": 0})
        result = scene_detect_service.detect(file_path, threshold, min_scene_len)

        result_data = {
            "status": "completed",
            "scenes": result["scenes"],
            "fps": result["fps"],
            "duration": result["duration"]
        }

        send_callback(callback_url, job_id, result_data)
        return result_data

    except Exception as exc:
        result_data = {"status": "failed", "error": str(exc)}
        send_callback(callback_url, job_id, result_data)
        return result_data
```

Use the same `send_callback()` helper from the existing tasks.

#### 1.4 Route (`app/routes/scene_detect.py`)

New file. Follow `routes/transcribe.py` pattern:

- `POST /scene-detect` → queue task, return `{ job_id, status: "pending" }`
- `GET /scene-detect/{job_id}` → poll status via `AsyncResult`

#### 1.5 Register

- Add route to `app/main.py`: `app.include_router(scene_detect_router)`
- Add task to `app/celery_app.py` includes: `"app.tasks.scene_detect_task"`

---

### 2. Backend (`studio-api`)

#### 2.1 Service (`src/services/mediaWorkerService.js`)

Add two methods to the service factory:

```javascript
async function sceneDetect(filePath, options = {}) {
    const { threshold, minSceneLen, callbackUrl } = options;
    const body = { file_path: filePath };
    if (threshold) body.threshold = threshold;
    if (minSceneLen) body.min_scene_len = minSceneLen;
    if (callbackUrl) body.callback_url = callbackUrl;

    const data = await fetchJson(`${baseUrl}/scene-detect`, {
        method: 'POST',
        body: JSON.stringify(body)
    });
    return { jobId: data.job_id, status: data.status, message: data.message };
}

async function getSceneDetectStatus(jobId) {
    const data = await fetchJson(`${baseUrl}/scene-detect/${jobId}`);
    return {
        jobId: data.job_id,
        status: data.status,
        scenes: data.scenes || null,
        fps: data.fps || null,
        duration: data.duration || null,
        error: data.error || null
    };
}
```

Don't forget to add both to the returned object.

#### 2.2 Handler (`src/handlers/ml.js`)

Add handler function:

```javascript
async function sceneDetectFromVideo(req, res, next) {
    try {
        const { uuid } = req.params;
        const { threshold, minSceneLen } = req.body;

        const projectPath = projectRepo.getProjectPath(uuid);
        const hostFilePath = path.join(projectPath, config.paths.files.video);
        const containerFilePath = toContainerPath(hostFilePath);
        const callbackUrl = buildCallbackUrl(uuid, 'video', 'scene-detect');

        const result = await mediaWorkerService.sceneDetect(containerFilePath, {
            threshold,
            minSceneLen,
            callbackUrl
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
}
```

Update `jobCallback` to handle the `scene-detect` type:

```javascript
if (jobType === 'scene-detect') {
    payload.scenes = req.body.scenes || null;
    payload.fps = req.body.fps || null;
    payload.duration = req.body.duration || null;
}
```

Export `sceneDetectFromVideo` and `getSceneDetectStatus` from the module.

#### 2.3 Routes (`src/routes/index.js`)

Add under the Video section:

```javascript
router.post('/v1/workspaces/:uuid/video/scene-detect', handlers.ml.sceneDetectFromVideo);
router.get('/v1/workspaces/:uuid/video/scene-detect/:jobId', handlers.ml.getSceneDetectStatus);
```

---

### 3. Frontend (`studio`)

#### 3.1 Constants (`src/config/constants.js`)

```javascript
// In EVENT:
SCENE_DETECTION_READY: 'sceneDetection:ready',

// In LABEL:
SCENE_DETECTION: 'Detect Scenes',
SCENE_DETECTION_PROCESSING: 'Detecting scenes...',
SCENE_DETECTION_READY: 'Scene Detection Ready',
SCENE_DETECTION_FAILED: 'Scene Detection Failed',
```

#### 3.2 Marker.fromScene (`src/components/timeline/navigator/markers/Marker.js`)

`MarkerList.fromScenes()` already exists at line 179 and calls this method. Implement it:

```javascript
static fromScene(scene) {
    const minutes = Math.floor(scene.time / 60);
    const seconds = Math.floor(scene.time % 60);
    const timeLabel = `${minutes}:${String(seconds).padStart(2, '0')}`;
    const typeLabel = scene.type === 'fade' ? 'Fade' : 'Cut';

    return new Marker({
        time: scene.time,
        label: `Scene ${typeLabel} @${timeLabel}`,
        type: 'scene'
    });
}
```

#### 3.3 JobTrackerService (`src/services/JobTrackerService.js`)

Add handler:

```javascript
const handleSceneDetectionCompleted = (job, data) => {
    uiStore.actions.pushToast({
        type: 'success',
        msg: `${LABEL.SCENE_DETECTION_READY}`,
        timeHide: TOAST_DURATION.long
    });

    EventService.emitLocal(EVENT.SCENE_DETECTION_READY, {
        jobId: job.jobId,
        scenes: data.scenes
    });
};
```

Add to `handleSseJobCompleted` dispatch:

```javascript
} else if (job.type === 'scene-detect') {
    handleSceneDetectionCompleted(job, data);
}
```

#### 3.4 Store Connector (`src/store/storeConnectors.js`)

Add connector that listens for scene detection results and creates markers:

```javascript
function connectSceneDetectionEvents() {
    return EventService.on(EVENT.SCENE_DETECTION_READY, ({ scenes }) => {
        // Emit to Navigator which will use MarkerList.fromScenes()
        EventService.emitLocal(EVENT.MARKERS_CHANGED, { scenes, source: 'scene-detect' });
    });
}
```

Register in `initStoreConnectors()`.

#### 3.5 API call (`src/services/api.js`)

Add function to start scene detection:

```javascript
export async function startSceneDetection(uuid, options = {}) {
    return safeFetch(`${API}/workspaces/${uuid}/video/scene-detect`, {
        method: 'POST',
        body: JSON.stringify(options)
    });
}
```

#### 3.6 UI trigger

Add a "Detect Scenes" button in the video context menu or inspector panel. On click:

1. Call `apiService.startSceneDetection(uuid, { threshold, minSceneLen })`
2. Track job: `JobTrackerService.track(jobId, { type: 'scene-detect', audioId: 'video', filename: 'video' })`
3. Show toast: "Detecting scenes..."

---

## API Contract

### Request

```
POST /api/v1/workspaces/:uuid/video/scene-detect
Content-Type: application/json

{
    "threshold": 27.0,
    "minSceneLen": 0.6
}
```

### Response (immediate)

```json
{
    "jobId": "abc-123",
    "status": "pending",
    "message": "Scene detection job queued"
}
```

### SSE Event (on completion)

```json
{
    "type": "job:completed",
    "payload": {
        "type": "scene-detect",
        "jobId": "abc-123",
        "audioId": "video",
        "status": "completed",
        "scenes": [
            { "time": 5.23, "type": "cut", "score": 32.1 },
            { "time": 12.87, "type": "cut", "score": 45.6 },
            { "time": 28.41, "type": "cut", "score": 29.3 }
        ],
        "fps": 30.0,
        "duration": 120.5
    },
    "timestamp": 1234567890
}
```

---

## Files to Create/Modify

### New files

| Service | File |
|---------|------|
| ML Worker | `app/services/scene_detect_service.py` |
| ML Worker | `app/tasks/scene_detect_task.py` |
| ML Worker | `app/routes/scene_detect.py` |

### Modified files

| Service | File | Changes |
|---------|------|---------|
| ML Worker | `app/models/schemas.py` | Add `SceneDetectRequest`, `Scene`, `SceneDetectResult` |
| ML Worker | `app/main.py` | Register scene-detect router |
| ML Worker | `app/celery_app.py` | Add task to includes |
| ML Worker | `requirements.txt` | Add `scenedetect[opencv]>=0.6` |
| Backend | `src/services/mediaWorkerService.js` | Add `sceneDetect()`, `getSceneDetectStatus()` |
| Backend | `src/handlers/ml.js` | Add `sceneDetectFromVideo()`, extend `jobCallback` |
| Backend | `src/routes/index.js` | Add 2 routes |
| Frontend | `src/config/constants.js` | Add events and labels |
| Frontend | `src/components/timeline/navigator/markers/Marker.js` | Add `static fromScene()` |
| Frontend | `src/services/JobTrackerService.js` | Add `scene-detect` handler |
| Frontend | `src/store/storeConnectors.js` | Add scene detection connector |
| Frontend | `src/services/api.js` | Add `startSceneDetection()` |

---

## Implementation Checklist

- [ ] Add `scenedetect[opencv]>=0.6` to `requirements.txt`
- [ ] Add Pydantic schemas to `app/models/schemas.py`
- [ ] Create `app/services/scene_detect_service.py`
- [ ] Create `app/tasks/scene_detect_task.py`
- [ ] Create `app/routes/scene_detect.py`
- [ ] Register route in `app/main.py`
- [ ] Register task in `app/celery_app.py`
- [ ] Add `sceneDetect()` and `getSceneDetectStatus()` to `mediaWorkerService.js`
- [ ] Add `sceneDetectFromVideo()` handler to `ml.js`
- [ ] Extend `jobCallback` in `ml.js` for `scene-detect` type
- [ ] Add routes to `routes/index.js`
- [ ] Add `EVENT.SCENE_DETECTION_READY` and labels to `constants.js`
- [ ] Implement `Marker.fromScene()` static method
- [ ] Add `scene-detect` handler to `JobTrackerService.js`
- [ ] Add scene detection connector to `storeConnectors.js`
- [ ] Add `startSceneDetection()` to `api.js`
- [ ] Add UI trigger (button in video panel or inspector)
- [ ] Write tests for ML service (mock PySceneDetect)
- [ ] Write tests for backend handler (mock mediaWorkerService)
- [ ] Write tests for `Marker.fromScene()`
- [ ] Test full pipeline end-to-end with a sample video

---

## Testing

**ML Worker**: Mock `scenedetect.open_video` and `SceneManager` to return known scene lists. Verify the service returns correct timestamps and types.

**Backend**: Mock `mediaWorkerService.sceneDetect()` in handler tests. Verify callback dispatches correctly and SSE payload includes `scenes`.

**Frontend**: Test `Marker.fromScene()` creates markers with correct time, label format, and type. Test JobTrackerService dispatches to correct handler.

---

## Dependencies

| Package | Service | Version | GPU Required |
|---------|---------|---------|--------------|
| `scenedetect[opencv]` | ML Worker | `>=0.6` | No |

No additional npm packages needed for backend or frontend.

---

## Labels

`feature`, `ml`, `good first issue`, `scene-detection`
