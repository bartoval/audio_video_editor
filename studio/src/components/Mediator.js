import LayoutManager from '../services/LayoutManager';
import PlaybackController from '../services/PlaybackController';

export default (() => {
  let player = null,
    navigator = null,
    toast = null,
    video = null,
    uploader = null,
    /** Initialize all components with video metadata */
    _init = async metaInfo => {
      const { duration } = metaInfo;
      PlaybackController.init(duration);
      player.init(duration, metaInfo);
      await navigator.init(duration, metaInfo);
      LayoutManager.resize();

      return true;
    };

  // Initialize layout manager
  LayoutManager.init();

  // Start playback loop
  PlaybackController.startLoop();

  return {
    // ========================================================================
    // Component Registration
    // ========================================================================

    registerTimer: () => {
      // PlaybackController is now the timer - no-op for backwards compat
    },

    registerVideo: videoInstance => {
      video = videoInstance;
      LayoutManager.registerVideo(videoInstance);
      PlaybackController.registerVideo(videoInstance);
    },

    registerPlayer: playerInstance => {
      player = playerInstance;
      LayoutManager.registerPlayer(playerInstance);
      PlaybackController.registerPlayer(playerInstance);
    },

    registerNavigator: navigatorInstance => {
      navigator = navigatorInstance;
      LayoutManager.registerNavigator(navigatorInstance);
      PlaybackController.registerNavigator(navigatorInstance);
    },

    registerToast: toastInstance => {
      toast = toastInstance;
    },

    registerUploader: uploaderInstance => {
      uploader = uploaderInstance;
    },

    // ========================================================================
    // Toast
    // ========================================================================

    showToast: config => {
      toast.show(config);
    },

    // ========================================================================
    // Data
    // ========================================================================

    getData: () => {
      const stageData = navigator.getData();
      const videoData = video.getData();

      return { navigator: stageData, video: videoData };
    },

    // ========================================================================
    // Video Loading
    // ========================================================================

    onLoadVideo: async (url, config = {}) => {
      try {
        const params = await video.load(url);
        config.duration = params.duration;
        config.url = params.url;
        config.displayAspectRatio = params.displayAspectRatio;
        config.tracks = config.tracks === undefined ? params.tracks : config.tracks;
        document.querySelector('.studio').classList.add('has-video');

        if (uploader) {
          uploader.showVideoActions();
        }

        await _init(config);
      } catch (err) {
        if (uploader) {
          uploader.showEmptyState();
        }
      }
    },

    // ========================================================================
    // Layout
    // ========================================================================

    onResize: height => {
      LayoutManager.resizeFromVideo(height);
    },

    // ========================================================================
    // Playback Control (delegated to PlaybackController)
    // ========================================================================

    onStart: () => {
      return PlaybackController.play();
    },

    onStop: () => {
      return PlaybackController.pause();
    },

    onReset: (isScene = false) => {
      return PlaybackController.resetPlayback(isScene);
    },

    onSetTimeSlice: (timeSlice = null) => {
      PlaybackController.setTimeSlice(timeSlice);
    },

    onRewind: () => {
      return PlaybackController.rewind();
    },

    onSkipBack: (seconds = 5) => {
      return PlaybackController.skipBack(seconds);
    },

    onSkipForward: (seconds = 5) => {
      return PlaybackController.skipForward(seconds);
    },

    onFastForward: () => {
      return PlaybackController.fastForward();
    },

    // ========================================================================
    // Scrubber Movement (delegated to PlaybackController)
    // ========================================================================

    onMoveFromPlayer: time => {
      return PlaybackController.moveFromPlayer(time);
    },

    onMoveFromNavigator: time => {
      return PlaybackController.moveFromNavigator(time);
    },

    // ========================================================================
    // Update Loop (no longer needed - handled by PlaybackController)
    // ========================================================================

    onUpdate: () => {
      // Kept for backwards compatibility - now handled internally by PlaybackController
    },

    // ========================================================================
    // Cleanup
    // ========================================================================

    onVideoDeleted: () => {
      document.querySelector('.studio').classList.remove('has-video');

      PlaybackController.cleanup();
      LayoutManager.reset();

      if (uploader) {
        uploader.showEmptyState();
      }
    },

    // ========================================================================
    // Audio Library
    // ========================================================================

    onAddTracksToTimeline: tracks => {
      if (!navigator) {
        console.warn('[Mediator] Navigator not registered');

        return;
      }

      navigator.addTracksToTimeline(tracks);
    }
  };
})();
