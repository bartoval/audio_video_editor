import Mediator from 'Mediator';
import Component from 'Component';
import Config from 'Config';
import MasterClock from 'MasterClock';
import Uploader from '../uploader/Uploader.js';

let _redraw = (self, width, height) => {
    self.$node.style.width = width + 'px';
    self.$node.style.height = height + 'px';
  },
  _resize = (self, y) => {
    const bounds = Config.getResizeBound();
    let aspectRatioArray = self.displayAspectRatio.split(':'),
      aspectRatio = aspectRatioArray[1] / aspectRatioArray[0],
      effectiveY, width, height;

    // When y is 0 (initial load), use default height
    if (y === 0) {
      effectiveY = bounds.defaultHeight;
    } else {
      effectiveY = y > bounds.minHeight ? y : bounds.minHeight;
    }

    width = effectiveY / aspectRatio;
    height = width * aspectRatio;
    _redraw(self, width, height);
  };

export default class Video {
  constructor($parent) {
    this.$node = null;
    this.uploader = null;
    this.hasVideo = false;
    this.render($parent);
    this.$myPlayer = document.querySelector('#my-video');
    this.displayAspectRatio = '';
    Mediator.registerVideo(this);
  }

  /** Resize video element */
  resize(y = 0) {
    _resize(this, y);
  }

  reset() {
    const $video = this.$node.querySelector('#my-video');
    const $videoSource = this.$node.querySelector('#my-video-src');

    if ($videoSource) {
      $videoSource.src = '';
    }

    if ($video) {
      $video.load();
    }

    this.hasVideo = false;
    this.uploader?.show();
  }

  /** Load video from server */
  load() {
    return window.fetch(Config.getUrl('metaInfoVideo'))
      .then(response => {
        return response.json();
      })
      .then(response => {
        if (Object.keys(response).length === 0) {
          // No video
          this.hasVideo = false;

          throw Error('no video found');
        }

        // Video exists
        this.hasVideo = true;
        this.uploader?.hide();

        let $video = this.$node.querySelector('#my-video'), $videoSource = this.$node.querySelector('#my-video-src'),
          duration = response.duration / 1000, tracks;

        this.displayAspectRatio = response.displayAspectRatio;

        $videoSource.src = Config.getVideoSrc();
        $video.load();
        this.resize();

        // Register video element with MasterClock for sync
        MasterClock.registerVideo($video);

        tracks = response.isMuteVideo === true ? [] : [
          {
            id: '-1',
            durationTime: duration, // ms to sec
            label: 'audio',
            src: Config.getTrack(),
            start: 0,
            startTime: 0,
            volumeValues: []
          }
        ];

        return {
          url: Config.getVideoSrc(),
          duration: duration,
          displayAspectRatio: this.displayAspectRatio,
          tracks: tracks
        };
      })
      .catch(err => {
        this.hasVideo = false;
        this.uploader?.show();

        throw err;
      });
  }

  /** Get video duration */
  getDuration() {
    return parseFloat(this.$myPlayer.duration);
  }

  /** Set current playback time */
  setCurrentTime(time) {
    if (isNaN(time) || time < 0) {
      throw new Error('wrong input: current time is ' + time);
    }
    this.$myPlayer.currentTime = time;
    return true;
  }

  /** Get current playback time */
  getCurrentTime() {
    return this.$myPlayer.currentTime;
  }

  /** Check if video is playing */
  isPlaying() {
    return !this.$myPlayer.paused;
  }

  /** Start video playback */
  play() {
    this.$myPlayer.play();
    return true;
  }

  /** Stop video at given time */
  stop(time) {
    if (isNaN(time) || time < 0) {
      throw new Error('wrong input: current time is ' + time);
    }
    this.$myPlayer.pause();
    this.$myPlayer.currentTime = time;
    return true;
  }

  /** Get video metadata */
  getData() {
    return {src: Config.getVideoSrc(), duration: this.getDuration(), displayAspectRatio: this.displayAspectRatio};
  }

  /** Render video DOM */
  render($parent) {
    let props, listeners, $video, rafId = null,
      drag = e => {
        e.stopPropagation();
        e.preventDefault();
        let posY = e.clientY;

        // Use requestAnimationFrame to throttle resize calls for smoother performance
        if (rafId) {
          cancelAnimationFrame(rafId);
        }

        rafId = requestAnimationFrame(() => {
          Mediator.onResize(posY - 30);
          rafId = null;
        });
      },
      removeDrag = () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }

        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', drag, true);
        document.removeEventListener('mouseup', removeDrag, true);
      },
      dragStart = (e) => {
        e.preventDefault();
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'nesw-resize';
        document.addEventListener('mouseup', removeDrag, true);
        document.addEventListener('mousemove', drag, true);
      };
    props = [{class: 'content-video'}];
    this.$node = Component.render($parent, 'div', props);
    props = [{id: 'my-video', class: 'viewer', crossorigin: 'anonymous'}];
    $video = Component.render(this.$node, 'video', props);
    props = [{id: 'my-video-src', src: '#', type: 'video/mp4'}];
    Component.render($video, 'source', props);

    props = [{class: 'resizer', title: 'resize'}];
    listeners = {
      mousedown: dragStart
    };
    Component.render(this.$node, 'div', props, listeners);

    $video.volume = 0;

    // Initialize uploader
    this.uploader = new Uploader(this.$node, {
      onChange: () => {
        // Video is being changed, reset timeline first
        if (this.hasVideo) {
          Mediator.onVideoDeleted();
        }
      },
      onComplete: () => {
        // Uploader already shows conversion progress
        fetch(Config.getApiUrl() + 'convertVideo/' + Config.getUuid(), { method: 'POST' })
          .then(() => {
            // Wait for conversion completion
            this._waitForConversion();
          });
      },
      onError: (msg) => {
        console.error('Upload error:', msg);
      },
      onDelete: () => {
        // Video deleted, reset timeline
        Mediator.onVideoDeleted();
      }
    });
  }

  /** Wait for video conversion */
  _waitForConversion() {
    const checkStatus = () => {
      fetch(Config.getApiUrl() + 'isVideoConverted/' + Config.getUuid())
        .then(res => res.json())
        .then(data => {
          if (data.status === 'ready') {
            this.uploader.hideConversionProgress();
            Config.invalidateCache();
            Mediator.onLoadVideo();
          } else if (data.status === 'error') {
            this.uploader.hideConversionProgress();
            this.uploader.show();
            console.error('Video conversion failed');
          } else {
            // Still converting, check again in 1 second
            setTimeout(checkStatus, 1000);
          }
        })
        .catch(err => {
          console.error('Error checking conversion status:', err);
          // Retry on error
          setTimeout(checkStatus, 2000);
        });
    };

    checkStatus();
  }
}
