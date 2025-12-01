export default (() => {
  let timer = null, player = null, navigator = null, notificator = null, video = null,
    start = 0, end = 0,

    _resize = () => {
      const $header = document.querySelector('.studio-header'),
        $workspace = document.querySelector('.studio-workspace'),
        $library = document.querySelector('.studio-library'),
        $preview = document.querySelector('.studio-preview'),
        $timeline = document.querySelector('.studio-timeline'),
        totalHeight = document.querySelector('.studio').offsetHeight,
        headerHeight = $header.offsetHeight,
        resizerHeight = document.querySelector('.studio-resizer')?.offsetHeight || 8;

      const previewStyle = getComputedStyle($preview);
      const previewPadding = parseFloat(previewStyle.paddingLeft) + parseFloat(previewStyle.paddingRight);

      const previewWidth = video.$node.offsetWidth + previewPadding;
      $preview.style.width = previewWidth + 'px';
      $library.style.width = (document.querySelector('body').offsetWidth - previewWidth) + 'px';

      const workspaceHeight = $workspace.offsetHeight;
      $timeline.style.height = (totalHeight - headerHeight - workspaceHeight - resizerHeight) + 'px';

      player.resize();
      navigator.resize();
    },

    /** Initialize all components with video metadata */
    _init = async metaInfo => {
      const { duration } = metaInfo;
      timer.init(duration);
      player.init(duration, metaInfo);
      await navigator.init(duration, metaInfo);
      _resize();

      return true;
    },

    /** Stop timer and video at given time */
    _onStop = time => {
      timer.stop();
      video.stop(time);

      return true;
    };

  window.addEventListener('resize', () => {
    if (!video) {
      return;
    }

    video.resize(document.querySelector('.studio-workspace').offsetHeight);
    _resize();
  });

  return {
    /** Register timer instance */
    registerTimer: timerInstance => {
      timer = timerInstance;
    },

    /** Register video instance */
    registerVideo: videoInstance => {
      video = videoInstance;
    },

    /** Register player instance */
    registerPlayer: playerInstance => {
      player = playerInstance;
    },

    /** Register navigator instance */
    registerNavigator: navigatorInstance => {
      navigator = navigatorInstance;
    },

    /** Register notificator instance */
    registerNotificator: notificatorInstance => {
      notificator = notificatorInstance;
    },

    /** Dispatch messages to notificator popup */
    onMessage: config => {
      notificator.setMessage(config);
    },

    /** Get data for saving: tracks, scenes, video meta */
    getData: () => {
      const stageData = navigator.getData();
      const videoData = video.getData();

      return { navigator: stageData, video: videoData };
    },

    /** Load video and setup environment */
    onLoadVideo: (url, config = {}) => {
      return video.load(url)
        .then(params => {
          start = 0;
          end = params.duration;
          config.duration = params.duration;
          config.url = params.url;
          config.displayAspectRatio = params.displayAspectRatio;
          config.tracks = config.tracks === undefined ? params.tracks : config.tracks;
          document.querySelector('.studio').classList.add('has-video');
          _init(config);
        })
        .catch(err => {
          if (err.message !== 'no video found') {
            notificator.setMessage({ type: 'error', msg: err, timeHide: 3000 });
          }

          throw err;
        });
    },

    /** Resize app from video dimension */
    onResize: height => {
      const $root = document.querySelector('.studio');
      video.resize(height - $root.offsetTop);
      _resize();
    },

    /** Handle PLAY event */
    onStart: () => {
      video.isPlaying() === false && video.play();
      timer.isRunning() === false && timer.start();
      player.play();

      return true;
    },

    /** Handle PAUSE event */
    onStop: () => {
      const time = timer.getTime();

      return _onStop(time);
    },

    /** Handle STOP/RESET event */
    onReset: (isScene = false) => {
      if (isScene === false) {
        start = 0;
        end = video.getDuration();
      }

      timer.seekTo(start) && timer.stop();
      video.stop(start);
      player.stop(start);
      navigator.moveTo(start);

      return true;
    },

    /** Set time slice for playback range */
    onSetTimeSlice: (timeSlice = null) => {
      start = timeSlice && timeSlice.start !== null ? timeSlice.start : video.getCurrentTime();
      end = timeSlice && timeSlice.end !== null ? timeSlice.end : video.getDuration();
    },

    /** Handle scrubber movement from player */
    onMoveFromPlayer: time => {
      navigator.moveTo(time);

      return timer.seekTo(time) && _onStop(time);
    },

    /** Handle scrubber movement from navigator */
    onMoveFromNavigator: time => {
      player.pause(time);

      return timer.seekTo(time) && _onStop(time);
    },

    /** Called by timer during RAF playback loop */
    onUpdate: () => {
      if (timer.isRunning()) {
        const time = timer.getTime();

        if (time > end && time < timer.getDuration() - 0.2) {
          video.setCurrentTime(start);
          navigator.moveTo(start);
        }

        player.moveTo(time);
        navigator.updateFrame(time);
      }
    },

    /** Reset everything when video is deleted */
    onVideoDeleted: () => {
      document.querySelector('.studio').classList.remove('has-video');

      if (timer) {
        timer.stop();
        timer.seekTo(0);
      }

      if (video) {
        video.reset();
      }

      if (navigator) {
        navigator.clear();
      }

      if (player) {
        player.stop(0);
      }

      start = 0;
      end = 0;
    }
  };
})();
