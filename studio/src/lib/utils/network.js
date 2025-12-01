/** Network utilities - uses EventService for connection state */
import * as EventService from '../../services/EventService';
import { ROUTES } from '../../config/routes';

export const isOnline = () => EventService.isOnline();

/**
 * Builds proxy URL for external downloads
 * @param {string} url - External URL to proxy
 * @param {string} filename - Filename for download
 * @returns {string}
 */
function buildProxyUrl(url, filename) {
  const params = new URLSearchParams({ url, filename });

  return `${ROUTES.proxyDownload}?${params.toString()}`;
}

/**
 * Fetches audio from URL and returns as File object
 * Uses proxy for external URLs to avoid CORS issues
 * @param {string} url - URL to fetch
 * @param {string} filename - Filename for the File object
 * @param {string} mimeType - MIME type (default: audio/mpeg)
 * @returns {Promise<File>}
 */
export async function fetchAudioAsFile(url, filename, mimeType = 'audio/mpeg') {
  const isExternal = url.startsWith('http://') || url.startsWith('https://');
  const fetchUrl = isExternal ? buildProxyUrl(url, filename) : url;

  const response = await fetch(fetchUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.status}`);
  }

  const blob = await response.blob();

  return new File([blob], filename, { type: mimeType });
}

/**
 * Downloads a file from URL
 * Uses proxy for external URLs to avoid CORS issues
 * @param {string} url - URL to download
 * @param {string} filename - Filename for download
 */
export async function downloadFromUrl(url, filename) {
  const file = await fetchAudioAsFile(url, filename);
  const blobUrl = URL.createObjectURL(file);

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(blobUrl);
}
