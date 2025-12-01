const path = require('path');

// ============================================================================
// TrackList Manager
// Centralizes all trackList.json operations
// ============================================================================

/**
 * Create a trackList manager for a project
 * @param {string} projectPath - Project directory path
 * @param {object} files - Config files object with trackList key
 * @param {object} fileRepo - File repository instance
 */
function createTrackListManager(projectPath, files, fileRepo) {
  const trackListPath = path.join(projectPath, files.trackList);

  function load() {
    return fileRepo.readJson(trackListPath) || { tracks: {} };
  }

  function save(trackList) {
    fileRepo.writeJson(trackListPath, trackList);
  }

  function getTracks() {
    const data = load();

    return data.tracks || {};
  }

  function getTrack(trackId) {
    const tracks = getTracks();

    return tracks[trackId] || null;
  }

  function addTrack(trackId, metadata) {
    const trackList = load();
    trackList.tracks[trackId] = metadata;
    save(trackList);

    return metadata;
  }

  function updateTrack(trackId, metadata) {
    return addTrack(trackId, metadata);
  }

  function removeTrack(trackId) {
    const trackList = load();

    if (trackList.tracks[trackId]) {
      delete trackList.tracks[trackId];
      save(trackList);

      return true;
    }

    return false;
  }

  function hasTrack(trackId) {
    const tracks = getTracks();

    return trackId in tracks;
  }

  return {
    load,
    save,
    getTracks,
    getTrack,
    addTrack,
    updateTrack,
    removeTrack,
    hasTrack
  };
}

module.exports = { createTrackListManager };
