/** Video player factory - HTML5 video element with playback controls */
import { createElement, createVisibilityMixin } from '../../../../lib';
import { CSS_CLASS } from '../../../../config/ui';

export function createPlayer($parent) {
  const $video = createElement('video', {
    attributes: { id: 'my-video', crossorigin: 'anonymous' },
    className: CSS_CLASS.VIDEO_VIEWER,
    parent: $parent
  });

  const $source = createElement('source', {
    attributes: { id: 'my-video-src', src: '#' },
    parent: $video
  });

  $video.volume = 0;

  return {
    el: $video,
    ...createVisibilityMixin($video),

    setSrc(url) {
      $source.src = url;
      $video.load();
    },

    play() {
      $video.play();
    },

    pause() {
      $video.pause();
    },

    setCurrentTime(time) {
      $video.currentTime = time;
    },

    getCurrentTime() {
      return $video.currentTime;
    },

    getDuration() {
      return parseFloat($video.duration);
    },

    isPlaying() {
      return !$video.paused;
    },

    reset() {
      $video.pause();
      $video.currentTime = 0;
      $source.src = '';
      $video.load();
    }
  };
}
