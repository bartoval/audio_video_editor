/**
 * LibraryUpload - handles file selection, drop, and upload
 */
import { AudioUploader } from '../../../services/upload';
import { TIMING, ERROR_CONTEXT } from '../../../config/constants';
import ErrorHandler from '../../../services/ErrorHandler';

export default class LibraryUpload {
  #uploader = null;
  #uploadState = { totalFiles: 0, currentIndex: 0, currentPercent: 0 };
  #view = null;
  #onComplete = null;
  #hideTimer = null;

  constructor() {
    this.#uploader = new AudioUploader({
      onStart: files => this.#handleUploadStart(files),
      onFileStart: (file, index) => this.#handleFileStart(index),
      onFileStage: (file, index, stage) => this.#view?.setUploadItemState(index, stage),
      onFileProgress: (file, index, percent) => this.#handleFileProgress(index, percent),
      onFileComplete: (file, index) => this.#handleFileComplete(index),
      onFileError: (file, index, error) => this.#handleFileError(index, error),
      onComplete: success => this.#handleUploadComplete(success),
      onError: error => ErrorHandler.handle(error, ERROR_CONTEXT.UPLOAD_FILE)
    });
  }

  setView(view) {
    this.#view = view;
  }

  setOnComplete(callback) {
    this.#onComplete = callback;
  }

  handleFileSelect(files, options = {}) {
    if (files.length > 0) {
      this.#uploader.uploadFiles(files, options);
    }
  }

  async handleDrop(dataTransfer) {
    const files = await this.#extractFilesFromDrop(dataTransfer);

    if (files.length > 0) {
      this.#uploader.uploadFiles(files);
    }
  }

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

  #handleUploadStart(files) {
    clearTimeout(this.#hideTimer);
    this.#hideTimer = null;
    this.#uploadState = { totalFiles: files.length, currentIndex: 0, currentPercent: 0 };

    this.#view?.hideUploadList();
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

    this.#view?.setUploadItemState(index, 'reading');
    this.#updateTotalProgress();
  }

  #handleFileProgress(index, percent) {
    this.#uploadState.currentPercent = percent;

    this.#view?.updateUploadItemProgress(index, percent);
    this.#updateTotalProgress();
  }

  #handleFileComplete(index, result = {}) {
    this.#uploadState.currentPercent = 100;

    const isDuplicate = result?.status === 'duplicate';
    this.#view?.setUploadItemState(index, isDuplicate ? 'duplicate' : 'complete');
    if (isDuplicate) {
      this.#view?.setUploadItemWarning?.(index, 'Duplicate - already in library');
    }
    this.#updateTotalProgress();
  }

  #handleFileError(index, error) {
    this.#view?.setUploadItemState(index, 'error');
    ErrorHandler.handle(error, ERROR_CONTEXT.UPLOAD_FILE);
  }

  #handleUploadComplete(successCount) {
    const { totalFiles } = this.#uploadState;

    this.#view?.setUploadComplete(successCount, totalFiles);

    this.#hideTimer = setTimeout(() => {
      this.#view?.hideUploadList();
      this.#hideTimer = null;
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
