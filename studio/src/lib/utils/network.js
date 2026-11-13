/** Network utilities - uses EventService for connection state */
import * as EventService from '../../services/EventService';

export const isOnline = () => EventService.isOnline();

/**
 * Downloads a file from URL
 * @param {string} url - URL to download
 * @param {string} filename - Filename for download
 */
export async function downloadFromUrl(url, filename) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status}`);
  }

  const blobUrl = URL.createObjectURL(await response.blob());

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(blobUrl);
}
