import { View, getPosXFromTime, getTimeFromPosX } from '../../../../lib';
import { getUuid } from '../../../../services/workspace';
import IndexedDB from '../../../../services/offline/IndexedDB';
import * as LocalMedia from '../../../../services/offline/LocalMedia';

// Decode only visible frames from the local file, keeping a bounded canvas cache.
export default class LocalThumbsView extends View {
  #container;
  #video = document.createElement('video');
  #url = null;
  #duration = 0;
  #posX = 0;
  #generation = 0;
  #frames = new Map();
  #rendering = false;
  #pending = false;
  #resize = new ResizeObserver(() => this.#schedule());

  constructor(parent) {
    super(parent);
    this.mount();
    this.#resize.observe(parent);
  }
  render() {
    this.#container = document.createElement('div');
    this.#container.className = 'thumbs thumbs-tiled';
    this.#container.dataset.testid = 'thumbs-container';
    this.$node = document.createElement('ul');
    this.$node.className = 'list-unstyled';
    this.#container.appendChild(this.$node);
    this.$parent.appendChild(this.#container);
    this.#video.muted = true;
    this.#video.preload = 'auto';
  }
  async init(duration) {
    const generation = ++this.#generation;
    this.#duration = duration;
    this.#frames.clear();
    this.$node.replaceChildren();
    this.#video.removeAttribute('src');
    this.#video.load();
    if (this.#url) URL.revokeObjectURL(this.#url);
    this.#url = null;
    const uuid = getUuid();
    const project = await IndexedDB.getWorkspace(uuid);
    const id = project?.videoInfo?.localMediaId;
    if (!project?.video || !id) return true;
    const record = await LocalMedia.get(uuid, id);
    if (generation !== this.#generation || !record?.blob) return true;
    this.#url = URL.createObjectURL(record.blob);
    this.#video.src = this.#url;
    try {
      await this.#wait('loadeddata');
      if (generation === this.#generation) this.#schedule();
    } catch {
      /* Main video player reports unsupported media. */
    }
    return true;
  }
  reload() {
    return this.init(this.#duration);
  }
  setLoading(loading) {
    if (loading) {
      this.#generation++;
      this.#pending = false;
      this.#video.removeAttribute('src');
      this.#video.load();
      if (this.#url) URL.revokeObjectURL(this.#url);
      this.#url = null;
      this.#frames.clear();
      this.$node.replaceChildren();
    }
  }
  onProgress() {}
  updateFrame() {
    return true;
  }
  zoom(_width, posX) {
    return this.moveTo(posX);
  }
  moveTo(posX) {
    this.#posX = posX;
    this.$node.style.transform = `translateX(${-posX}px)`;
    this.#schedule();
    return true;
  }
  #wait(event) {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.#video.removeEventListener(event, ready);
        this.#video.removeEventListener('error', failed);
      };
      const ready = () => {
        cleanup();
        resolve();
      };
      const failed = () => {
        cleanup();
        reject(new Error('Frame unavailable'));
      };
      const timer = setTimeout(failed, 5000);
      this.#video.addEventListener(event, ready, { once: true });
      this.#video.addEventListener('error', failed, { once: true });
    });
  }
  #schedule() {
    if (!this.#url || this.#video.readyState < 2) return;
    this.#pending = true;
    if (!this.#rendering) this.#draw();
  }
  async #draw() {
    this.#rendering = true;
    try {
      while (this.#pending && this.#url) {
        this.#pending = false;
        const generation = this.#generation;
        const width = Math.max(
          80,
          Math.round((80 * this.#video.videoWidth) / this.#video.videoHeight)
        );
        const start = Math.max(0, Math.floor(this.#posX / width));
        const count = Math.min(32, Math.ceil(this.$parent.clientWidth / width) + 2);
        const totalWidth = getPosXFromTime(this.#duration);
        this.$node.style.width = `${totalWidth}px`;
        this.$node.replaceChildren();
        for (let i = start; i < start + count && i * width < totalWidth; i++) {
          const time = Math.min(
            this.#video.duration - 0.001,
            Math.max(0, getTimeFromPosX(i * width))
          );
          const key = time.toFixed(3);
          let frame = this.#frames.get(key);
          if (!frame) {
            if (Math.abs(this.#video.currentTime - time) > 0.001) {
              const ready = this.#wait('seeked');
              this.#video.currentTime = time;
              await ready;
            }
            if (generation !== this.#generation || this.#pending) break;
            frame = document.createElement('canvas');
            frame.width = width;
            frame.height = 80;
            frame.getContext('2d').drawImage(this.#video, 0, 0, width, 80);
            this.#frames.set(key, frame);
            while (this.#frames.size > 32) this.#frames.delete(this.#frames.keys().next().value);
          }
          const item = document.createElement('li');
          item.style.cssText = `position:absolute;left:${i * width}px;width:${width}px;height:80px`;
          item.title = `${time.toFixed(1)} s`;
          item.appendChild(frame);
          this.$node.appendChild(item);
        }
      }
    } catch {
      /* Cancelled or unsupported seeks leave the existing visible frames intact. */
    } finally {
      this.#rendering = false;
      if (this.#pending) this.#schedule();
    }
  }
  onDestroy() {
    this.#generation++;
    this.#pending = false;
    this.#resize.disconnect();
    this.#video.removeAttribute('src');
    this.#video.load();
    if (this.#url) URL.revokeObjectURL(this.#url);
    this.#url = null;
    this.#frames.clear();
    this.#container.remove();
  }
}
