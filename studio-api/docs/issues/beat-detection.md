# Feature: Automatic Beat Detection

## Summary

Detect beat positions and estimate BPM from an audio file using madmom, then create timeline markers at each beat and update the workspace BPM. Integrates into the existing ML worker pipeline (Celery + SSE callbacks).

## Motivation

Beat detection enables music-synced editing. Editors working with music videos, trailers, or rhythm-based content need to align cuts to beats. Manual beat marking is time-consuming and error-prone. Automatic BPM detection also improves the timeline's snap-to-grid accuracy for musical content.

---

## Technical Spec

### 1. ML Worker (`media-ml-worker`)

#### 1.1 Schema (`app/models/schemas.py`)

Add these models:

```python
class BeatDetectRequest(BaseModel):
    file_path: str = Field(..., description="Path to audio file")
    callback_url: Optional[str] = Field(None, description="URL to POST when job completes")


class Beat(BaseModel):
    time: float = Field(..., description="Beat timestamp in seconds")
    strength: float = Field(..., description="Beat strength (0.0-1.0)")


class BeatDetectResult(BaseModel):
    job_id: str
    status: JobStatus
    beats: Optional[list[Beat]] = None
    bpm: Optional[float] = None
    duration: Optional[float] = None
    error: Optional[str] = None
```

#### 1.2 Service (`app/services/beat_detect_service.py`)

New file. Uses madmom's RNN-based beat tracker for high accuracy:

```python
import numpy as np
import madmom

class BeatDetectService:
    """Detects beats and estimates BPM using madmom's RNN beat tracker."""

    def __init__(self):
        self._processor = None

    def _get_processor(self):
        """Lazy-load the RNN processor (heavy model, load once)."""
        if self._processor is None:
            self._processor = madmom.features.beats.RNNBeatProcessor()
        return self._processor

    def detect(self, file_path):
        """
        Returns:
            dict with beats list, bpm, duration
        Raises:
            FileNotFoundError: if file_path doesn't exist
        """
        processor = self._get_processor()
        activations = processor(file_path)

        beat_tracker = madmom.features.beats.BeatTrackingProcessor(fps=100)
        beat_times = beat_tracker(activations)

        # Calculate BPM from inter-beat intervals
        bpm = None
        if len(beat_times) >= 2:
            intervals = np.diff(beat_times)
            median_interval = np.median(intervals)
            if median_interval > 0:
                bpm = round(60.0 / median_interval, 1)

        # Calculate beat strengths from activations
        beats = []
        for beat_time in beat_times:
            frame_idx = int(beat_time * 100)  # fps=100
            strength = float(activations[min(frame_idx, len(activations) - 1)])
            beats.append({
                "time": round(float(beat_time), 3),
                "strength": round(min(max(strength, 0.0), 1.0), 3)
            })

        # Duration from last beat or audio length
        duration = float(beat_times[-1]) if len(beat_times) > 0 else 0.0

        return {
            "beats": beats,
            "bpm": bpm,
            "duration": duration
        }

beat_detect_service = BeatDetectService()
```

**Why madmom**: RNNBeatProcessor + BeatTrackingProcessor is the state-of-the-art for beat tracking, significantly more accurate than onset-based approaches (librosa). It runs on CPU.

#### 1.3 Task (`app/tasks/beat_detect_task.py`)

New file. Follow `transcribe_task.py` pattern:

```python
@celery_app.task(bind=True, name="beat_detect")
def beat_detect_task(self, file_path, callback_url=None):
    job_id = self.request.id

    try:
        self.update_state(state="PROCESSING", meta={"progress": 0})
        result = beat_detect_service.detect(file_path)

        result_data = {
            "status": "completed",
            "beats": result["beats"],
            "bpm": result["bpm"],
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

#### 1.4 Route (`app/routes/beat_detect.py`)

New file. Follow `routes/transcribe.py` pattern:

- `POST /beat-detect` → queue task, return `{ job_id, status: "pending" }`
- `GET /beat-detect/{job_id}` → poll status via `AsyncResult`

#### 1.5 Register

- Add route to `app/main.py`: `app.include_router(beat_detect_router)`
- Add task to `app/celery_app.py` includes: `"app.tasks.beat_detect_task"`

---

### 2. Backend (`studio-api`)

#### 2.1 Service (`src/services/mediaWorkerService.js`)

Add two methods:

```javascript
async function beatDetect(filePath, options = {}) {
    const { callbackUrl } = options;
    const body = { file_path: filePath };
    if (callbackUrl) body.callback_url = callbackUrl;

    const data = await fetchJson(`${baseUrl}/beat-detect`, {
        method: 'POST',
        body: JSON.stringify(body)
    });
    return { jobId: data.job_id, status: data.status, message: data.message };
}

async function getBeatDetectStatus(jobId) {
    const data = await fetchJson(`${baseUrl}/beat-detect/${jobId}`);
    return {
        jobId: data.job_id,
        status: data.status,
        beats: data.beats || null,
        bpm: data.bpm || null,
        duration: data.duration || null,
        error: data.error || null
    };
}
```

Don't forget to add both to the returned object.

#### 2.2 Handler (`src/handlers/ml.js`)

Add handler function (same pattern as `stemsFromLibrary`):

```javascript
async function beatDetectFromLibrary(req, res, next) {
    try {
        const { uuid, id } = req.params;

        const projectPath = projectRepo.getProjectPath(uuid);
        const hostFilePath = path.join(projectPath, config.paths.dirs.library, id);
        const containerFilePath = toContainerPath(hostFilePath);
        const callbackUrl = buildCallbackUrl(uuid, id, 'beat-detect');

        const result = await mediaWorkerService.beatDetect(containerFilePath, {
            callbackUrl
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
}
```

Update `jobCallback` to handle the `beat-detect` type:

```javascript
if (jobType === 'beat-detect') {
    payload.beats = req.body.beats || null;
    payload.bpm = req.body.bpm || null;
    payload.duration = req.body.duration || null;
}
```

Export `beatDetectFromLibrary` and `getBeatDetectStatus` from the module.

#### 2.3 Routes (`src/routes/index.js`)

Add under the Audio Tracks section (alongside stems/transcribe):

```javascript
router.post('/v1/workspaces/:uuid/audio/:id/beat-detect', handlers.ml.beatDetectFromLibrary);
router.get('/v1/workspaces/:uuid/audio/:id/beat-detect/:jobId', handlers.ml.getBeatDetectStatus);
```

---

### 3. Frontend (`studio`)

#### 3.1 Constants (`src/config/constants.js`)

```javascript
// In EVENT:
BEAT_DETECTION_READY: 'beatDetection:ready',

// In LABEL:
BEAT_DETECTION: 'Detect Beats',
BEAT_DETECTION_PROCESSING: 'Detecting beats...',
BEAT_DETECTION_READY: 'Beat Detection Ready',
BEAT_DETECTION_FAILED: 'Beat Detection Failed',
```

#### 3.2 Marker.fromBeat (`src/components/timeline/navigator/markers/Marker.js`)

Add static factory method:

```javascript
static fromBeat(beat) {
    return new Marker({
        time: beat.time,
        label: 'Beat',
        type: 'beat'
    });
}
```

#### 3.3 MarkerList.fromBeats (`src/components/timeline/navigator/markers/MarkerList.js`)

Add static factory (mirrors existing `fromScenes`):

```javascript
static fromBeats(beats) {
    const list = new MarkerList();

    if (Array.isArray(beats)) {
        for (const beat of beats) {
            list.add(Marker.fromBeat(beat));
        }
    }

    return list;
}
```

#### 3.4 JobTrackerService (`src/services/JobTrackerService.js`)

Add handler:

```javascript
const handleBeatDetectionCompleted = (job, data) => {
    uiStore.actions.pushToast({
        type: 'success',
        msg: `${LABEL.BEAT_DETECTION_READY}: ${job.filename}`,
        timeHide: TOAST_DURATION.long
    });

    EventService.emitLocal(EVENT.BEAT_DETECTION_READY, {
        audioId: job.audioId,
        jobId: job.jobId,
        beats: data.beats,
        bpm: data.bpm
    });
};
```

Add to `handleSseJobCompleted` dispatch:

```javascript
} else if (job.type === 'beat-detect') {
    handleBeatDetectionCompleted(job, data);
}
```

#### 3.5 Store Connector (`src/store/storeConnectors.js`)

Add connector:

```javascript
function connectBeatDetectionEvents() {
    return EventService.on(EVENT.BEAT_DETECTION_READY, ({ beats, bpm }) => {
        // Update workspace BPM
        if (bpm) {
            workspaceStore.actions.updateConfig({ bpm });
        }

        // Emit to Navigator for marker creation
        EventService.emitLocal(EVENT.MARKERS_CHANGED, { beats, source: 'beat-detect' });
    });
}
```

Register in `initStoreConnectors()`.

**Note**: `workspaceStore.actions.updateConfig` may need to be added if it doesn't already exist. Check the workspace store for the appropriate action to update BPM.

#### 3.6 API call (`src/services/api.js`)

```javascript
export async function startBeatDetection(uuid, audioId) {
    return safeFetch(`${API}/workspaces/${uuid}/audio/${audioId}/beat-detect`, {
        method: 'POST'
    });
}
```

#### 3.7 UI trigger

Add a "Detect Beats" option in the audio track context menu (alongside "Transcribe" and "Separate Stems"). On click:

1. Call `apiService.startBeatDetection(uuid, audioId)`
2. Track job: `JobTrackerService.track(jobId, { type: 'beat-detect', audioId, filename })`
3. Show toast: "Detecting beats..."

---

## API Contract

### Request

```
POST /api/v1/workspaces/:uuid/audio/:id/beat-detect
Content-Type: application/json

{}
```

No required body parameters. The audio file is identified by `:id` (library filename).

### Response (immediate)

```json
{
    "jobId": "def-456",
    "status": "pending",
    "message": "Beat detection job queued"
}
```

### SSE Event (on completion)

```json
{
    "type": "job:completed",
    "payload": {
        "type": "beat-detect",
        "jobId": "def-456",
        "audioId": "track.wav",
        "status": "completed",
        "beats": [
            { "time": 0.432, "strength": 0.87 },
            { "time": 0.923, "strength": 0.92 },
            { "time": 1.415, "strength": 0.85 },
            { "time": 1.907, "strength": 0.91 }
        ],
        "bpm": 122.4,
        "duration": 185.3
    },
    "timestamp": 1234567890
}
```

---

## Files to Create/Modify

### New files

| Service | File |
|---------|------|
| ML Worker | `app/services/beat_detect_service.py` |
| ML Worker | `app/tasks/beat_detect_task.py` |
| ML Worker | `app/routes/beat_detect.py` |

### Modified files

| Service | File | Changes |
|---------|------|---------|
| ML Worker | `app/models/schemas.py` | Add `BeatDetectRequest`, `Beat`, `BeatDetectResult` |
| ML Worker | `app/main.py` | Register beat-detect router |
| ML Worker | `app/celery_app.py` | Add task to includes |
| ML Worker | `requirements.txt` | Add `madmom>=0.16` |
| Backend | `src/services/mediaWorkerService.js` | Add `beatDetect()`, `getBeatDetectStatus()` |
| Backend | `src/handlers/ml.js` | Add `beatDetectFromLibrary()`, extend `jobCallback` |
| Backend | `src/routes/index.js` | Add 2 routes |
| Frontend | `src/config/constants.js` | Add events and labels |
| Frontend | `src/components/timeline/navigator/markers/Marker.js` | Add `static fromBeat()` |
| Frontend | `src/components/timeline/navigator/markers/MarkerList.js` | Add `static fromBeats()` |
| Frontend | `src/services/JobTrackerService.js` | Add `beat-detect` handler |
| Frontend | `src/store/storeConnectors.js` | Add beat detection connector |
| Frontend | `src/services/api.js` | Add `startBeatDetection()` |

---

## Implementation Checklist

- [ ] Add `madmom>=0.16` to `requirements.txt`
- [ ] Add Pydantic schemas to `app/models/schemas.py`
- [ ] Create `app/services/beat_detect_service.py`
- [ ] Create `app/tasks/beat_detect_task.py`
- [ ] Create `app/routes/beat_detect.py`
- [ ] Register route in `app/main.py`
- [ ] Register task in `app/celery_app.py`
- [ ] Add `beatDetect()` and `getBeatDetectStatus()` to `mediaWorkerService.js`
- [ ] Add `beatDetectFromLibrary()` handler to `ml.js`
- [ ] Extend `jobCallback` in `ml.js` for `beat-detect` type
- [ ] Add routes to `routes/index.js`
- [ ] Add `EVENT.BEAT_DETECTION_READY` and labels to `constants.js`
- [ ] Implement `Marker.fromBeat()` static method
- [ ] Implement `MarkerList.fromBeats()` static method
- [ ] Add `beat-detect` handler to `JobTrackerService.js`
- [ ] Add beat detection connector to `storeConnectors.js`
- [ ] Add `startBeatDetection()` to `api.js`
- [ ] Add UI trigger in audio track context menu
- [ ] Wire BPM result to workspace config
- [ ] Write tests for ML service (mock madmom processors)
- [ ] Write tests for backend handler (mock mediaWorkerService)
- [ ] Write tests for `Marker.fromBeat()`
- [ ] Test full pipeline end-to-end with a sample audio file

---

## Testing

**ML Worker**: Mock `madmom.features.beats.RNNBeatProcessor` to return known activations. Verify the service computes correct beat times, strengths, and BPM.

**Backend**: Mock `mediaWorkerService.beatDetect()` in handler tests. Verify callback dispatches correctly and SSE payload includes `beats` and `bpm`.

**Frontend**: Test `Marker.fromBeat()` creates markers with correct time and type. Test BPM is written to workspace config on completion. Test JobTrackerService dispatches to correct handler.

---

## Dependencies

| Package | Service | Version | GPU Required |
|---------|---------|---------|--------------|
| `madmom` | ML Worker | `>=0.16` | No |

`numpy` is already a transitive dependency of `torch`. No additional npm packages needed.

**Note**: madmom requires `cython` to build. The Docker image may need `apt-get install -y gcc` if not already present.

---

## Labels

`feature`, `ml`, `good first issue`, `beat-detection`
