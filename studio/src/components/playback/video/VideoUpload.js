import { importVideo } from '../../../services/offline/LocalMedia';
import { getUuid } from '../../../services/workspace';
import ErrorHandler from '../../../services/ErrorHandler';
import { ERROR_CONTEXT } from '../../../config/constants';

export default class VideoUpload {
  #view = null;
  #active = false;
  #onLoadVideo = null;
  #getState = null;
  setView(view) {
    this.#view = view;
  }
  setCallbacks({ onLoadVideo, getState }) {
    this.#onLoadVideo = onLoadVideo;
    this.#getState = getState;
  }
  isActive() {
    return this.#active;
  }
  async handleFileSelect(files) {
    if (!files?.length || this.#active) return;
    const file = files[0];
    this.#active = true;
    this.#view?.showUploadProgress(file.name, file.size);
    try {
      await importVideo(file, getUuid(), this.#getState);
      this.#view?.updateUploadProgress(100, file.name);
      await this.#onLoadVideo?.();
    } catch (error) {
      ErrorHandler.handle(error, ERROR_CONTEXT.UPLOAD_FILE);
    } finally {
      this.#active = false;
      this.#view?.hideUploadProgress();
    }
  }
}
