/**
 * Created by valerio bartolini.
 */
import Component from 'Component';
import Config from 'Config';
/** *************************************************************************************
 *
 *                                        Private methods
 *
 ***************************************************************************************/
/**
 * Format sample rate for display
 * @param rate
 * @returns {string}
 */
let _formatSampleRate = rate => {
  if (!rate) {
    return '';
  }

  return (rate / 1000).toFixed(1) + ' kHz';
};

/**
 * Format bitrate for display
 * @param bitrate
 * @returns {string}
 */
let _formatBitrate = bitrate => {
  if (!bitrate) {
    return '';
  }

  return bitrate + ' kbps';
};

/**
 * Format file size for display
 * @param bytes
 * @returns {string}
 */
let _formatFileSize = bytes => {
  if (!bytes) {
    return '';
  }

  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + ' KB';
  }

  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

/** *************************************************************************************
 *
 *                                        Class
 *
 ***************************************************************************************/
export default class Audio {
  constructor($parent, config, $frag, onDelete) {
    this.$node = null;
    this.id = config.id;
    this.title = config.name;
    this.channelLayout = config.channelLayout || 'stereo';
    this.durationFormatted = config.durationFormatted || '00:00';
    this.duration = config.duration / 1000 || 0;
    this.sampleRate = config.sampleRate || 0;
    this.bitrate = config.bitrate || 0;
    this.codec = config.codec || '';
    this.format = config.format || '';
    this.fileSize = config.fileSize || 0;
    this.onDelete = onDelete;

    this.render($parent, $frag);
  }

  /**
   * Delete this audio from library
   */
  delete() {
    const uuid = Config.getUuid();

    if (!uuid || uuid === '0') {
      console.error('No project selected');

      return;
    }

    fetch(Config.getApiUrl() + `deleteAudio/${uuid}/${this.id}`, { method: 'DELETE' })
      .then(response => response.json())
      .then(result => {
        if (result.status === 'deleted') {
          this.$node.remove();
          this.onDelete?.();
        } else {
          console.error('Failed to delete audio:', result);
        }
      })
      .catch(err => {
        console.error('Error deleting audio:', err);
      });
  }

  /**
   * Create a package that contains meta audio info
   *
   * @returns {{src: *, label: *, duration: *}}
   */
  createMsg() {
    return {
      id: this.id,
      label: this.title,
      duration: this.getDuration()
    };
  }

  getDuration() {
    return this.duration;
  }

  /**
   * Create DOM - List layout with metadata
   *
   * @param $parent
   * @param $frag
   */
  render($parent, $frag) {
    const setMsg = e => {
      e.stopPropagation();
      e.dataTransfer.setData('text/plain', JSON.stringify(this.createMsg()));
    };

    const deleteAudio = e => {
      e.stopPropagation();
      e.preventDefault();

      if (confirm(`Delete "${this.title}"?`)) {
        this.delete();
      }
    };

    // Build metadata string
    const metaParts = [];

    if (this.format) {
      metaParts.push(this.format.toUpperCase());
    }

    if (this.codec) {
      metaParts.push(this.codec.toUpperCase());
    }

    if (this.bitrate) {
      metaParts.push(_formatBitrate(this.bitrate));
    }

    if (this.sampleRate) {
      metaParts.push(_formatSampleRate(this.sampleRate));
    }

    if (this.channelLayout) {
      metaParts.push(this.channelLayout);
    }

    if (this.fileSize) {
      metaParts.push(_formatFileSize(this.fileSize));
    }

    const metaString = metaParts.join(' • ');

    // Create list item
    this.$node = document.createElement('li');
    this.$node.className = 'audio-item draggable';
    this.$node.draggable = true;
    this.$node.addEventListener('dragstart', setMsg);

    this.$node.innerHTML = `
      <div class="audio-left">
        <span class="audio-play mask" data-id="${this.id}" title="Preview">
          <i class="bi bi-play-fill"></i>
        </span>
        <span class="audio-title" title="${this.title}">${this.title}</span>
      </div>
      <div class="audio-right">
        <span class="audio-meta">${metaString}</span>
        <span class="audio-duration">${this.durationFormatted}</span>
        <span class="audio-download" data-id="${this.id}" title="Download">
          <i class="bi bi-download"></i>
        </span>
        <span class="audio-delete" title="Delete">
          <i class="bi bi-trash"></i>
        </span>
      </div>
    `;

    // Bind delete event
    this.$node.querySelector('.audio-delete').addEventListener('click', deleteAudio);

    $frag.appendChild(this.$node);
  }
}
