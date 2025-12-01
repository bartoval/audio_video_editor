/**
 * LibraryUpload - handles file selection, drop, and upload
 */
import { AudioUploader } from '../../../services/upload';
import { TIMING } from '../../../constants';

export default class LibraryUpload {
  #uploader = null;
  #uploadState = { totalFiles: 0, currentIndex: 0, currentPercent: 0 };

  // View reference for UI updates
  #view = null;

  // Callback when upload completes
  #onComplete = null;

  constructor() {
    this.#uploader = new AudioUploader({
      onStart: files => this.#handleUploadStart(files),
      onFileStart: (file, index) => this.#handleFileStart(index),
      onFileProgress: (file, index, percent) => this.#handleFileProgress(index, percent),
      onFileComplete: (file, index) => this.#handleFileComplete(index),
      onFileError: (file, index, error) => this.#handleFileError(index, error),
      onComplete: success => this.#handleUploadComplete(success),
      onError: msg => console.error('[LibraryUpload] Upload error:', msg)
    });
  }

  // ============================================================================
  // Setup
  // ============================================================================

  setView(view) {
    this.#view = view;
  }

  setOnComplete(callback) {
    this.#onComplete = callback;
  }

  // ============================================================================
  // File Selection
  // ============================================================================

  handleFileSelect(files) {
    if (files.length > 0) {
      this.#uploader.uploadFiles(files);
    }
  }

  async handleDrop(dataTransfer) {
    const files = await this.#extractFilesFromDrop(dataTransfer);

    if (files.length > 0) {
      this.#uploader.uploadFiles(files);
    }
  }

  // ============================================================================
  // File Extraction
  // ============================================================================

  async #extractFilesFromDrop(dataTransfer) {
    const files = [];
    const { items } = dataTransfer;

    if (items) {
      const entries = [];

      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();

        if (entry) {
          entries.push(entry);
        }
      }

      await this.#processEntries(entries, files);
    } else {
      for (let i = 0; i < dataTransfer.files.length; i++) {
        files.push(dataTransfer.files[i]);
      }
    }

    return files;
  }

  async #processEntries(entries, files) {
    for (const entry of entries) {
      if (entry.isFile) {
        const file = await this.#getFile(entry);

        if (this.#isAudioFile(file)) {
          files.push(file);
        }
      } else if (entry.isDirectory) {
        const dirEntries = await this.#readDirectory(entry);

        await this.#processEntries(dirEntries, files);
      }
    }
  }

  #getFile(fileEntry) {
    return new Promise((resolve, reject) => {
      fileEntry.file(resolve, reject);
    });
  }

  #readDirectory(dirEntry) {
    return new Promise((resolve, reject) => {
      const reader = dirEntry.createReader();
      const entries = [];

      const readBatch = () => {
        reader.readEntries(batch => {
          if (batch.length === 0) {
            resolve(entries);
          } else {
            entries.push(...batch);
            readBatch();
          }
        }, reject);
      };

      readBatch();
    });
  }

  #isAudioFile(file) {
    const ext = file.name.split('.').pop()?.toLowerCase();

    return AudioUploader.acceptedExtensions.includes(`.${ext}`);
  }

  // ============================================================================
  // Upload Handlers
  // ============================================================================

  #handleUploadStart(files) {
    this.#uploadState = { totalFiles: files.length, currentIndex: 0, currentPercent: 0 };

    this.#view?.showUploadList();
    this.#view?.createUploadHeader(files.length);

    files.forEach((file, index) => {
      this.#view?.createUploadItem(file, index);
    });

    this.#updateTotalProgress();
  }

  #handleFileStart(index) {
    this.#uploadState.currentIndex = index;
    this.#uploadState.currentPercent = 0;

    this.#view?.setUploadItemState(index, 'uploading');
    this.#updateTotalProgress();
  }

  #handleFileProgress(index, percent) {
    this.#uploadState.currentPercent = percent;

    this.#view?.updateUploadItemProgress(index, percent);
    this.#updateTotalProgress();
  }

  #handleFileComplete(index) {
    this.#uploadState.currentPercent = 100;

    this.#view?.setUploadItemState(index, 'complete');
    this.#updateTotalProgress();
  }

  #handleFileError(index, error) {
    this.#view?.setUploadItemState(index, 'error');
    console.error('[LibraryUpload] File error:', error);
  }

  #handleUploadComplete(successCount) {
    const { totalFiles } = this.#uploadState;

    this.#view?.setUploadComplete(successCount, totalFiles);

    setTimeout(() => {
      this.#view?.hideUploadList();
    }, TIMING.UPLOAD_COMPLETE_DELAY);

    if (successCount > 0) {
      this.#onComplete?.();
    }
  }

  #updateTotalProgress() {
    const { totalFiles, currentIndex, currentPercent } = this.#uploadState;

    this.#view?.updateTotalProgress(currentIndex, currentPercent, totalFiles);
  }
}
