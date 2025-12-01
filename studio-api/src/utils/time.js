/**
 * Convert duration in seconds to digital clock format (MM:SS.ms)
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted time string
 */
function formatDuration(seconds) {
  const min = Math.floor(seconds / 60) % 60;
  const sec = Math.floor(seconds) % 60;
  const ms = Math.floor((seconds * 100) % 100);

  const minStr = min < 10 ? '0' + min : String(min);
  const secStr = sec < 10 ? '0' + sec : String(sec);
  const msStr = ms < 10 ? '0' + ms : String(ms);

  return `${minStr}:${secStr}.${msStr}`;
}

module.exports = { formatDuration };
