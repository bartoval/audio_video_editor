const express = require('express');
const handlers = require('../handlers');
const { upload } = require('../middleware');

const router = express.Router();

// ============================================================================
// Health
// ============================================================================

router.get('/v1/health', handlers.health.getHealth);

// ============================================================================
// Config (public)
// ============================================================================

router.get('/v1/config', handlers.config.getConfig);

// ============================================================================
// Workspaces
// ============================================================================

router.get('/v1/workspaces', handlers.project.listProjects);
router.post('/v1/workspaces', handlers.project.createProject);
router.delete('/v1/workspaces/:uuid', handlers.project.deleteProject);
router.get('/v1/workspaces/:uuid/state', handlers.editor.loadProject);
router.put('/v1/workspaces/:uuid/state', handlers.editor.saveProject);
router.get('/v1/workspaces/:uuid/events', handlers.events.subscribe);

// ============================================================================
// Video
// ============================================================================

router.get('/v1/workspaces/:uuid/video', handlers.editor.getVideoMetadata);
router.delete('/v1/workspaces/:uuid/video', handlers.editor.deleteVideo);
router.get('/v1/workspaces/:uuid/video/file', handlers.editor.getVideo);
router.get('/v1/workspaces/:uuid/video/small', handlers.editor.getVideoSmall);
router.post('/v1/workspaces/:uuid/video/file', upload.single('file'), handlers.upload.uploadVideo);
router.options('/v1/workspaces/:uuid/video/file', handlers.upload.uploadOptions);
router.post('/v1/workspaces/:uuid/video/convert', handlers.upload.convertVideo);
router.get('/v1/workspaces/:uuid/video/convert', handlers.upload.isVideoConverted);
router.get('/v1/workspaces/:uuid/video/convert/stream', handlers.upload.conversionStream);
router.post('/v1/workspaces/:uuid/video/scene-detect', handlers.ml.sceneDetectFromVideo);
router.get('/v1/workspaces/:uuid/video/scene-detect/:jobId', handlers.ml.getSceneDetectStatus);

// ============================================================================
// Thumbnails
// ============================================================================

router.get('/v1/workspaces/:uuid/video/thumbnails', handlers.editor.getThumbs);
router.post(
  '/v1/workspaces/:uuid/video/thumbnails/regenerate',
  handlers.upload.regenerateThumbnails
);
// Tiles mode: serve files from scale subdirectories (e.g., /0.01/tile_0.webp, /0.01/manifest.json)
router.get('/v1/workspaces/:uuid/video/thumbnails/:scale/:file', handlers.editor.getThumbTile);
router.get('/v1/workspaces/:uuid/video/thumbnails/:id', handlers.editor.getThumb);

// ============================================================================
// Audio Tracks
// ============================================================================

router.get('/v1/workspaces/:uuid/audio', handlers.editor.getAudioList);
router.post('/v1/workspaces/:uuid/audio', upload.single('file'), handlers.upload.uploadAudio);
router.get('/v1/workspaces/:uuid/audio/:id', handlers.upload.getLibraryAudio);
router.get('/v1/workspaces/:uuid/audio/derived/:id', handlers.upload.getDerivedAudio);
router.delete('/v1/workspaces/:uuid/audio/:id', handlers.upload.deleteAudio);
router.get('/v1/workspaces/:uuid/audio/:id/file', handlers.editor.getAudio);
router.post('/v1/workspaces/:uuid/audio/:id/stretch', handlers.editor.stretchAudio);
router.get('/v1/workspaces/:uuid/audio/:id/stretch', handlers.editor.getStretchStatus);
router.post('/v1/workspaces/:uuid/audio/:id/stems', handlers.ml.stemsFromLibrary);
router.get('/v1/workspaces/:uuid/audio/:id/stems/:jobId', handlers.ml.getStemsStatus);
router.get('/v1/workspaces/:uuid/audio/:id/stems/:jobId/download', handlers.ml.downloadStemsZip);
router.post('/v1/workspaces/:uuid/audio/:id/transcribe', handlers.ml.transcribeFromLibrary);
router.get('/v1/workspaces/:uuid/audio/:id/transcribe/:jobId', handlers.ml.getTranscribeStatus);

// ============================================================================
// Timeline (Project State)
// ============================================================================

router.get('/v1/workspaces/:uuid/timeline', handlers.editor.loadProject);
router.post('/v1/workspaces/:uuid/timeline/:id', handlers.editor.addAudio);
router.delete('/v1/workspaces/:uuid/timeline/:id', handlers.editor.removeAudio);

// ============================================================================
// Exports
// ============================================================================

router.post('/v1/workspaces/:uuid/exports', handlers.editor.exportProject);
router.get('/v1/workspaces/:uuid/exports/out', handlers.editor.getPublished);
router.get('/v1/workspaces/:uuid/exports/audio.:format', handlers.editor.getPublishedAudio);

// ============================================================================
// ML (transcription, stem separation)
// ============================================================================

router.get('/v1/ml/health', handlers.ml.getHealth);
router.post('/v1/ml/transcribe', handlers.ml.transcribe);
router.get('/v1/ml/transcribe/:jobId', handlers.ml.getTranscribeStatus);
router.post('/v1/ml/stems', handlers.ml.stems);
router.get('/v1/ml/stems/:jobId', handlers.ml.getStemsStatus);

// ============================================================================
// Internal (callbacks from ML worker - not exposed publicly)
// ============================================================================

router.post('/v1/internal/jobs/callback', handlers.ml.jobCallback);

module.exports = router;
