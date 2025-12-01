import VideoPresenter from './VideoPresenter';

export default class Video extends VideoPresenter {
  constructor($parent) {
    super($parent);
  }
}

export { default as VideoView } from './VideoView';
export { default as VideoPresenter } from './VideoPresenter';
export { default as VideoUpload } from './VideoUpload';
