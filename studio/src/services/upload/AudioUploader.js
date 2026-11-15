import { importAudio } from '../offline/LocalMedia';
import { getUuid } from '../workspace';
import { UPLOAD } from '../../config/ui';

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

export default class AudioUploader {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.isUploading = false;
    this.aborted = false;
  }

  static get acceptedExtensions() {
    return UPLOAD.AUDIO_EXTENSIONS.join(',');
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

    return UPLOAD.AUDIO_EXTENSIONS.includes(ext);
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
    if (this.isUploading) {
      this.callbacks.onError?.('An import is already in progress. Wait for it to finish.');
      return { success: 0, failed: 0 };
    }

    const files = Array.from(fileList);
    const { validFiles } = this.filterValidFiles(files);

    if (validFiles.length === 0) {
      this.callbacks.onError?.('No valid audio files selected');

      return { success: 0, failed: 0 };
    }

    const uuid = getUuid();

    if (!uuid) {
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
        const result = await importAudio(file, uuid, stage => {
          this.callbacks.onFileStage?.(file, i, stage);
        });
        this.callbacks.onFileProgress?.(file, i, 100);
        this.callbacks.onFileComplete?.(file, i, result);
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
