import { getVideoUploadUrl, convertVideo, isVideoConverted } from '../../../services/api';
import { getUuid, invalidateCache } from '../../../services/workspace';
import { getDefaultScale } from '../../../services/ConfigStore';
import { ChunkedUploader } from '../../../services/upload';
import { UPLOAD } from '../../../config/ui';
import { TIMING } from '../../../config/constants';

export default class VideoUpload {
  #uploader = null;
  #view = null;
  #isUploading = false;
  #isConverting = false;
  #onVideoDeleted = null;
  #onLoadVideo = null;

  constructor() {
    this.#uploader = new ChunkedUploader(getVideoUploadUrl(), {
      chunkSize: UPLOAD.CHUNK_SIZE,
      parallelUploads: UPLOAD.PARALLEL_UPLOADS
    });
  }

  setView(view) {
    this.#view = view;
  }

  setCallbacks({ onVideoDeleted, onLoadVideo }) {
    this.#onVideoDeleted = onVideoDeleted;
    this.#onLoadVideo = onLoadVideo;
  }

  isActive() {
    return this.#isUploading || this.#isConverting;
  }

  async handleFileSelect(files) {
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];

    if (!file.type.startsWith('video/')) {
      console.error('Please select a video file');
      return;
    }

    const uuid = getUuid();
    if (!uuid) {
      console.error('No project selected');
      return;
    }

    this.#onVideoDeleted?.();

    this.#isUploading = true;
    this.#view?.showUploadProgress(file.name, file.size);

    try {
      await this.#uploader.upload(file, uuid, {
        onProgress: percent => this.#view?.updateUploadProgress(percent, file.name),
        onComplete: () => {
          this.#isUploading = false;
          invalidateCache();
          this.#startConversion();
        },
        onError: err => {
          this.#isUploading = false;
          this.#view?.hideUploadProgress();
          this.#view?.showEmptyState();
          console.error('Upload error:', err.message);
        }
      });
    } catch (err) {
      this.#isUploading = false;
      this.#view?.hideUploadProgress();
      this.#view?.showEmptyState();
      console.error('Upload error:', err.message);
    }
  }

  async #startConversion() {
    this.#isConverting = true;
    this.#view?.showConversionProgress();

    const priorityScale = getDefaultScale();
    await convertVideo(priorityScale);
    this.#pollConversionStatus();
  }

  #pollConversionStatus() {
    const checkStatus = async () => {
      try {
        const data = await isVideoConverted();

        if (data.conversionComplete) {
          this.#isConverting = false;
          this.#view?.hideUploadProgress();
          invalidateCache();
          this.#onLoadVideo?.();
        } else if (data.metadata?.status === 'error') {
          this.#isConverting = false;
          this.#view?.hideUploadProgress();
          this.#view?.showEmptyState();
          console.error('Video conversion failed');
        } else {
          setTimeout(checkStatus, TIMING.RETRY_DELAY);
        }
      } catch (err) {
        console.error('Error checking conversion status:', err);
        setTimeout(checkStatus, TIMING.POLL_INTERVAL);
      }
    };

    checkStatus();
  }
}
