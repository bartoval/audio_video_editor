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

  async function load() {
    return (await fileRepo.readJson(trackListPath)) || { tracks: {} };
  }

  async function save(trackList) {
    await fileRepo.writeJson(trackListPath, trackList);
  }

  async function getTracks() {
    const data = await load();

    return data.tracks || {};
  }

  async function getTrack(trackId) {
    const tracks = await getTracks();

    return tracks[trackId] || null;
  }

  async function addTrack(trackId, metadata) {
    const trackList = await load();
    trackList.tracks[trackId] = metadata;
    await save(trackList);

    return metadata;
  }

  async function updateTrack(trackId, metadata) {
    return await addTrack(trackId, metadata);
  }

  async function removeTrack(trackId) {
    const trackList = await load();

    if (trackList.tracks[trackId]) {
      delete trackList.tracks[trackId];
      await save(trackList);

      return true;
    }

    return false;
  }

  async function hasTrack(trackId) {
    const tracks = await getTracks();

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
