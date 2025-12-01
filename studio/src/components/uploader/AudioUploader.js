import Config from 'Config';
import ChunkedUploader from './ChunkedUploader.js';

const ACCEPTED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/flac',
  'audio/aac',
  'audio/mp4',
  'audio/x-m4a'
];

const ACCEPTED_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'];

export default class AudioUploader {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.uploader = new ChunkedUploader(Config.getApiUrl() + 'uploadAudio', {
      chunkSize: 1024 * 1024,
      parallelUploads: 1
    });
    this.isUploading = false;
    this.aborted = false;
  }

  static get acceptedExtensions() {
    return ACCEPTED_EXTENSIONS.join(',');
  }

  isActive() {
    return this.isUploading;
  }

  abort() {
    this.aborted = true;
  }

  isValidAudioFile(file) {
    if (ACCEPTED_AUDIO_TYPES.includes(file.type)) {
      return true;
    }

    const ext = '.' + file.name.split('.').pop().toLowerCase();

    return ACCEPTED_EXTENSIONS.includes(ext);
  }

  filterValidFiles(files) {
    const validFiles = [];
    const invalidFiles = [];

    for (const file of files) {
      if (this.isValidAudioFile(file)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    }

    if (invalidFiles.length > 0) {
      console.warn('Skipped non-audio files:', invalidFiles);
    }

    return { validFiles, invalidFiles };
  }

  async uploadFiles(fileList) {
    const files = Array.from(fileList);
    const { validFiles } = this.filterValidFiles(files);

    if (validFiles.length === 0) {
      this.callbacks.onError?.('No valid audio files selected');

      return { success: 0, failed: 0 };
    }

    const uuid = Config.getUuid();

    if (!uuid || uuid === '0') {
      this.callbacks.onError?.('No project selected');

      return { success: 0, failed: 0 };
    }

    this.isUploading = true;
    this.aborted = false;

    this.callbacks.onStart?.(validFiles);

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < validFiles.length; i++) {
      if (this.aborted) {
        break;
      }

      const file = validFiles[i];

      this.callbacks.onFileStart?.(file, i);

      try {
        await this.uploader.upload(file, uuid, {
          onProgress: (percent) => this.callbacks.onFileProgress?.(file, i, percent),
          onComplete: () => {},
          onError: (err) => console.error(`Error uploading ${file.name}:`, err)
        });

        this.callbacks.onFileComplete?.(file, i);
        successCount++;
      } catch (err) {
        this.callbacks.onFileError?.(file, i, err.message);
        failedCount++;
      }
    }

    this.isUploading = false;

    this.callbacks.onComplete?.(successCount, failedCount);

    return { success: successCount, failed: failedCount };
  }
}
