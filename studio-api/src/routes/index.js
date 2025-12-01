const express = require('express');
const handlers = require('../handlers');
const { upload } = require('../middleware');

const router = express.Router();

// ============================================================================
// Workspaces
// ============================================================================

router.get('/v1/workspaces', handlers.project.listProjects);
router.post('/v1/workspaces', handlers.project.createProject);
router.delete('/v1/workspaces/:uuid', handlers.project.deleteProject);
router.get('/v1/workspaces/:uuid/state', handlers.editor.loadProject);
router.put('/v1/workspaces/:uuid/state', handlers.editor.saveProject);

// ============================================================================
// Video
// ============================================================================

router.get('/v1/workspaces/:uuid/video', handlers.editor.getVideoMetadata);
router.delete('/v1/workspaces/:uuid/video', handlers.editor.deleteVideo);
router.get('/v1/workspaces/:uuid/video/file', handlers.editor.getVideo);
router.post('/v1/workspaces/:uuid/video/file', upload.single('file'), handlers.upload.uploadVideo);
router.options('/v1/workspaces/:uuid/video/file', handlers.upload.uploadOptions);
router.post('/v1/workspaces/:uuid/video/convert', handlers.upload.convertVideo);
router.get('/v1/workspaces/:uuid/video/convert', handlers.upload.isVideoConverted);
router.get('/v1/workspaces/:uuid/video/convert/stream', handlers.upload.conversionStream);
router.get('/v1/workspaces/:uuid/video/audio', handlers.upload.getAudio);

// ============================================================================
// Thumbnails
// ============================================================================

router.get('/v1/workspaces/:uuid/video/thumbnails', handlers.editor.getThumbs);
// Tiles mode: serve files from scale subdirectories (e.g., /0.01/tile_0.webp, /0.01/manifest.json)
router.get('/v1/workspaces/:uuid/video/thumbnails/:scale/:file', handlers.editor.getThumbTile);
router.get('/v1/workspaces/:uuid/video/thumbnails/:id', handlers.editor.getThumb);

// ============================================================================
// Audio Tracks
// ============================================================================

router.get('/v1/workspaces/:uuid/audio', handlers.editor.getAudioList);
router.post('/v1/workspaces/:uuid/audio', upload.single('file'), handlers.upload.uploadAudio);
router.get('/v1/workspaces/:uuid/audio/:id', handlers.upload.getLibraryAudio);
router.delete('/v1/workspaces/:uuid/audio/:id', handlers.upload.deleteAudio);
router.get('/v1/workspaces/:uuid/audio/:id/file', handlers.editor.getAudio);
router.post('/v1/workspaces/:uuid/audio/:id/stretch', handlers.editor.stretchAudio);
router.get('/v1/workspaces/:uuid/audio/:id/stretch', handlers.editor.getStretchStatus);

// ============================================================================
// Timeline
// ============================================================================

router.get('/v1/workspaces/:uuid/timeline', handlers.editor.getAudioList);
router.post('/v1/workspaces/:uuid/timeline/:id', handlers.editor.addAudio);
router.delete('/v1/workspaces/:uuid/timeline/:id', handlers.editor.removeAudio);

// ============================================================================
// Exports
// ============================================================================

router.post('/v1/workspaces/:uuid/exports', handlers.editor.exportProject);
router.get('/v1/workspaces/:uuid/exports/:id', handlers.editor.getPublished);

module.exports = router;
